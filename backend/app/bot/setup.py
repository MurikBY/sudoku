from aiogram import Bot, Dispatcher
from aiogram.types import MenuButtonWebApp, WebAppInfo

from app.bot.handlers import router as handlers_router
from app.config import settings


def create_bot() -> Bot:
    return Bot(token=settings.BOT_TOKEN)


def create_dispatcher() -> Dispatcher:
    dispatcher = Dispatcher()
    dispatcher.include_router(handlers_router)
    return dispatcher


async def configure_chat_menu_button(bot: Bot) -> None:
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="Play Sudoku",
            web_app=WebAppInfo(url=settings.WEBAPP_URL),
        ),
    )


def webhook_url() -> str:
    return f"https://{settings.DOMAIN}/api/telegram/webhook"


async def configure_webhook(bot: Bot) -> None:
    await bot.set_webhook(webhook_url(), secret_token=settings.TELEGRAM_WEBHOOK_SECRET)
