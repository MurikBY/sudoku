from datetime import UTC, datetime

from app.models.enums import GameStatus
from app.schemas.preferences import GameAssistsPayload
from app.services.bot_message_format import format_elapsed
from app.services.code_invite import (
    GameInvite,
    InviteUnavailable,
    LobbyInvite,
    build_game_invite_message,
    build_lobby_invite_message,
    build_unavailable_message,
    normalize_invite_code,
)

FULL_ASSISTS = GameAssistsPayload(
    pencil=True,
    highlight_peers=True,
    highlight_same_digit=True,
    mistake_feedback=True,
    dim_completed_digits=False,
    unit_complete_animation=False,
    auto_clear_notes=True,
    sticky_digit=False,
)


def test_normalize_invite_code_accepts_lobby_and_game_lengths() -> None:
    assert normalize_invite_code("ab23cd") == "AB23CD"
    assert normalize_invite_code(" dl99gc45 ") == "DL99GC45"
    assert normalize_invite_code("SHORT") is None
    assert normalize_invite_code("TOO_LONG1") is None
    assert normalize_invite_code("hello!") is None
    assert normalize_invite_code("ab1lcd") is None  # 1 and L excluded from alphabet


def test_build_lobby_invite_message_lists_assists() -> None:
    message = build_lobby_invite_message(
        LobbyInvite(
            code="AB12CD",
            host_display_name="@Host",
            player_count=3,
            difficulty="medium",
            assists=FULL_ASSISTS,
        ),
    )
    assert "@Host" in message
    assert "Players in lobby: <b>3</b>" in message
    assert "Difficulty: <b>Medium</b>" in message
    assert "<code>AB12CD</code>" in message
    assert "<b>Settings on</b>" in message
    assert "Highlight row / column / box" in message
    assert "<b>Settings off</b>" in message
    assert "Long-press to lock digit" in message


def test_build_game_invite_message_summarizes_stats() -> None:
    message = build_game_invite_message(
        GameInvite(
            code="DL99GC45",
            display_name="@Murik_BY",
            difficulty="easy",
            status=GameStatus.completed,
            started_at=datetime(2026, 8, 14, 0, 49, tzinfo=UTC),
            elapsed_seconds=133,
            mistakes_count=2,
            hints_count=43,
            pencil_count=7,
        ),
    )
    assert "Game by @Murik_BY" in message
    assert "14 Aug 2026, 00:49 UTC" in message
    assert message.index("14 Aug 2026") < message.index("Status:")
    assert "Completed" in message
    assert format_elapsed(133) == "2:13"
    assert "2:13" in message
    assert "<code>DL99GC45</code>" in message


def test_invite_messages_escape_html_in_names() -> None:
    lobby = build_lobby_invite_message(
        LobbyInvite(
            code="AB12CD",
            host_display_name="<b>@Host</b>",
            player_count=1,
            difficulty="easy",
            assists=FULL_ASSISTS,
        ),
    )
    assert "<b>&lt;b&gt;@Host&lt;/b&gt;</b>" in lobby

    game = build_game_invite_message(
        GameInvite(
            code="DL99GC45",
            display_name="<b>@Murik_BY</b>",
            difficulty="easy",
            status=GameStatus.completed,
            started_at=datetime(2026, 8, 14, 0, 49, tzinfo=UTC),
            elapsed_seconds=133,
            mistakes_count=0,
            hints_count=0,
            pencil_count=0,
        ),
    )
    assert "<b>Game by &lt;b&gt;@Murik_BY&lt;/b&gt;</b>" in game


def test_build_unavailable_message_variants() -> None:
    assert "already started" in build_unavailable_message(
        InviteUnavailable(kind="lobby_started", code="AB12CD"),
    )
    assert "closed" in build_unavailable_message(
        InviteUnavailable(kind="lobby_closed", code="AB12CD"),
    )
    assert "No lobby or game found" in build_unavailable_message(
        InviteUnavailable(kind="not_found", code="ZZZZZZ"),
    )
