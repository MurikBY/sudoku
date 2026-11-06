interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  language_code?: string;
}

type TelegramWebAppEvent = "viewportChanged";

interface TelegramHapticFeedback {
  notificationOccurred(type: "error" | "success" | "warning"): void;
  impactOccurred?(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    auth_date: number;
    hash: string;
    start_param?: string;
  };
  viewportHeight: number;
  viewportStableHeight: number;
  isOrientationLocked?: boolean;
  HapticFeedback?: TelegramHapticFeedback;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  disableVerticalSwipes?(): void;
  showConfirm?(message: string, callback: (confirmed: boolean) => void): void;
  openTelegramLink?(url: string): void;
  lockOrientation?: () => void;
  unlockOrientation?: () => void;
  onEvent(eventType: TelegramWebAppEvent, callback: () => void): void;
  offEvent(eventType: TelegramWebAppEvent, callback: () => void): void;
}

interface Window {
  Telegram: {
    WebApp: TelegramWebApp;
  };
}
