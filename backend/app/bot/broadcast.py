import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from aiogram import Bot
from sqlalchemy import select

from app.config import settings
from app.db import open_session
from app.models.user import User

logger = logging.getLogger(__name__)

BROADCAST_PENDING_TTL_SECONDS = 300
BROADCAST_SEND_PAUSE_SECONDS = 0.04
BROADCAST_ALBUM_SETTLE_SECONDS = 0.8

_awaiting_message_expires: dict[int, float] = {}
_awaiting_confirm: dict[int, tuple["BroadcastDraft", float]] = {}
_album_collectors: dict[int, "_AlbumCollector"] = {}

BroadcastReply = Callable[[str], Awaitable[None]]


@dataclass(frozen=True)
class BroadcastDraft:
    from_chat_id: int
    message_ids: tuple[int, ...]


class _AlbumCollector:
    def __init__(
        self,
        *,
        media_group_id: str,
        from_chat_id: int,
        reply: BroadcastReply,
    ) -> None:
        self.media_group_id = media_group_id
        self.from_chat_id = from_chat_id
        self.message_ids: list[int] = []
        self.confirm_sent = False
        self.task: asyncio.Task[None] | None = None
        self.reply = reply


def reset_broadcast_pending_state() -> None:
    for collector in _album_collectors.values():
        _cancel_collector_task(collector)
    _album_collectors.clear()
    _awaiting_message_expires.clear()
    _awaiting_confirm.clear()


def is_admin(user_id: int) -> bool:
    return user_id in settings.ADMIN_TELEGRAM_IDS


def _expire_if_needed(admin_id: int, *, now: float) -> None:
    message_expires = _awaiting_message_expires.get(admin_id)
    if message_expires is not None and message_expires <= now:
        del _awaiting_message_expires[admin_id]
    confirm = _awaiting_confirm.get(admin_id)
    if confirm is not None and confirm[1] <= now:
        del _awaiting_confirm[admin_id]


def has_broadcast_pending(admin_id: int, *, now: float | None = None) -> bool:
    monotonic = time.monotonic() if now is None else now
    _expire_if_needed(admin_id, now=monotonic)
    return (
        admin_id in _awaiting_message_expires
        or admin_id in _awaiting_confirm
        or admin_id in _album_collectors
    )


def begin_broadcast_awaiting_message(admin_id: int, *, now: float | None = None) -> None:
    monotonic = time.monotonic() if now is None else now
    _clear_album_collector(admin_id)
    _awaiting_confirm.pop(admin_id, None)
    _awaiting_message_expires[admin_id] = monotonic + BROADCAST_PENDING_TTL_SECONDS


def is_awaiting_broadcast_message(admin_id: int, *, now: float | None = None) -> bool:
    monotonic = time.monotonic() if now is None else now
    _expire_if_needed(admin_id, now=monotonic)
    return admin_id in _awaiting_message_expires


def store_broadcast_draft(
    admin_id: int,
    *,
    from_chat_id: int,
    message_ids: tuple[int, ...],
    now: float | None = None,
) -> None:
    if len(message_ids) == 0:
        raise RuntimeError("broadcast draft has no messages")
    monotonic = time.monotonic() if now is None else now
    _awaiting_message_expires.pop(admin_id, None)
    _awaiting_confirm[admin_id] = (
        BroadcastDraft(from_chat_id=from_chat_id, message_ids=message_ids),
        monotonic + BROADCAST_PENDING_TTL_SECONDS,
    )


def peek_broadcast_draft(admin_id: int, *, now: float | None = None) -> BroadcastDraft | None:
    monotonic = time.monotonic() if now is None else now
    _expire_if_needed(admin_id, now=monotonic)
    confirm = _awaiting_confirm.get(admin_id)
    if confirm is None:
        return None
    return confirm[0]


def take_broadcast_draft(admin_id: int, *, now: float | None = None) -> BroadcastDraft | None:
    draft = peek_broadcast_draft(admin_id, now=now)
    if draft is None:
        return None
    clear_broadcast_pending(admin_id)
    return draft


def clear_broadcast_pending(admin_id: int) -> None:
    _clear_album_collector(admin_id)
    _awaiting_message_expires.pop(admin_id, None)
    _awaiting_confirm.pop(admin_id, None)


async def add_album_part(
    admin_id: int,
    *,
    media_group_id: str,
    from_chat_id: int,
    message_id: int,
    reply: BroadcastReply,
) -> None:
    collector = _album_collectors.get(admin_id)
    if collector is None or collector.media_group_id != media_group_id:
        _clear_album_collector(admin_id)
        collector = _AlbumCollector(
            media_group_id=media_group_id,
            from_chat_id=from_chat_id,
            reply=reply,
        )
        _album_collectors[admin_id] = collector
    if message_id not in collector.message_ids:
        collector.message_ids.append(message_id)
    if collector.confirm_sent:
        store_broadcast_draft(
            admin_id,
            from_chat_id=collector.from_chat_id,
            message_ids=tuple(collector.message_ids),
        )
        return
    _reschedule_album_finalize(admin_id)


async def finalize_pending_album(admin_id: int) -> None:
    collector = _album_collectors.get(admin_id)
    if collector is None:
        return
    _cancel_collector_task(collector)
    await _finalize_album(admin_id)


def _reschedule_album_finalize(admin_id: int) -> None:
    collector = _album_collectors[admin_id]
    _cancel_collector_task(collector)
    collector.task = asyncio.create_task(_delayed_finalize_album(admin_id))


async def _delayed_finalize_album(admin_id: int) -> None:
    try:
        await asyncio.sleep(BROADCAST_ALBUM_SETTLE_SECONDS)
    except asyncio.CancelledError:
        return
    await _finalize_album(admin_id)


async def _finalize_album(admin_id: int) -> None:
    collector = _album_collectors.get(admin_id)
    if collector is None or len(collector.message_ids) == 0:
        return
    store_broadcast_draft(
        admin_id,
        from_chat_id=collector.from_chat_id,
        message_ids=tuple(collector.message_ids),
    )
    if collector.confirm_sent:
        return
    collector.confirm_sent = True
    recipient_count = len(await load_broadcast_recipient_ids())
    await collector.reply(broadcast_preview_text(recipient_count))


def _clear_album_collector(admin_id: int) -> None:
    collector = _album_collectors.pop(admin_id, None)
    if collector is not None:
        _cancel_collector_task(collector)


def _cancel_collector_task(collector: _AlbumCollector) -> None:
    if collector.task is not None:
        collector.task.cancel()
        collector.task = None


async def load_broadcast_recipient_ids() -> list[int]:
    async with open_session() as session:
        result = await session.execute(select(User.id).order_by(User.id))
        return list(result.scalars().all())


def broadcast_preview_text(recipient_count: int) -> str:
    return (
        f"This message will be sent to {recipient_count} user(s).\n\n"
        "/send to confirm, /cancel to abort."
    )


async def send_broadcast(
    bot: Bot,
    draft: BroadcastDraft,
    recipient_ids: list[int],
) -> tuple[int, int]:
    sent = 0
    failed = 0
    for user_id in recipient_ids:
        try:
            await _copy_draft(bot, user_id, draft)
            sent += 1
        except Exception:
            logger.exception("broadcast: send failed user_id=%s", user_id)
            failed += 1
        await asyncio.sleep(BROADCAST_SEND_PAUSE_SECONDS)
    return sent, failed


async def _copy_draft(bot: Bot, user_id: int, draft: BroadcastDraft) -> None:
    if len(draft.message_ids) == 1:
        await bot.copy_message(
            chat_id=user_id,
            from_chat_id=draft.from_chat_id,
            message_id=draft.message_ids[0],
        )
        return
    await bot.copy_messages(
        chat_id=user_id,
        from_chat_id=draft.from_chat_id,
        message_ids=list(draft.message_ids),
    )
