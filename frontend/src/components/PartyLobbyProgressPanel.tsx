import type { PartyProgress } from "@/api/types";

type PartyLobbyProgressPanelProps = {
  open: boolean;
  progress: PartyProgress | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export function PartyLobbyProgressPanel({
  open,
  progress,
  loading,
  error,
  onClose,
}: PartyLobbyProgressPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="party-progress-backdrop"
        aria-label="Close lobby stats"
        onClick={onClose}
      />
      <div
        className="party-progress-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Lobby stats"
      >
        {error && <p className="party-progress-error">{error}</p>}
        {!error && loading && progress === null && <p className="party-progress-empty">Loading…</p>}
        {!error && progress && (
          <ul className="party-progress-list">
            {progress.players.map((player) => (
              <li key={player.user_id} className="party-progress-row">
                <span className="party-progress-name">{player.display_name}</span>
                <span className="party-progress-score">
                  {player.filled_cells}/{progress.total_cells}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
