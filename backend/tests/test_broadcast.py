import pytest
from aiogram import Bot
from httpx import ASGITransport, AsyncClient

from app.background import drain
from app.bot.broadcast import (
    BROADCAST_PENDING_TTL_SECONDS,
    BroadcastDraft,
    begin_broadcast_awaiting_message,
    broadcast_preview_text,
    clear_broadcast_pending,
    finalize_pending_album,
    has_broadcast_pending,
    is_admin,
    is_awaiting_broadcast_message,
    load_broadcast_recipient_ids,
    peek_broadcast_draft,
    reset_broadcast_pending_state,
    send_broadcast,
    store_broadcast_draft,
    take_broadcast_draft,
)
from app.bot.handlers import (
    handle_broadcast,
    handle_broadcast_draft,
    handle_cancel,
    handle_send,
    handle_start,
    handle_total,
)
from app.config import settings
from app.main import app
from app.services.app_totals import AppTotals, format_app_totals, load_app_totals
from app.services.user_upsert import upsert_telegram_user

ADMIN_USER_ID = 1001


class FakeChat:
    def __init__(self, chat_id: int) -> None:
        self.id = chat_id


class FakeUser:
    def __init__(self, user_id: int, username: str | None = "admin") -> None:
        self.id = user_id
        self.username = username


class FakeBot:
    def __init__(self) -> None:
        self.copied: list[tuple[int, int, int]] = []
        self.copied_albums: list[tuple[int, int, list[int]]] = []
        self.fail_user_ids: set[int] = set()

    async def copy_message(self, chat_id: int, from_chat_id: int, message_id: int) -> None:
        if chat_id in self.fail_user_ids:
            raise RuntimeError("blocked")
        self.copied.append((chat_id, from_chat_id, message_id))

    async def copy_messages(
        self,
        chat_id: int,
        from_chat_id: int,
        message_ids: list[int],
    ) -> None:
        if chat_id in self.fail_user_ids:
            raise RuntimeError("blocked")
        self.copied_albums.append((chat_id, from_chat_id, list(message_ids)))


class FakeMessage:
    def __init__(
        self,
        user_id: int,
        *,
        text: str = "hello",
        message_id: int = 10,
        media_group_id: str | None = None,
        bot: FakeBot | None = None,
    ) -> None:
        self.from_user = FakeUser(user_id)
        self.chat = FakeChat(user_id)
        self.message_id = message_id
        self.media_group_id = media_group_id
        self.text = text
        self.bot = bot
        self.answers: list[str] = []

    async def answer(self, text: str, **_kwargs) -> None:
        self.answers.append(text)


class FakeDispatcher:
    def __init__(self) -> None:
        self.updates: list[object] = []

    async def feed_update(self, _bot: object, update: object) -> None:
        self.updates.append(update)


@pytest.fixture
async def webhook_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def admin_ids():
    previous = settings.ADMIN_TELEGRAM_IDS
    settings.ADMIN_TELEGRAM_IDS = [ADMIN_USER_ID]
    reset_broadcast_pending_state()
    yield ADMIN_USER_ID
    settings.ADMIN_TELEGRAM_IDS = previous
    reset_broadcast_pending_state()


def test_is_admin_uses_configured_ids(admin_ids: int) -> None:
    assert is_admin(admin_ids)
    assert not is_admin(admin_ids + 1)


def test_broadcast_pending_expires(admin_ids: int) -> None:
    begin_broadcast_awaiting_message(admin_ids, now=100)
    assert is_awaiting_broadcast_message(admin_ids, now=100)
    assert has_broadcast_pending(admin_ids, now=100)
    assert not has_broadcast_pending(admin_ids, now=100 + BROADCAST_PENDING_TTL_SECONDS + 0.1)


def test_broadcast_draft_expires(admin_ids: int) -> None:
    store_broadcast_draft(admin_ids, from_chat_id=1, message_ids=(2,), now=100)
    assert peek_broadcast_draft(admin_ids, now=100) is not None
    assert peek_broadcast_draft(admin_ids, now=100 + BROADCAST_PENDING_TTL_SECONDS + 0.1) is None


def test_broadcast_draft_replaces_awaiting_message(admin_ids: int) -> None:
    begin_broadcast_awaiting_message(admin_ids, now=100)
    store_broadcast_draft(admin_ids, from_chat_id=7, message_ids=(9,), now=110)
    assert not is_awaiting_broadcast_message(admin_ids, now=110)
    assert peek_broadcast_draft(admin_ids, now=110) == BroadcastDraft(
        from_chat_id=7,
        message_ids=(9,),
    )
    taken = take_broadcast_draft(admin_ids, now=110)
    assert taken == BroadcastDraft(from_chat_id=7, message_ids=(9,))
    assert peek_broadcast_draft(admin_ids, now=110) is None
    assert not has_broadcast_pending(admin_ids, now=110)


def test_broadcast_preview_names_recipient_count() -> None:
    assert broadcast_preview_text(17) == (
        "This message will be sent to 17 user(s).\n\n/send to confirm, /cancel to abort."
    )
    assert "test override" not in broadcast_preview_text(17)


@pytest.fixture
def broadcast_recipients(monkeypatch):
    recipient_ids = [11, 22]

    async def fake_load_broadcast_recipient_ids() -> list[int]:
        return recipient_ids

    monkeypatch.setattr(
        "app.bot.broadcast.load_broadcast_recipient_ids",
        fake_load_broadcast_recipient_ids,
    )
    monkeypatch.setattr(
        "app.bot.handlers.load_broadcast_recipient_ids",
        fake_load_broadcast_recipient_ids,
    )
    return recipient_ids


@pytest.mark.asyncio
async def test_send_broadcast_copies_to_every_recipient(broadcast_recipients: list[int]) -> None:
    bot = FakeBot()
    sent, failed = await send_broadcast(
        bot,
        BroadcastDraft(from_chat_id=5, message_ids=(8,)),
        broadcast_recipients,
    )
    assert (sent, failed) == (2, 0)
    assert bot.copied == [(11, 5, 8), (22, 5, 8)]


@pytest.mark.asyncio
async def test_send_broadcast_counts_copy_failure(broadcast_recipients: list[int]) -> None:
    bot = FakeBot()
    bot.fail_user_ids.add(11)
    sent, failed = await send_broadcast(
        bot,
        BroadcastDraft(from_chat_id=5, message_ids=(8,)),
        broadcast_recipients,
    )
    assert (sent, failed) == (1, 1)
    assert bot.copied == [(22, 5, 8)]


def test_format_app_totals_uses_hours_and_minutes() -> None:
    assert format_app_totals(
        AppTotals(
            user_count=21,
            games_started=140,
            games_completed=88,
            total_play_seconds=12 * 3600 + 34 * 60 + 9,
        ),
    ) == ("Users: 21\nGames started: 140\nGames completed: 88\nPlay time: 12h 34m")


@pytest.mark.asyncio
async def test_non_admin_total_is_ignored(admin_ids: int) -> None:
    message = FakeMessage(admin_ids + 1)
    await handle_total(message)
    assert message.answers == []


@pytest.mark.asyncio
async def test_admin_total_replies_with_totals(admin_ids: int, monkeypatch) -> None:
    totals = AppTotals(
        user_count=21,
        games_started=140,
        games_completed=88,
        total_play_seconds=90,
    )

    async def fake_load_app_totals() -> AppTotals:
        return totals

    monkeypatch.setattr("app.bot.handlers.load_app_totals", fake_load_app_totals)
    message = FakeMessage(admin_ids)
    await handle_total(message)
    assert message.answers == [format_app_totals(totals)]


@pytest.mark.asyncio
async def test_non_admin_broadcast_is_ignored(admin_ids: int) -> None:
    message = FakeMessage(admin_ids + 1)
    await handle_broadcast(message)
    assert message.answers == []
    assert not has_broadcast_pending(admin_ids + 1)


@pytest.mark.asyncio
async def test_admin_broadcast_flow_sends_to_all_recipients(
    admin_ids: int,
    broadcast_recipients: list[int],
) -> None:
    start = FakeMessage(admin_ids)
    await handle_broadcast(start)
    assert has_broadcast_pending(admin_ids)
    assert "Send the changelog next" in start.answers[0]

    draft = FakeMessage(admin_ids, text="Changelog body", message_id=44)
    await handle_broadcast_draft(draft)
    assert draft.answers[0] == broadcast_preview_text(2)
    assert peek_broadcast_draft(admin_ids) == BroadcastDraft(
        from_chat_id=admin_ids,
        message_ids=(44,),
    )

    bot = FakeBot()
    confirm = FakeMessage(admin_ids, bot=bot)
    await handle_send(confirm)
    try:
        assert confirm.answers == ["Broadcast started for 2 user(s)."]
        assert bot.copied == []
    finally:
        await drain()
    assert confirm.answers == [
        "Broadcast started for 2 user(s).",
        "Sent to 2 user(s). Failed: 0.",
    ]
    assert bot.copied == [(11, admin_ids, 44), (22, admin_ids, 44)]
    assert not has_broadcast_pending(admin_ids)


@pytest.mark.asyncio
async def test_album_draft_confirms_once_and_copies_group(
    admin_ids: int,
    broadcast_recipients: list[int],
) -> None:
    await handle_broadcast(FakeMessage(admin_ids))
    first_part = FakeMessage(admin_ids, message_id=20, media_group_id="album-1")
    await handle_broadcast_draft(first_part)
    for offset in range(1, 6):
        part = FakeMessage(admin_ids, message_id=20 + offset, media_group_id="album-1")
        await handle_broadcast_draft(part)
        assert part.answers == []
    assert first_part.answers == []

    await finalize_pending_album(admin_ids)
    album_ids = (20, 21, 22, 23, 24, 25)
    assert first_part.answers == [broadcast_preview_text(2)]
    assert peek_broadcast_draft(admin_ids) == BroadcastDraft(
        from_chat_id=admin_ids,
        message_ids=album_ids,
    )

    bot = FakeBot()
    confirm = FakeMessage(admin_ids, bot=bot)
    await handle_send(confirm)
    try:
        assert confirm.answers == ["Broadcast started for 2 user(s)."]
        assert bot.copied_albums == []
    finally:
        await drain()
    assert confirm.answers == [
        "Broadcast started for 2 user(s).",
        "Sent to 2 user(s). Failed: 0.",
    ]
    assert bot.copied == []
    assert bot.copied_albums == [
        (11, admin_ids, list(album_ids)),
        (22, admin_ids, list(album_ids)),
    ]


@pytest.mark.asyncio
async def test_admin_cancel_clears_pending(admin_ids: int) -> None:
    await handle_broadcast(FakeMessage(admin_ids))
    cancel = FakeMessage(admin_ids)
    await handle_cancel(cancel)
    assert cancel.answers == ["Broadcast cancelled."]
    assert not has_broadcast_pending(admin_ids)


@pytest.mark.asyncio
async def test_admin_send_without_draft(admin_ids: int) -> None:
    message = FakeMessage(admin_ids)
    await handle_send(message)
    assert message.answers == ["Nothing to send. Use /broadcast first."]

    await handle_broadcast(FakeMessage(admin_ids))
    early_send = FakeMessage(admin_ids)
    await handle_send(early_send)
    assert early_send.answers == [
        "Nothing to send yet. Send the changelog message first, then /send.",
    ]
    assert is_awaiting_broadcast_message(admin_ids)


@pytest.mark.asyncio
async def test_clear_pending_is_idempotent(admin_ids: int) -> None:
    clear_broadcast_pending(admin_ids)
    assert not has_broadcast_pending(admin_ids)


@pytest.mark.asyncio
async def test_admin_start_clears_broadcast_pending(admin_ids: int, monkeypatch) -> None:
    class FakeSessionCM:
        async def __aenter__(self) -> object:
            return object()

        async def __aexit__(self, *_args) -> bool:
            return False

    async def fake_upsert(_session, _user_id, _username) -> None:
        return None

    monkeypatch.setattr("app.db.session_factory", lambda: FakeSessionCM())
    monkeypatch.setattr("app.bot.handlers.upsert_telegram_user", fake_upsert)
    await handle_broadcast(FakeMessage(admin_ids))
    start = FakeMessage(admin_ids)
    await handle_start(start)
    assert not has_broadcast_pending(admin_ids)
    assert "Welcome to" in start.answers[0]


@pytest.mark.asyncio
async def test_upsert_telegram_user_creates_and_updates_username(
    isolated_session_factory,
) -> None:
    async with isolated_session_factory() as session:
        created = await upsert_telegram_user(session, 99, "first")
        assert created.id == 99
        assert created.username == "first"
        updated = await upsert_telegram_user(session, 99, "second")
        assert updated.username == "second"


@pytest.mark.asyncio
async def test_load_app_totals_on_empty_database(isolated_session_factory) -> None:
    async with isolated_session_factory() as session:
        await upsert_telegram_user(session, 10, "a")
        await upsert_telegram_user(session, 20, "b")
    assert await load_app_totals() == AppTotals(
        user_count=2,
        games_started=0,
        games_completed=0,
        total_play_seconds=0,
    )


@pytest.mark.asyncio
async def test_load_broadcast_recipient_ids_returns_all_users(
    isolated_session_factory,
) -> None:
    async with isolated_session_factory() as session:
        await upsert_telegram_user(session, 10, "a")
        await upsert_telegram_user(session, 20, "b")
    assert await load_broadcast_recipient_ids() == [10, 20]


@pytest.mark.asyncio
async def test_telegram_webhook_rejects_missing_secret(webhook_client: AsyncClient) -> None:
    previous = settings.TELEGRAM_WEBHOOK_SECRET
    settings.TELEGRAM_WEBHOOK_SECRET = None
    try:
        response = await webhook_client.post("/api/telegram/webhook", json={"update_id": 1})
    finally:
        settings.TELEGRAM_WEBHOOK_SECRET = previous
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_telegram_webhook_rejects_wrong_secret(webhook_client: AsyncClient) -> None:
    previous = settings.TELEGRAM_WEBHOOK_SECRET
    settings.TELEGRAM_WEBHOOK_SECRET = "correct_secret"
    try:
        response = await webhook_client.post(
            "/api/telegram/webhook",
            json={"update_id": 1},
            headers={"X-Telegram-Bot-Api-Secret-Token": "wrong_secret"},
        )
    finally:
        settings.TELEGRAM_WEBHOOK_SECRET = previous
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_telegram_webhook_rejects_non_ascii_secret(webhook_client: AsyncClient) -> None:
    previous = settings.TELEGRAM_WEBHOOK_SECRET
    expected_secret = "correct_secret"
    settings.TELEGRAM_WEBHOOK_SECRET = expected_secret
    try:
        for provided_secret in (b"\xff", b"\xff" * len(expected_secret)):
            response = await webhook_client.post(
                "/api/telegram/webhook",
                json={"update_id": 1},
                headers=[(b"X-Telegram-Bot-Api-Secret-Token", provided_secret)],
            )
            assert response.status_code == 403
            assert response.json()["message"] == "Invalid webhook secret"
    finally:
        settings.TELEGRAM_WEBHOOK_SECRET = previous


@pytest.mark.asyncio
async def test_telegram_webhook_accepts_matching_secret(webhook_client: AsyncClient) -> None:
    previous = settings.TELEGRAM_WEBHOOK_SECRET
    settings.TELEGRAM_WEBHOOK_SECRET = "correct_secret"
    bot = Bot(token="123456:ABC-DEF")
    dispatcher = FakeDispatcher()
    app.state.bot = bot
    app.state.dispatcher = dispatcher
    try:
        response = await webhook_client.post(
            "/api/telegram/webhook",
            json={
                "update_id": 1,
                "message": {
                    "message_id": 1,
                    "date": 1710000000,
                    "chat": {"id": 1, "type": "private"},
                    "from": {"id": 1, "is_bot": False, "first_name": "A"},
                    "text": "hi",
                },
            },
            headers={"X-Telegram-Bot-Api-Secret-Token": "correct_secret"},
        )
    finally:
        settings.TELEGRAM_WEBHOOK_SECRET = previous
        app.state.bot = None
        app.state.dispatcher = None
        await bot.session.close()
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert len(dispatcher.updates) == 1
