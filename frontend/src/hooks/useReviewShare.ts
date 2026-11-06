import { useCallback, useEffect, useRef, useState } from "react";

import { sendPuzzleExportToChat } from "@/api/games";
import type { CellNotesMap, GameReview } from "@/api/types";
import { buildPuzzleExport, puzzleExportJson } from "@/lib/play/exportPuzzle";

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  throw new Error("clipboard unavailable");
}

export function useReviewShare(review: GameReview, currentGrid: string, notes: CellNotesMap) {
  const [copiedKind, setCopiedKind] = useState<"code" | "board" | "sent" | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const [isSendingBoard, setIsSendingBoard] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);

  const clearCopyResetTimeout = useCallback(() => {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearCopyResetTimeout();
    };
  }, [clearCopyResetTimeout]);

  const markCopied = (kind: "code" | "board" | "sent") => {
    clearCopyResetTimeout();
    setCopiedKind(kind);
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopiedKind(null);
      copyResetTimeoutRef.current = null;
    }, 2000);
  };

  const currentPuzzleExport = () =>
    buildPuzzleExport({
      shareCode: review.share_code,
      difficulty: review.difficulty,
      puzzle: review.puzzle,
      grid: currentGrid,
      notes,
    });

  const handleCopyCode = async () => {
    setCopyError(null);
    setSendNotice(null);
    try {
      await copyText(review.share_code);
      markCopied("code");
    } catch {
      setCopyError("Could not copy code");
    }
  };

  const handleCopyBoard = async () => {
    setCopyError(null);
    setSendNotice(null);
    try {
      await copyText(puzzleExportJson(currentPuzzleExport()));
      markCopied("board");
    } catch {
      setCopyError("Could not copy board");
    }
  };

  const handleDownloadBoard = async () => {
    setCopyError(null);
    setSendNotice(null);
    setIsSendingBoard(true);
    try {
      await sendPuzzleExportToChat(currentPuzzleExport());
      markCopied("sent");
      setSendNotice("File sent to the Telegram bot chat.");
    } catch {
      setCopyError("Could not send board to Telegram");
    } finally {
      setIsSendingBoard(false);
    }
  };

  return {
    copiedKind,
    copyError,
    sendNotice,
    isSendingBoard,
    handleCopyCode,
    handleCopyBoard,
    handleDownloadBoard,
  };
}
