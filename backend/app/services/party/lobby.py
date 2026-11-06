import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import Difficulty, PartyStatus
from app.models.party import Party, PartyMember
from app.models.user import User
from app.schemas.preferences import GameAssistsPayload
from app.services.party.errors import PartyForbidden, PartyFull, PartyNotFound, PartyNotWaiting
from app.services.party.events import party_cancelled_event, party_members_event
from app.services.party.limits import MAX_PARTY_SIZE
from app.services.party.load import load_party
from app.services.party_ws_hub import party_ws_hub
from app.services.unique_codes import PARTY_CODE_LENGTH, allocate_unique_code
from app.services.user_display_name import display_name_for_username


def _join_blocked_message(party: Party) -> str:
    if party.status == PartyStatus.started:
        return f"party has already started: {party.id}"
    if party.status == PartyStatus.cancelled:
        return f"party was cancelled: {party.id}"
    raise RuntimeError(f"unexpected party status: {party.status}")


async def _party_id_for_code(session: AsyncSession, code: str) -> uuid.UUID:
    result = await session.execute(select(Party.id).where(Party.code == code))
    party_id = result.scalar_one_or_none()
    if party_id is None:
        raise PartyNotFound(f"party not found: {code}")
    return party_id


async def _waiting_party_ids(session: AsyncSession, user_id: int) -> set[uuid.UUID]:
    result = await session.execute(
        select(Party.id)
        .join(PartyMember)
        .where(
            PartyMember.user_id == user_id,
            Party.status == PartyStatus.waiting,
        ),
    )
    return set(result.scalars().all())


async def _lock_parties_in_id_order(
    session: AsyncSession,
    party_ids: set[uuid.UUID],
) -> list[Party]:
    # Ascending id so two joins that each touch both rows cannot deadlock.
    locked: list[Party] = []
    for party_id in sorted(party_ids):
        result = await session.execute(
            select(Party)
            .where(Party.id == party_id)
            .options(selectinload(Party.members))
            .with_for_update(of=Party)
            .execution_options(populate_existing=True),
        )
        party = result.scalar_one_or_none()
        if party is None:
            raise PartyNotFound(f"party not found: {party_id}")
        locked.append(party)
    return locked


async def _lock_user_waiting_parties(
    session: AsyncSession,
    user_id: int,
    *extra_party_ids: uuid.UUID,
) -> list[Party]:
    party_ids = await _waiting_party_ids(session, user_id)
    party_ids.update(extra_party_ids)
    return await _lock_parties_in_id_order(session, party_ids)


def _require_locked_party(parties: list[Party], party_id: uuid.UUID) -> Party:
    for party in parties:
        if party.id == party_id:
            return party
    raise RuntimeError(f"locked party missing: {party_id}")


async def _leave_waiting_parties(
    session: AsyncSession,
    user_id: int,
    parties: list[Party],
) -> list[uuid.UUID]:
    affected: list[uuid.UUID] = []
    for party in parties:
        if party.status != PartyStatus.waiting:
            continue
        membership = next(
            (member for member in party.members if member.user_id == user_id),
            None,
        )
        if membership is None:
            continue
        if party.host_user_id == user_id:
            party.status = PartyStatus.cancelled
        await session.delete(membership)
        affected.append(party.id)
    return affected


async def _broadcast_left_parties(session: AsyncSession, party_ids: list[uuid.UUID]) -> None:
    for party_id in party_ids:
        left = await session.get(Party, party_id)
        if left is None:
            continue
        left = await load_party(session, party_id)
        if left.status == PartyStatus.cancelled:
            await party_ws_hub.broadcast(party_id, party_cancelled_event(left))
        else:
            await party_ws_hub.broadcast(party_id, party_members_event(left))


async def create_party(
    session: AsyncSession,
    host: User,
    difficulty: Difficulty,
    assists: GameAssistsPayload,
) -> Party:
    locked = await _lock_user_waiting_parties(session, host.id)
    left_ids = await _leave_waiting_parties(session, host.id, locked)
    party = Party(
        code=await allocate_unique_code(session, Party.code, PARTY_CODE_LENGTH),
        host_user_id=host.id,
        difficulty=difficulty,
        assists=assists.model_dump(),
        status=PartyStatus.waiting,
    )
    session.add(party)
    await session.flush()
    session.add(
        PartyMember(
            party_id=party.id,
            user_id=host.id,
            display_name=display_name_for_username(host.username),
        ),
    )
    await session.commit()
    await _broadcast_left_parties(session, left_ids)
    return await load_party(session, party.id)


async def join_party(session: AsyncSession, user: User, code: str) -> Party:
    normalized = code.strip().upper()
    destination_id = await _party_id_for_code(session, normalized)
    locked = await _lock_user_waiting_parties(session, user.id, destination_id)
    party = _require_locked_party(locked, destination_id)
    if party.status != PartyStatus.waiting:
        raise PartyNotWaiting(_join_blocked_message(party))

    already = next((member for member in party.members if member.user_id == user.id), None)
    if already is not None:
        return party
    if len(party.members) >= MAX_PARTY_SIZE:
        raise PartyFull(f"party is full: {party.id}")

    left_ids = await _leave_waiting_parties(session, user.id, locked)
    session.add(
        PartyMember(
            party_id=destination_id,
            user_id=user.id,
            display_name=display_name_for_username(user.username),
        ),
    )
    await session.commit()
    await _broadcast_left_parties(
        session,
        [party_id for party_id in left_ids if party_id != destination_id],
    )
    party = await load_party(session, destination_id)
    await party_ws_hub.broadcast(party.id, party_members_event(party))
    return party


async def leave_party(session: AsyncSession, user: User, party_id: uuid.UUID) -> None:
    party = await load_party(session, party_id, for_update=True)
    if party.status != PartyStatus.waiting:
        raise PartyNotWaiting(f"party is not waiting: {party.id}")

    membership = next(
        (member for member in party.members if member.user_id == user.id),
        None,
    )
    if membership is None:
        raise PartyForbidden(f"not a member of party: {party_id}")

    if party.host_user_id == user.id:
        party.status = PartyStatus.cancelled
        await session.commit()
        await party_ws_hub.broadcast(party.id, party_cancelled_event(party))
        return

    await session.delete(membership)
    await session.commit()
    party = await load_party(session, party_id)
    await party_ws_hub.broadcast(party.id, party_members_event(party))


async def cancel_party(session: AsyncSession, user: User, party_id: uuid.UUID) -> None:
    party = await load_party(session, party_id, for_update=True)
    if party.host_user_id != user.id:
        raise PartyForbidden(f"only host can cancel party: {party_id}")
    if party.status != PartyStatus.waiting:
        raise PartyNotWaiting(f"party is not waiting: {party.id}")
    party.status = PartyStatus.cancelled
    await session.commit()
    await party_ws_hub.broadcast(party.id, party_cancelled_event(party))


async def update_party_difficulty(
    session: AsyncSession,
    host: User,
    party_id: uuid.UUID,
    difficulty: Difficulty,
) -> Party:
    party = await load_party(session, party_id, for_update=True)
    if party.host_user_id != host.id:
        raise PartyForbidden(f"only host can update party: {party_id}")
    if party.status != PartyStatus.waiting:
        raise PartyNotWaiting(f"party is not waiting: {party.id}")
    party.difficulty = difficulty
    await session.commit()
    party = await load_party(session, party.id)
    await party_ws_hub.broadcast(party.id, party_members_event(party))
    return party
