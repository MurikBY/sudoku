import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import Difficulty, PartyStatus
from app.models.user import User
from app.schemas.party import StartPartyResponse
from app.schemas.preferences import GameAssistsPayload
from app.services import clock, puzzle_pool_service
from app.services.games.creation import build_game_from_puzzle
from app.services.games.lifecycle import abandon_all_in_progress_games
from app.services.party.errors import PartyForbidden, PartyNotFound, PartyNotWaiting
from app.services.party.events import party_started_event
from app.services.party.load import load_party
from app.services.party.responses import party_to_response
from app.services.party_ws_hub import party_ws_hub
from app.services.sudoku.puzzle import GeneratedPuzzle


async def start_party(
    session: AsyncSession,
    host: User,
    party_id: uuid.UUID,
    difficulty: Difficulty,
) -> StartPartyResponse:
    party = await load_party(session, party_id, for_update=True)
    if party.host_user_id != host.id:
        raise PartyForbidden(f"only host can start party: {party_id}")
    if party.status != PartyStatus.waiting:
        raise PartyNotWaiting(f"party is not waiting: {party.id}")

    party.difficulty = difficulty
    generated = await puzzle_pool_service.take_puzzle_for_play(
        session,
        party.difficulty,
        taker_id=host.id,
    )

    party.puzzle = generated.puzzle
    party.solution = generated.solution
    party.givens_count = generated.givens_count

    host_game_id: uuid.UUID | None = None
    game_ids_by_user: dict[int, uuid.UUID] = {}

    for member in sorted(party.members, key=lambda item: item.joined_at):
        user = await session.get(User, member.user_id)
        if user is None:
            raise PartyNotFound(f"user not found: {member.user_id}")
        await abandon_all_in_progress_games(session, user.id)
        game = await build_game_from_puzzle(
            session,
            user.id,
            GeneratedPuzzle(
                puzzle=generated.puzzle,
                solution=generated.solution,
                difficulty=party.difficulty,
                givens_count=generated.givens_count,
            ),
            party_id=party.id,
            assists=GameAssistsPayload.model_validate(party.assists),
        )
        session.add(game)
        await session.flush()
        member.game_id = game.id
        game_ids_by_user[user.id] = game.id
        if user.id == host.id:
            host_game_id = game.id

    party.status = PartyStatus.started
    party.started_at = clock.utcnow()
    await session.commit()
    party = await load_party(session, party.id)
    if host_game_id is None:
        raise RuntimeError("host game missing after party start")

    for user_id, game_id in game_ids_by_user.items():
        await party_ws_hub.send_to_user(party.id, user_id, party_started_event(party, game_id))

    return StartPartyResponse(
        party=party_to_response(party, host.id),
        game_id=host_game_id,
    )
