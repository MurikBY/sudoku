import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from typing import Any

from aiogram import Bot
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import install_validation_error_schema, register_domain_error_handlers
from app.api.games import router as games_router
from app.api.health import router as health_router
from app.api.parties import router as parties_router
from app.api.play_lock import router as play_lock_router
from app.api.stats import router as stats_router
from app.api.telegram_webhook import router as telegram_webhook_router
from app.api.users import router as users_router
from app.api.ws_event_schemas import install_party_ws_event_schemas
from app.api.ws_parties import router as parties_ws_router
from app.background import cancel_all
from app.bot.setup import (
    configure_chat_menu_button,
    configure_webhook,
    create_bot,
    create_dispatcher,
)
from app.config import settings
from app.logging_config import configure_logging
from app.services.puzzle_generator import puzzle_generator
from app.services.puzzle_pool_service import run_pool_refill_loop

configure_logging(settings.LOG_LEVEL)


async def _start_telegram(app: FastAPI) -> asyncio.Task[None] | None:
    bot = create_bot()
    dispatcher = create_dispatcher()
    app.state.bot = bot
    app.state.dispatcher = dispatcher
    await configure_chat_menu_button(bot)
    if settings.TELEGRAM_USE_POLLING:
        return asyncio.create_task(dispatcher.start_polling(bot))
    await configure_webhook(bot)
    return None


async def _stop_telegram(app: FastAPI) -> None:
    bot: Bot = app.state.bot
    if not settings.TELEGRAM_USE_POLLING:
        await bot.delete_webhook(drop_pending_updates=False)
    await bot.session.close()
    app.state.bot = None
    app.state.dispatcher = None


async def _start_pool_refill() -> asyncio.Task[None] | None:
    if not settings.PUZZLE_POOL_REFILL_ENABLED:
        return None
    await puzzle_generator.start()
    return asyncio.create_task(run_pool_refill_loop(), name="puzzle-pool-refill")


async def _cancel_task(task: asyncio.Task[None] | None) -> None:
    if task is None:
        return
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.bot = None
    app.state.dispatcher = None
    polling_task = await _start_telegram(app) if settings.TELEGRAM_BOT_ENABLED else None
    pool_refill_task = await _start_pool_refill()
    yield
    await _cancel_task(pool_refill_task)
    await _cancel_task(polling_task)
    # Broadcasts use the bot, so cancel them before its session closes.
    # Spawned pool top-ups are cancelled here too, so the worker stops after them.
    await cancel_all()
    await puzzle_generator.stop()
    if settings.TELEGRAM_BOT_ENABLED:
        await _stop_telegram(app)


_API_TAGS: list[dict[str, Any]] = [
    {"name": "health", "description": "Liveness and readiness."},
    {"name": "users", "description": "Preferences and play-data reset for the signed-in player."},
    {"name": "stats", "description": "Player stats and the clean-best rating."},
    {"name": "games", "description": "Solo, lesson, and analysis games."},
    {"name": "play-lock", "description": "The one active play session for a player."},
    {"name": "parties", "description": "Party lobby, start, progress, and results."},
    {"name": "parties-ws", "description": "Live party membership over a WebSocket."},
    {"name": "telegram", "description": "Telegram bot webhook."},
]

app = FastAPI(
    title="Sudoku API",
    version="1.0.0",
    description="HTTP API for the Sudoku Telegram Mini App.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
    openapi_tags=_API_TAGS,
    lifespan=lifespan,
)
register_domain_error_handlers(app)
install_validation_error_schema(app)
install_party_ws_event_schemas(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(users_router)
app.include_router(stats_router)
app.include_router(games_router)
app.include_router(play_lock_router)
app.include_router(parties_router)
app.include_router(parties_ws_router)
app.include_router(telegram_webhook_router)
