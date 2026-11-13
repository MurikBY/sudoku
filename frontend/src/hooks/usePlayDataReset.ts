import { useState } from "react";

import { resetPlayData } from "@/api/users";
import { formatApiErrorMessage } from "@/lib/api/apiError";

const RESET_PLAY_DATA_CONFIRM = "This erases your games, rating, and game history. Cannot undo.";

function confirmResetPlayData(): Promise<boolean> {
  const showConfirm = window.Telegram?.WebApp?.showConfirm;
  if (typeof showConfirm === "function") {
    return new Promise((resolve) => {
      showConfirm(RESET_PLAY_DATA_CONFIRM, (confirmed) => {
        resolve(confirmed);
      });
    });
  }
  return Promise.resolve(window.confirm(RESET_PLAY_DATA_CONFIRM));
}

export function usePlayDataReset(onPlayDataReset: () => void) {
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const requestReset = async () => {
    if (resetBusy) {
      return;
    }
    const confirmed = await confirmResetPlayData();
    if (!confirmed) {
      return;
    }
    setResetBusy(true);
    setResetError(null);
    try {
      await resetPlayData();
      onPlayDataReset();
    } catch (caught) {
      setResetError(formatApiErrorMessage(caught));
    } finally {
      setResetBusy(false);
    }
  };

  return { resetBusy, resetError, requestReset };
}
