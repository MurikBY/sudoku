import type { Party } from "@/api/types";

export function isTelegramUserHost(party: Pick<Party, "host_user_id">): boolean {
  return party.host_user_id === window.Telegram.WebApp.initDataUnsafe.user?.id;
}
