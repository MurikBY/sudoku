import { useEffect, useState } from "react";
import { Check, ClipboardPaste, X } from "lucide-react";

import type { PartyMember } from "@/api/types";
import { DifficultyLinks } from "@/components/DifficultyLinks";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { PartyLobbyPhase } from "@/hooks/usePartyLobby";
import type { PlaySessionLobby } from "@/hooks/usePlaySession";
import { cn } from "@/lib/classNames";

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
  if (phase === "chooser") {
    return onClose;
  }
  return undefined;
}

type PartyLobbyModalProps = {
  lobby: PlaySessionLobby;
};

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  throw new Error("clipboard unavailable");
}

async function readClipboard(): Promise<string> {
  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }
  throw new Error("clipboard unavailable");
}

export function PartyLobbyModal({ lobby }: PartyLobbyModalProps) {
  if (!lobby.open) {
    return null;
  }
  return <OpenPartyLobbyModal lobby={lobby} />;
}

function OpenPartyLobbyModal({ lobby }: PartyLobbyModalProps) {
  const {
    phase,
    party,
    members,
    joinCode,
    joinedOk,
    busy,
    error,
    onDifficultyChange,
    onJoinCodeChange,
    onChooseJoin,
    onCreate,
    onJoin,
    onStart,
    onLeave,
    onClose,
    onDismissClosed,
    onClearError,
  } = lobby;
  const [codeCopied, setCodeCopied] = useState(false);
  const [codePulse, setCodePulse] = useState(false);

  useEffect(() => {
    if (!codeCopied) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setCodeCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [codeCopied]);

  const guestCount = members.filter((member) => !member.is_host).length;
  const canStart = guestCount > 0;

  const handleCopyCode = async (code: string) => {
    try {
      await copyText(code);
      setCodePulse(true);
      setCodeCopied(true);
      window.setTimeout(() => setCodePulse(false), 280);
    } catch {
      // Clipboard may be blocked outside a secure context.
    }
  };

  return (
    <div
      className="party-lobby-backdrop"
      role="presentation"
      onClick={lobbyBackdropClick(phase, onLeave, onClose)}
    >
      <div
        className="party-lobby-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Play with Friends"
        onClick={(event) => event.stopPropagation()}
      >
        {phase === "closed" ? (
          <div className="party-lobby-closed">
            <button
              type="button"
              className="party-lobby-closed-dismiss"
              aria-label="Dismiss"
              onClick={onDismissClosed}
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
            <p className="party-lobby-closed-message">Lobby closed by the host</p>
          </div>
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
                <ErrorBanner message={error} onAutoClear={onClearError} />
              </div>
            )}

            {phase === "chooser" && (
              <div className="party-lobby-actions party-lobby-actions-row">
                <button
                  type="button"
                  className="home-play-button party-lobby-cta"
                  disabled={busy}
                  onClick={onCreate}
                >
                  Create
                </button>
                <button
                  type="button"
                  className="home-play-button party-lobby-cta"
                  disabled={busy}
                  onClick={onChooseJoin}
                >
                  Join
                </button>
              </div>
            )}

            {phase === "host" && party && (
              <div className="party-lobby-body">
                <DifficultyLinks
                  difficulty={party.difficulty}
                  onDifficultyChange={onDifficultyChange}
                />
                <div className="party-lobby-code-wrap">
                  <button
                    type="button"
                    className={cn(
                      "party-lobby-code",
                      codePulse && "party-lobby-code-pulse",
                      codeCopied && "party-lobby-code-copied",
                    )}
                    aria-label="Copy invite code"
                    disabled={busy}
                    onClick={() => void handleCopyCode(party.code)}
                  >
                    {party.code}
                  </button>
                  <p className="party-lobby-code-hint">Tap code to copy</p>
                  <p
                    className={cn(
                      "party-lobby-copied-toast",
                      codeCopied && "party-lobby-copied-toast-visible",
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    Code copied
                  </p>
                </div>
                <MemberList members={members} />
                <button
                  type="button"
                  className="home-play-button party-lobby-cta"
                  disabled={busy || !canStart}
                  onClick={onStart}
                >
                  {busy ? "Starting…" : "Start game"}
                </button>
              </div>
            )}

            {phase === "guest" && (
              <div className="party-lobby-body">
                {!joinedOk || party === null ? (
                  <>
                    <label className="party-lobby-label" htmlFor="party-join-code">
                      Invite code
                    </label>
                    <div className="party-lobby-join-row">
                      <input
                        id="party-join-code"
                        value={joinCode}
                        onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
                        maxLength={6}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        className="party-lobby-input"
                        placeholder="ABC123"
                      />
                      <button
                        type="button"
                        className="party-lobby-secondary inline-flex items-center gap-1"
                        disabled={busy}
                        onClick={() => {
                          void readClipboard().then((text) =>
                            onJoinCodeChange(text.trim().toUpperCase().slice(0, 6)),
                          );
                        }}
                      >
                        <ClipboardPaste className="size-3.5" aria-hidden />
                        Paste
                      </button>
                    </div>
                    <button
                      type="button"
                      className="home-play-button party-lobby-cta mt-2"
                      disabled={busy || joinCode.trim().length < 4}
                      onClick={onJoin}
                    >
                      Join
                    </button>
                  </>
                ) : (
                  <>
                    <div className="party-lobby-waiting">
                      <Check className="size-5 text-primary" aria-hidden />
                      <p>Waiting for the host to start the game.</p>
                    </div>
                    <MemberList members={members} />
                    <DifficultyLinks difficulty={party.difficulty} readOnly />
                    <button
                      type="button"
                      className="party-lobby-secondary mt-2"
                      disabled={busy}
                      onClick={() => void onLeave()}
                    >
                      Leave lobby
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MemberList({ members }: { members: PartyMember[] }) {
  if (members.length === 0) {
    return null;
  }
  return (
    <ul className="party-lobby-members">
      {members.map((member) => (
        <li key={member.user_id}>
          {member.is_host ? `${member.display_name} (host)` : member.display_name}
        </li>
      ))}
    </ul>
  );
}
