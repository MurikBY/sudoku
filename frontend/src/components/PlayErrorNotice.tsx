import { ErrorBanner } from "@/components/ErrorBanner";

type PlayErrorNoticeProps = {
  message: string;
  needsRetry: boolean;
  onClearError: () => void;
  onRetry: () => void;
};

export function PlayErrorNotice({
  message,
  needsRetry,
  onClearError,
  onRetry,
}: PlayErrorNoticeProps) {
  return (
    <div className="px-4 pt-2">
      <ErrorBanner message={message} onAutoClear={needsRetry ? undefined : onClearError} />
      {needsRetry ? (
        <button
          type="button"
          className="mt-2 border border-destructive/40 bg-transparent px-3 py-2 font-mono text-sm tracking-wide text-destructive"
          onClick={onRetry}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
