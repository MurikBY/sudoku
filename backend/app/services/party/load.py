import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.base import ExecutableOption

from app.models.enums import GameStatus, PartyStatus
from app.models.game import Game
from app.models.party import Party, PartyMember
from app.services.party.errors import PartyForbidden, PartyNotFound


def _party_member_game_options() -> ExecutableOption:
    return selectinload(Party.members).selectinload(PartyMember.game)


async def load_party(
    session: AsyncSession,
    party_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> Party:
    statement = select(Party).where(Party.id == party_id).options(selectinload(Party.members))
    if for_update:
        statement = statement.with_for_update(of=Party)
    result = await session.execute(statement.execution_options(populate_existing=True))
    party = result.scalar_one_or_none()
    if party is None:
        raise PartyNotFound(f"party not found: {party_id}")
    return party


async def load_party_with_games(session: AsyncSession, party_id: uuid.UUID) -> Party:
    result = await session.execute(
        select(Party)
        .where(Party.id == party_id)
        .options(_party_member_game_options())
        .execution_options(populate_existing=True),
    )
    party = result.scalar_one_or_none()
    if party is None:
        raise PartyNotFound(f"party not found: {party_id}")
    return party


async def get_current_party(session: AsyncSession, user_id: int) -> Party | None:
    waiting = await session.execute(
        select(Party)
        .join(PartyMember)
        .where(
            PartyMember.user_id == user_id,
            Party.status == PartyStatus.waiting,
        )
        .options(selectinload(Party.members))
        .order_by(Party.created_at.desc())
        .limit(1),
    )
    party = waiting.scalar_one_or_none()
    if party is not None:
        return party

    started = await session.execute(
        select(Party)
        .join(PartyMember)
        .join(Game, PartyMember.game_id == Game.id)
        .where(
            PartyMember.user_id == user_id,
            Party.status == PartyStatus.started,
            Game.status == GameStatus.in_progress,
        )
        .options(selectinload(Party.members))
        .order_by(Party.started_at.desc())
        .limit(1),
    )
    return started.scalar_one_or_none()


async def get_party_for_member(
    session: AsyncSession,
    party_id: uuid.UUID,
    user_id: int,
) -> Party:
    party = await load_party(session, party_id)
    if not any(member.user_id == user_id for member in party.members):
        raise PartyForbidden(f"not a member of party: {party_id}")
    return party
