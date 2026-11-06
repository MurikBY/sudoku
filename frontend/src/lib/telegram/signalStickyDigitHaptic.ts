export function signalStickyDigitHaptic(): void {
  const telegramHaptic = window.Telegram?.WebApp?.HapticFeedback;
  if (telegramHaptic?.impactOccurred) {
    telegramHaptic.impactOccurred("medium");
    return;
  }
  if (telegramHaptic) {
    telegramHaptic.notificationOccurred("success");
    return;
  }

  navigator.vibrate?.(30);
}
