import { useEffect, useRef, useState } from "react";

import { cellIndicesForUnitKey, completedUnitKeys, type UnitKey } from "@/lib/play/sudokuGrid";

const CELEBRATION_MS = 550;

function indicesForNewlyCompletedUnits(
  previousKeys: ReadonlySet<UnitKey>,
  currentKeys: ReadonlySet<UnitKey>,
): Set<number> {
  const celebratingIndices = new Set<number>();
  for (const unitKey of currentKeys) {
    if (previousKeys.has(unitKey)) {
      continue;
    }
    for (const index of cellIndicesForUnitKey(unitKey)) {
      celebratingIndices.add(index);
    }
  }
  return celebratingIndices;
}

type UseUnitCompletionCelebrationOptions = {
  gameId: string | null;
  grid: string;
  conflictIndices: ReadonlySet<number>;
  wrongDigitIndices: ReadonlySet<number>;
};

export function useUnitCompletionCelebration({
  gameId,
  grid,
  conflictIndices,
  wrongDigitIndices,
}: UseUnitCompletionCelebrationOptions) {
  const [celebratingIndices, setCelebratingIndices] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [seenGameId, setSeenGameId] = useState(gameId);
  const completedUnitKeysRef = useRef<Set<UnitKey>>(new Set());
  const skipCelebrationRef = useRef(true);

  if (gameId !== seenGameId) {
    setSeenGameId(gameId);
    setCelebratingIndices(new Set());
  }

  useEffect(() => {
    skipCelebrationRef.current = true;
    completedUnitKeysRef.current = new Set();
  }, [gameId]);

  useEffect(() => {
    const currentKeys = completedUnitKeys(grid, conflictIndices, wrongDigitIndices);

    if (skipCelebrationRef.current) {
      skipCelebrationRef.current = false;
      completedUnitKeysRef.current = currentKeys;
      return;
    }

    const nextCelebratingIndices = indicesForNewlyCompletedUnits(
      completedUnitKeysRef.current,
      currentKeys,
    );
    completedUnitKeysRef.current = currentKeys;

    if (nextCelebratingIndices.size === 0) {
      return;
    }

    setCelebratingIndices(nextCelebratingIndices);
    const timer = window.setTimeout(() => {
      setCelebratingIndices(new Set());
    }, CELEBRATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [grid, conflictIndices, wrongDigitIndices]);

  return celebratingIndices;
}
