import { useEffect, useState } from "react";
import { Check, ClipboardPaste, X } from "lucide-react";

import type { Difficulty, Party, PartyMember } from "@/api/types";
import { DifficultyLinks } from "@/components/DifficultyLinks";
import type { PlaySessionLobby } from "@/hooks/playSessionTypes";
import { cn } from "@/lib/classNames";

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

export function LobbyClosedNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="party-lobby-closed">
      <button
        type="button"
        className="party-lobby-closed-dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X className="size-4" strokeWidth={1.75} />
      </button>
      <p className="party-lobby-closed-message">Lobby closed by the host</p>
    </div>
  );
}

type LobbyChooserProps = {
  busy: boolean;
  onCreate: () => void;
  onChooseJoin: () => void;
};

function LobbyChooser({ busy, onCreate, onChooseJoin }: LobbyChooserProps) {
  return (
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
  );
}

function useCopiedCode() {
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const copy = async (code: string) => {
    try {
      await copyText(code);
      setPulse(true);
      setCopied(true);
      window.setTimeout(() => setPulse(false), 280);
    } catch {
      // Clipboard may be blocked outside a secure context.
    }
  };

  return { copied, pulse, copy };
}

function InviteCode({ code, busy }: { code: string; busy: boolean }) {
  const { copied, pulse, copy } = useCopiedCode();
  return (
    <div className="party-lobby-code-wrap">
      <button
        type="button"
        className={cn(
          "party-lobby-code",
          pulse && "party-lobby-code-pulse",
          copied && "party-lobby-code-copied",
        )}
        aria-label="Copy invite code"
        disabled={busy}
        onClick={() => void copy(code)}
      >
        {code}
      </button>
      <p className="party-lobby-code-hint">Tap code to copy</p>
      <p
        className={cn("party-lobby-copied-toast", copied && "party-lobby-copied-toast-visible")}
        role="status"
        aria-live="polite"
      >
        Code copied
      </p>
    </div>
  );
}

type HostLobbyProps = {
  party: Party;
  members: PartyMember[];
  busy: boolean;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onStart: () => void;
};

function HostLobby({ party, members, busy, onDifficultyChange, onStart }: HostLobbyProps) {
  const canStart = members.some((member) => !member.is_host);
  return (
    <div className="party-lobby-body">
      <DifficultyLinks difficulty={party.difficulty} onDifficultyChange={onDifficultyChange} />
      <InviteCode code={party.code} busy={busy} />
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
  );
}

type GuestJoinFormProps = {
  joinCode: string;
  busy: boolean;
  onJoinCodeChange: (value: string) => void;
  onJoin: () => void;
};

function GuestJoinForm({ joinCode, busy, onJoinCodeChange, onJoin }: GuestJoinFormProps) {
  return (
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
  );
}

type GuestWaitingProps = {
  party: Party;
  members: PartyMember[];
  busy: boolean;
  onLeave: () => void;
};

function GuestWaiting({ party, members, busy, onLeave }: GuestWaitingProps) {
  return (
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
  );
}

function GuestLobby({ lobby }: { lobby: PlaySessionLobby }) {
  const { party, members, busy } = lobby;
  return (
    <div className="party-lobby-body">
      {!lobby.joinedOk || party === null ? (
        <GuestJoinForm
          joinCode={lobby.joinCode}
          busy={busy}
          onJoinCodeChange={lobby.onJoinCodeChange}
          onJoin={lobby.onJoin}
        />
      ) : (
        <GuestWaiting party={party} members={members} busy={busy} onLeave={lobby.onLeave} />
      )}
    </div>
  );
}

export function LobbyPhaseBody({ lobby }: { lobby: PlaySessionLobby }) {
  const { phase, party } = lobby;
  if (phase === "chooser") {
    return (
      <LobbyChooser busy={lobby.busy} onCreate={lobby.onCreate} onChooseJoin={lobby.onChooseJoin} />
    );
  }
  if (phase === "host" && party !== null) {
    return (
      <HostLobby
        party={party}
        members={lobby.members}
        busy={lobby.busy}
        onDifficultyChange={lobby.onDifficultyChange}
        onStart={lobby.onStart}
      />
    );
  }
  if (phase === "guest") {
    return <GuestLobby lobby={lobby} />;
  }
  return null;
}
