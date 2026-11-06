export type TelegramDeepLink =
  | { kind: "party"; partyId: string }
  | { kind: "lobby"; code: string }
  | { kind: "review"; code: string };

const PARTY_START_PARAM_PREFIX = "party_";
const LOBBY_START_PARAM_PREFIX = "lobby_";
const REVIEW_START_PARAM_PREFIX = "review_";

export function readTelegramDeepLink(): TelegramDeepLink | null {
  const startParam = window.Telegram.WebApp.initDataUnsafe.start_param;
  if (!startParam) {
    return null;
  }
  if (startParam.startsWith(PARTY_START_PARAM_PREFIX)) {
    const partyId = startParam.slice(PARTY_START_PARAM_PREFIX.length);
    if (!partyId) {
      return null;
    }
    return { kind: "party", partyId };
  }
  if (startParam.startsWith(LOBBY_START_PARAM_PREFIX)) {
    const code = startParam.slice(LOBBY_START_PARAM_PREFIX.length).trim().toUpperCase();
    if (!code) {
      return null;
    }
    return { kind: "lobby", code };
  }
  if (startParam.startsWith(REVIEW_START_PARAM_PREFIX)) {
    const code = startParam.slice(REVIEW_START_PARAM_PREFIX.length).trim().toUpperCase();
    if (!code) {
      return null;
    }
    return { kind: "review", code };
  }
  return null;
}
