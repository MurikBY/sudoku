import { useEffect } from "react";

type ErrorBannerProps = {
  message: string;
  reconnecting?: boolean;
  onAutoClear?: () => void;
};

const AUTO_CLEAR_MS = 5000;

export function ErrorBanner({ message, reconnecting = false, onAutoClear }: ErrorBannerProps) {
  useEffect(() => {
    if (reconnecting || !onAutoClear) {
      return undefined;
    }
    const timeoutId = window.setTimeout(onAutoClear, AUTO_CLEAR_MS);
    return () => window.clearTimeout(timeoutId);
  }, [message, onAutoClear, reconnecting]);

  return (
    <div className="flex items-start justify-between gap-3 border border-destructive/40 bg-[color-mix(in_oklch,var(--destructive)_6%,transparent)] px-3 py-3 text-sm">
      <span className="font-mono tracking-wide text-destructive">
        {message}
        {reconnecting ? " · reconnecting…" : null}
      </span>
    </div>
  );
}
