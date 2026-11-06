export function disableTelegramVerticalSwipes(): void {
  const telegramWebApp = window.Telegram?.WebApp;
  if (typeof telegramWebApp?.disableVerticalSwipes !== "function") {
    return;
  }
  telegramWebApp.disableVerticalSwipes();
}
