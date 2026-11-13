import { useCallback, useRef, useState } from "react";

// Board edits run one after another. While any is queued or running, the board counts as pending.
export function useBoardActionQueue() {
  const [isBoardActionPending, setIsBoardActionPending] = useState(false);
  const chainRef = useRef(Promise.resolve());
  const pendingCountRef = useRef(0);

  const enqueueBoardAction = useCallback(<T>(action: () => Promise<T>): Promise<T> => {
    const run = async () => {
      pendingCountRef.current += 1;
      setIsBoardActionPending(true);
      try {
        return await action();
      } finally {
        pendingCountRef.current -= 1;
        if (pendingCountRef.current === 0) {
          setIsBoardActionPending(false);
        }
      }
    };
    const queued = chainRef.current.then(run, run);
    chainRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

  return { enqueueBoardAction, isBoardActionPending };
}
