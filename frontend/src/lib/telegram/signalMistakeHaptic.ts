export function signalMistakeHaptic(): void {
  const telegramHaptic = window.Telegram?.WebApp?.HapticFeedback;
  if (telegramHaptic) {
    telegramHaptic.notificationOccurred("error");
    return;
  }

  navigator.vibrate?.([60, 40, 90]);
}
