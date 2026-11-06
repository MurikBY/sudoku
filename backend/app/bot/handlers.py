from aiogram import Bot, F, Router
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart, Filter
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.background import spawn
from app.bot.broadcast import (
    BroadcastDraft,
    add_album_part,
    begin_broadcast_awaiting_message,
    broadcast_preview_text,
    clear_broadcast_pending,
    has_broadcast_pending,
    is_admin,
    is_awaiting_broadcast_message,
    load_broadcast_recipient_ids,
    send_broadcast,
    store_broadcast_draft,
    take_broadcast_draft,
)
from app.db import open_session
from app.services.app_totals import format_app_totals, load_app_totals
from app.services.code_invite import (
    GameInvite,
    InviteUnavailable,
    LobbyInvite,
    build_game_invite_message,
    build_lobby_invite_message,
    build_unavailable_message,
    normalize_invite_code,
    resolve_invite_code,
)
from app.services.user_upsert import upsert_telegram_user

router = Router()


class AdminBroadcastDraftFilter(Filter):
    async def __call__(self, message: Message) -> bool:
        from_user = message.from_user
        if from_user is None or not is_admin(from_user.id):
            return False
        return has_broadcast_pending(from_user.id)


@router.message(CommandStart())
async def handle_start(message: Message) -> None:
    from_user = message.from_user
    if from_user is None:
        raise RuntimeError("Telegram /start message is missing from_user")

    async with open_session() as session:
        await upsert_telegram_user(session, from_user.id, from_user.username)
    if is_admin(from_user.id):
        clear_broadcast_pending(from_user.id)

    await message.answer(
        "Welcome to <i>The Daily Sudoku</i>.\nOne grid. One quiet puzzle. Tap <b>Play Sudoku</b>",
        parse_mode=ParseMode.HTML,
    )


@router.message(Command("total"))
async def handle_total(message: Message) -> None:
    from_user = message.from_user
    if from_user is None or not is_admin(from_user.id):
        return
    totals = await load_app_totals()
    await message.answer(format_app_totals(totals))


@router.message(Command("broadcast"))
async def handle_broadcast(message: Message) -> None:
    from_user = message.from_user
    if from_user is None or not is_admin(from_user.id):
        return
    begin_broadcast_awaiting_message(from_user.id)
    await message.answer(
        "Send the changelog next. It will go to every user after /send.\n/cancel to abort.",
    )


@router.message(Command("cancel"))
async def handle_cancel(message: Message) -> None:
    from_user = message.from_user
    if from_user is None or not is_admin(from_user.id):
        return
    if not has_broadcast_pending(from_user.id):
        return
    clear_broadcast_pending(from_user.id)
    await message.answer("Broadcast cancelled.")


@router.message(Command("send"))
async def handle_send(message: Message) -> None:
    from_user = message.from_user
    if from_user is None or not is_admin(from_user.id):
        return
    draft = take_broadcast_draft(from_user.id)
    if draft is None:
        if is_awaiting_broadcast_message(from_user.id):
            await message.answer(
                "Nothing to send yet. Send the changelog message first, then /send.",
            )
            return
        await message.answer("Nothing to send. Use /broadcast first.")
        return
    bot = message.bot
    if bot is None:
        raise RuntimeError("Telegram bot is missing on /send")
    recipient_ids = await load_broadcast_recipient_ids()
    await message.answer(f"Broadcast started for {len(recipient_ids)} user(s).")
    spawn(
        _deliver_broadcast(message, bot, draft, recipient_ids),
        name="admin-broadcast",
    )


@router.message(AdminBroadcastDraftFilter())
async def handle_broadcast_draft(message: Message) -> None:
    from_user = message.from_user
    if from_user is None:
        raise RuntimeError("Telegram broadcast draft is missing from_user")
    if message.chat is None:
        raise RuntimeError("Telegram broadcast draft is missing chat")
    if message.media_group_id is not None:

        async def reply(text: str) -> None:
            await message.answer(text)

        await add_album_part(
            from_user.id,
            media_group_id=message.media_group_id,
            from_chat_id=message.chat.id,
            message_id=message.message_id,
            reply=reply,
        )
        return
    store_broadcast_draft(
        from_user.id,
        from_chat_id=message.chat.id,
        message_ids=(message.message_id,),
    )
    recipient_count = len(await load_broadcast_recipient_ids())
    await message.answer(broadcast_preview_text(recipient_count))


@router.message(F.text)
async def handle_invite_code(message: Message) -> None:
    if message.text is None:
        return
    code = normalize_invite_code(message.text)
    if code is None:
        return

    async with open_session() as session:
        result = await resolve_invite_code(session, code)

    bot = message.bot
    if bot is None:
        return
    me = await bot.get_me()
    bot_username = me.username
    if not bot_username:
        await message.answer(
            "Could not build an app link right now. Try again in a moment.",
        )
        return

    if isinstance(result, LobbyInvite):
        await message.answer(
            build_lobby_invite_message(result),
            parse_mode=ParseMode.HTML,
            reply_markup=_webapp_button(
                bot_username,
                label="Join lobby",
                start_param=f"lobby_{result.code}",
            ),
        )
        return

    if isinstance(result, GameInvite):
        await message.answer(
            build_game_invite_message(result),
            parse_mode=ParseMode.HTML,
            reply_markup=_webapp_button(
                bot_username,
                label="Open Game Review",
                start_param=f"review_{result.code}",
            ),
        )
        return

    if isinstance(result, InviteUnavailable):
        await message.answer(
            build_unavailable_message(result),
            parse_mode=ParseMode.HTML,
        )


async def _deliver_broadcast(
    message: Message,
    bot: Bot,
    draft: BroadcastDraft,
    recipient_ids: list[int],
) -> None:
    sent, failed = await send_broadcast(bot, draft, recipient_ids)
    await message.answer(f"Sent to {sent} user(s). Failed: {failed}.")


def _webapp_button(
    bot_username: str,
    *,
    label: str,
    start_param: str,
) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=label,
                    url=f"https://t.me/{bot_username}?startapp={start_param}",
                ),
            ],
        ],
    )
