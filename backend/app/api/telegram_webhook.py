import hmac

from aiogram import Bot, Dispatcher
from aiogram.types import Update
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_bot, get_dispatcher
from app.config import settings

router = APIRouter(prefix="/api/telegram", tags=["telegram"])

TELEGRAM_WEBHOOK_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    bot: Bot | None = Depends(get_bot),
    dispatcher: Dispatcher | None = Depends(get_dispatcher),
) -> dict[str, bool]:
    expected_secret = settings.TELEGRAM_WEBHOOK_SECRET
    if expected_secret is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram webhook secret is not configured",
        )
    provided_secret = request.headers.get(TELEGRAM_WEBHOOK_SECRET_HEADER)
    if provided_secret is None or not hmac.compare_digest(
        provided_secret.encode("utf-8"),
        expected_secret.encode("utf-8"),
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid webhook secret",
        )

    if bot is None or dispatcher is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram bot is not configured",
        )

    payload = await request.json()
    update = Update.model_validate(payload, context={"bot": bot})
    await dispatcher.feed_update(bot, update)
    return {"ok": True}
