import { useEffect } from "react";

const SOLVED_MESSAGE_MS = 1500;

// A solved analysis shows its message briefly, then returns to the review.
export function useAnalysisSolvedExit(
  showAnalysisSolved: boolean,
  onAnalysisSolved: (() => void) | undefined,
) {
  useEffect(() => {
    if (!showAnalysisSolved || onAnalysisSolved === undefined) {
      return;
    }
    const timerId = window.setTimeout(() => {
      onAnalysisSolved();
    }, SOLVED_MESSAGE_MS);
    return () => window.clearTimeout(timerId);
  }, [onAnalysisSolved, showAnalysisSolved]);
}
