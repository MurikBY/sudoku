import { X } from "lucide-react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { LobbyClosedNotice, LobbyPhaseBody } from "@/components/PartyLobbyPhases";
import type { PartyLobbyPhase } from "@/hooks/usePartyLobby";
import type { PlaySessionLobby } from "@/hooks/playSessionTypes";

function lobbyBackdropClick(
  phase: PartyLobbyPhase,
  onLeave: () => void,
  onClose: () => void,
): (() => void) | undefined {
  if (phase === "host" || phase === "guest") {
    return () => {
      void onLeave();
    };
  }
  if (phase === "closed") {
    return undefined;
  }
  return onClose;
}

type PartyLobbyModalProps = {
  lobby: PlaySessionLobby;
};

export function PartyLobbyModal({ lobby }: PartyLobbyModalProps) {
  if (!lobby.open) {
    return null;
  }
  return <OpenPartyLobbyModal lobby={lobby} />;
}

function OpenPartyLobbyModal({ lobby }: PartyLobbyModalProps) {
  const { phase, busy, error, onLeave } = lobby;
  return (
    <div
      className="party-lobby-backdrop"
      role="presentation"
      onClick={lobbyBackdropClick(phase, onLeave, lobby.onClose)}
    >
      <div
        className="party-lobby-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Play with Friends"
        onClick={(event) => event.stopPropagation()}
      >
        {phase === "closed" ? (
          <LobbyClosedNotice onDismiss={lobby.onDismissClosed} />
        ) : (
          <>
            {phase === "host" && (
              <button
                type="button"
                className="party-lobby-dismiss"
                aria-label="Cancel lobby"
                disabled={busy}
                onClick={() => void onLeave()}
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            )}
            <h2 className="party-lobby-title">Play with Friends</h2>
            {error && (
              <div className="mt-2">
                <ErrorBanner message={error} onAutoClear={lobby.onClearError} />
              </div>
            )}
            <LobbyPhaseBody lobby={lobby} />
          </>
        )}
      </div>
    </div>
  );
}
