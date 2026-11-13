import { useEffect } from "react";

import type { PartyResults } from "@/api/types";
import { formatPartyLobbyName } from "@/lib/format/formatPartyLobbyName";

type UsePartyMastheadTitleArgs = {
  selectedPartyId: string | null;
  results: PartyResults | null;
  onMastheadTitleChange: (title: string | null) => void;
};

// The masthead names the party once its results are on screen, and clears when they leave.
export function usePartyMastheadTitle({
  selectedPartyId,
  results,
  onMastheadTitleChange,
}: UsePartyMastheadTitleArgs) {
  useEffect(() => {
    if (selectedPartyId && results && results.id === selectedPartyId) {
      onMastheadTitleChange(formatPartyLobbyName(results.code, results.started_at));
      return () => onMastheadTitleChange(null);
    }
    onMastheadTitleChange(null);
    return () => onMastheadTitleChange(null);
  }, [onMastheadTitleChange, results, selectedPartyId]);
}
