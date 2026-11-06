import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import GameStatus, PartyStatus
from app.models.party import Party
from app.schemas.party import (
    PartyMemberResponse,
    PartyProgressPlayer,
    PartyProgressResponse,
    PartyResponse,
    PartyResultPlayer,
    PartyResultsResponse,
)
from app.schemas.preferences import GameAssistsPayload
from app.services.party.errors import PartyForbidden, PartyNotFound
from app.services.party.load import load_party_with_games
from app.services.sudoku.grid import CELL_COUNT


def _sort_result_players(players: list[PartyResultPlayer]) -> list[PartyResultPlayer]:
    status_rank = {
        "completed": 0,
        "abandoned": 1,
        "in_progress": 2,
    }

    def sort_key(player: PartyResultPlayer) -> tuple[int, int, str] | tuple[int, str]:
        rank = status_rank[player.status]
        if player.status == "completed":
            if player.elapsed_seconds is None:
                raise ValueError(
                    f"completed party result missing elapsed_seconds: {player.user_id}",
                )
            return (rank, player.elapsed_seconds, player.display_name.lower())
        return (rank, player.display_name.lower())

    return sorted(players, key=sort_key)


def _results_from_party(
    party: Party,
    viewer_user_id: int | None = None,
) -> PartyResultsResponse:
    if party.started_at is None:
        raise RuntimeError(f"started party missing started_at: {party.id}")

    players: list[PartyResultPlayer] = []
    viewer_game_id = None
    for member in party.members:
        if viewer_user_id is not None and member.user_id == viewer_user_id:
            viewer_game_id = member.game_id
        game = member.game
        if game is None:
            players.append(
                PartyResultPlayer(
                    user_id=member.user_id,
                    display_name=member.display_name,
                    status=GameStatus.abandoned.value,
                ),
            )
            continue
        if game.status == GameStatus.completed:
            players.append(
                PartyResultPlayer(
                    user_id=member.user_id,
                    display_name=member.display_name,
                    status=game.status.value,
                    elapsed_seconds=game.elapsed_seconds,
                    mistakes_count=game.mistakes_count,
                    hints_count=game.hints_count,
                    pencil_count=game.pencil_count,
                    game_id=game.id,
                    share_code=game.share_code,
                ),
            )
            continue
        players.append(
            PartyResultPlayer(
                user_id=member.user_id,
                display_name=member.display_name,
                status=game.status.value,
                game_id=game.id,
                share_code=game.share_code,
            ),
        )

    return PartyResultsResponse(
        id=party.id,
        code=party.code,
        started_at=party.started_at,
        difficulty=party.difficulty,
        assists=GameAssistsPayload.model_validate(party.assists),
        players=_sort_result_players(players),
        viewer_game_id=viewer_game_id,
    )


def party_to_response(party: Party, viewer_user_id: int) -> PartyResponse:
    members = sorted(party.members, key=lambda member: member.joined_at)
    my_game_id = None
    for member in members:
        if member.user_id == viewer_user_id:
            my_game_id = member.game_id
            break
    return PartyResponse(
        id=party.id,
        code=party.code,
        host_user_id=party.host_user_id,
        difficulty=party.difficulty,
        assists=GameAssistsPayload.model_validate(party.assists),
        status=party.status,
        members=[
            PartyMemberResponse(
                user_id=member.user_id,
                display_name=member.display_name,
                is_host=member.user_id == party.host_user_id,
                joined_at=member.joined_at,
                game_id=member.game_id,
            )
            for member in members
        ],
        my_game_id=my_game_id,
        created_at=party.created_at,
        started_at=party.started_at,
    )


async def get_party_results(
    session: AsyncSession,
    user_id: int,
    party_id: uuid.UUID,
) -> PartyResultsResponse:
    party = await load_party_with_games(session, party_id)
    if party.status != PartyStatus.started:
        raise PartyNotFound(f"party results not available: {party_id}")
    if not any(member.user_id == user_id for member in party.members):
        raise PartyForbidden(f"not a member of party: {party_id}")
    return _results_from_party(party, viewer_user_id=user_id)


def _filled_cells_count(current_grid: str) -> int:
    return sum(1 for cell in current_grid if cell != "0")


async def get_party_progress(
    session: AsyncSession,
    user_id: int,
    party_id: uuid.UUID,
) -> PartyProgressResponse:
    party = await load_party_with_games(session, party_id)
    if party.status != PartyStatus.started:
        raise PartyNotFound(f"party progress not available: {party_id}")
    if not any(member.user_id == user_id for member in party.members):
        raise PartyForbidden(f"not a member of party: {party_id}")

    players: list[PartyProgressPlayer] = []
    for member in party.members:
        game = member.game
        if game is None:
            players.append(
                PartyProgressPlayer(
                    user_id=member.user_id,
                    display_name=member.display_name,
                    filled_cells=0,
                    status=GameStatus.abandoned.value,
                ),
            )
            continue
        players.append(
            PartyProgressPlayer(
                user_id=member.user_id,
                display_name=member.display_name,
                filled_cells=_filled_cells_count(game.current_grid),
                status=game.status.value,
            ),
        )

    players.sort(key=lambda player: (-player.filled_cells, player.display_name.lower()))
    return PartyProgressResponse(
        party_id=party.id,
        total_cells=CELL_COUNT,
        players=players,
    )
