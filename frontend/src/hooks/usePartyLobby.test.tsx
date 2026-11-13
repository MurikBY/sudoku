// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchGame } from "@/api/games";
import {
  cancelParty,
  createParty,
  fetchCurrentParty,
  leaveParty,
  partyWebSocketUrl,
} from "@/api/parties";
import type { Game, Party, PartyAssists } from "@/api/types";
import { usePartyLobby } from "@/hooks/usePartyLobby";
import type { GameAssists } from "@/lib/play/gameSettings";

vi.mock("@/api/games", () => ({ fetchGame: vi.fn() }));
vi.mock("@/api/parties", () => ({
  cancelParty: vi.fn(async () => undefined),
  createParty: vi.fn(),
  fetchCurrentParty: vi.fn(),
  joinParty: vi.fn(),
  leaveParty: vi.fn(async () => undefined),
  partyWebSocketUrl: vi.fn(async () => "ws://lobby.test/socket"),
  startParty: vi.fn(),
  updatePartyDifficulty: vi.fn(),
}));

const HOST_ID = 7;

const PARTY_ASSISTS: PartyAssists = {
  pencil: true,
  highlight_peers: false,
  highlight_same_digit: true,
  mistake_feedback: true,
  dim_completed_digits: false,
  unit_complete_animation: false,
  auto_clear_notes: true,
  sticky_digit: true,
};

const GAME_ASSISTS: GameAssists = {
  highlightPeers: false,
  highlightSameDigit: true,
  mistakeFeedback: true,
  dimCompletedDigits: false,
  unitCompleteAnimation: false,
  autoClearNotes: true,
  stickyDigit: true,
};

function waitingParty(patch: Partial<Party> = {}): Party {
  return {
    id: "party-1",
    code: "ABCDEF",
    host_user_id: HOST_ID,
    difficulty: "easy",
    status: "waiting",
    assists: PARTY_ASSISTS,
    created_at: "2026-11-13T00:00:00Z",
    members: [
      {
        user_id: HOST_ID,
        display_name: "host",
        is_host: true,
        joined_at: "2026-11-13T00:00:00Z",
      },
    ],
    ...patch,
  };
}

class FakeSocket {
  static instances: FakeSocket[] = [];
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  push(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

function renderLobby(onStarted = vi.fn()) {
  return renderHook(() =>
    usePartyLobby({
      difficulty: "easy",
      assists: GAME_ASSISTS,
      onDifficultyChange: vi.fn(),
      onStarted,
    }),
  );
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function createLobby(onStarted = vi.fn()) {
  vi.mocked(createParty).mockResolvedValue(waitingParty());
  vi.mocked(fetchCurrentParty).mockResolvedValueOnce(null);
  const hook = renderLobby(onStarted);
  act(() => hook.result.current.openLobby());
  await settle();
  vi.mocked(fetchCurrentParty).mockImplementation(async () => waitingParty());
  await act(async () => {
    await hook.result.current.handleCreate();
  });
  await settle();
  return hook;
}

describe("usePartyLobby", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    FakeSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    window.Telegram = {
      WebApp: { initData: "test", initDataUnsafe: { user: { id: HOST_ID } } },
    } as unknown as Window["Telegram"];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens the party socket after creating a lobby", async () => {
    const { result } = await createLobby();

    expect(result.current.phase).toBe("host");
    expect(partyWebSocketUrl).toHaveBeenCalledWith("party-1");
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("polls the lobby every 1500 ms while it waits", async () => {
    await createLobby();
    vi.mocked(fetchCurrentParty).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });

    expect(fetchCurrentParty).toHaveBeenCalledTimes(3);
  });

  it("applies a members event from the socket", async () => {
    const { result } = await createLobby();
    const guest = {
      user_id: 8,
      display_name: "guest",
      is_host: false,
      joined_at: "2026-11-13T00:00:01Z",
    };

    act(() => {
      FakeSocket.instances[0].push({
        type: "members",
        party_id: "party-1",
        status: "waiting",
        difficulty: "easy",
        members: [...waitingParty().members, guest],
      });
    });

    expect(result.current.members.map((member) => member.user_id)).toEqual([HOST_ID, 8]);
  });

  it("starts the game from a started event and closes the socket", async () => {
    const onStarted = vi.fn();
    const game = { id: "game-1" } as Game;
    vi.mocked(fetchGame).mockResolvedValue(game);
    const { result } = await createLobby(onStarted);
    const socket = FakeSocket.instances[0];

    await act(async () => {
      socket.push({
        type: "started",
        party_id: "party-1",
        game_id: "game-1",
        difficulty: "easy",
        assists: PARTY_ASSISTS,
      });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchGame).toHaveBeenCalledWith("game-1");
    expect(onStarted).toHaveBeenCalledExactlyOnceWith({ game, assists: GAME_ASSISTS });
    expect(socket.closed).toBe(true);
    expect(result.current.open).toBe(false);
  });

  it("cancels as host and closes the socket", async () => {
    const { result } = await createLobby();
    const socket = FakeSocket.instances[0];

    await act(async () => {
      await result.current.handleLeave();
    });

    expect(cancelParty).toHaveBeenCalledWith("party-1");
    expect(leaveParty).not.toHaveBeenCalled();
    expect(socket.closed).toBe(true);
  });
});
