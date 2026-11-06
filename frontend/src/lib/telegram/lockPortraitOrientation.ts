export function lockPortraitOrientation(): void {
  const telegramWebApp = window.Telegram?.WebApp;
  if (typeof telegramWebApp?.lockOrientation !== "function") {
    return;
  }
  if (!window.matchMedia("(orientation: portrait)").matches) {
    return;
  }
  telegramWebApp.lockOrientation();
}
