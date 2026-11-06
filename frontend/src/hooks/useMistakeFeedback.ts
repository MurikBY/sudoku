import { useCallback, useEffect, useRef, useState } from "react";

import { signalMistakeHaptic } from "@/lib/telegram/signalMistakeHaptic";

const MISTAKE_ANIMATION_DURATION_MS = 400;

export function useMistakeFeedback() {
  const [animatedMistakeIndex, setAnimatedMistakeIndex] = useState<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);

  const triggerMistakeFeedback = useCallback((cellIndex: number) => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
    }

    setAnimatedMistakeIndex(null);
    animationFrameRef.current = window.requestAnimationFrame(() => {
      signalMistakeHaptic();
      setAnimatedMistakeIndex(cellIndex);
      animationTimeoutRef.current = window.setTimeout(() => {
        setAnimatedMistakeIndex(null);
        animationTimeoutRef.current = null;
      }, MISTAKE_ANIMATION_DURATION_MS);
      animationFrameRef.current = null;
    });
  }, []);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    },
    [],
  );

  return { animatedMistakeIndex, triggerMistakeFeedback };
}
