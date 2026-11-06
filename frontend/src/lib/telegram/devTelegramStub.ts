function configuredDevInitData(): string | null {
  const value: unknown = import.meta.env.VITE_DEV_INIT_DATA;
  if (value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("VITE_DEV_INIT_DATA must be a string");
  }
  return value;
}

export function installDevTelegramStub(): void {
  if (window.Telegram?.WebApp?.initData) {
    return;
  }
  const initData = configuredDevInitData();
  if (initData === null) {
    return;
  }
  const webApp = devTelegramWebApp(initData);
  if (window.Telegram) {
    window.Telegram.WebApp = webApp;
    return;
  }
  window.Telegram = { WebApp: webApp };
}

function devTelegramWebApp(initData: string): TelegramWebApp {
  return {
    initData,
    initDataUnsafe: parseInitDataUnsafe(initData),
    get viewportHeight() {
      return window.innerHeight;
    },
    get viewportStableHeight() {
      return window.innerHeight;
    },
    HapticFeedback: {
      notificationOccurred() {},
      impactOccurred() {},
    },
    ready() {},
    expand() {},
    close() {},
    disableVerticalSwipes() {},
    showConfirm(message, callback) {
      callback(window.confirm(message));
    },
    openTelegramLink(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    lockOrientation() {},
    unlockOrientation() {},
    onEvent() {},
    offEvent() {},
  };
}

function parseInitDataUnsafe(initData: string): TelegramWebApp["initDataUnsafe"] {
  const params = new URLSearchParams(initData);
  const startParam = params.get("start_param");
  return {
    user: parseUser(requireParam(params, "user")),
    auth_date: parseAuthDate(requireParam(params, "auth_date")),
    hash: requireParam(params, "hash"),
    ...(startParam ? { start_param: startParam } : {}),
  };
}

function requireParam(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (value === null || value === "") {
    throw new Error(`dev initData is missing ${name}`);
  }
  return value;
}

function parseAuthDate(raw: string): number {
  if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error("dev initData auth_date is not an integer");
  }
  return Number(raw);
}

function parseUser(raw: string): TelegramWebAppUser {
  const record = parseUserRecord(raw);
  const id = record.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id)) {
    throw new Error("dev initData user id is missing or not an integer");
  }
  const firstName = record.first_name;
  if (typeof firstName !== "string") {
    throw new Error("dev initData user first_name is missing");
  }
  const username = record.username;
  if (username !== undefined && typeof username !== "string") {
    throw new Error("dev initData username is not a string");
  }
  return {
    id,
    first_name: firstName,
    ...(typeof username === "string" ? { username } : {}),
  };
}

function parseUserRecord(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("dev initData user is not JSON", { cause: error });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("dev initData user is not an object");
  }
  return parsed as Record<string, unknown>;
}
