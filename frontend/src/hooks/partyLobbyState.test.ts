import { describe, expect, it } from "vitest";

import type { Party, PartyMember } from "@/api/types";
import {
  initialPartyLobbyState,
  partyLobbyReducer,
  type PartyLobbyState,
} from "@/hooks/partyLobbyState";

const MEMBER: PartyMember = {
  user_id: 1,
  display_name: "",
  is_host: true,
  joined_at: "",
  game_id: null,
};

function party(members: PartyMember[] = [MEMBER]): Party {
  return {
    id: "party",
    code: "CODE",
    host_user_id: 1,
    difficulty: "easy",
    assists: {
      pencil: false,
      highlight_peers: false,
      highlight_same_digit: false,
      mistake_feedback: false,
      dim_completed_digits: false,
      unit_complete_animation: false,
      auto_clear_notes: false,
      sticky_digit: false,
    },
    status: "waiting",
    members,
    my_game_id: null,
    created_at: "",
    started_at: null,
  };
}

function withParty(patch: Partial<PartyLobbyState> = {}): PartyLobbyState {
  const current = party();
  return {
    ...initialPartyLobbyState,
    open: true,
    party: current,
    members: current.members,
    ...patch,
  };
}

describe("partyLobbyReducer", () => {
  it("opens the chooser without clearing a party", () => {
    const next = partyLobbyReducer(withParty({ error: "nope", joinCode: "OLD" }), {
      type: "openChooser",
    });
    expect(next.open).toBe(true);
    expect(next.error).toBeNull();
    expect(next.joinCode).toBe("");
    expect(next.party?.id).toBe("party");
  });

  it("shows an empty chooser", () => {
    expect(partyLobbyReducer(withParty({ joinedOk: true }), { type: "showChooser" })).toMatchObject(
      {
        phase: "chooser",
        joinedOk: false,
        party: null,
        members: [],
      },
    );
  });

  it("resumes waiting as host or guest", () => {
    const current = party();
    expect(
      partyLobbyReducer(initialPartyLobbyState, {
        type: "resumeWaiting",
        party: current,
        isHost: true,
      }),
    ).toMatchObject({ phase: "host", joinedOk: false, party: current, members: current.members });
    expect(
      partyLobbyReducer(initialPartyLobbyState, {
        type: "resumeWaiting",
        party: current,
        isHost: false,
      }),
    ).toMatchObject({ phase: "guest", joinedOk: true });
  });

  it("applies a snapshot", () => {
    const current = party();
    expect(
      partyLobbyReducer(initialPartyLobbyState, { type: "applySnapshot", party: current }),
    ).toMatchObject({ party: current, members: current.members });
  });

  it("keeps party null on a members event and otherwise updates it", () => {
    const alone = partyLobbyReducer(initialPartyLobbyState, {
      type: "membersEvent",
      members: [MEMBER],
      status: "started",
      difficulty: "hard",
    });
    expect(alone.party).toBeNull();
    expect(alone.members).toEqual([MEMBER]);
    const updated = partyLobbyReducer(withParty(), {
      type: "membersEvent",
      members: [],
      status: "started",
      difficulty: "hard",
    });
    expect(updated.party).toMatchObject({ status: "started", difficulty: "hard", members: [] });
    expect(updated.members).toEqual([]);
  });

  it("marks the lobby closed by the host", () => {
    expect(
      partyLobbyReducer(withParty({ error: "x", joinedOk: true }), { type: "closedByHost" }),
    ).toMatchObject({
      party: null,
      members: [],
      joinedOk: false,
      error: null,
      phase: "closed",
      open: true,
    });
  });

  it("closes, resetting a closed phase to the chooser", () => {
    expect(
      partyLobbyReducer(withParty({ phase: "closed", error: "x" }), { type: "close" }),
    ).toMatchObject({
      open: false,
      error: null,
      phase: "chooser",
    });
    expect(partyLobbyReducer(withParty({ phase: "host" }), { type: "close" }).phase).toBe("host");
  });

  it("dismisses the closed lobby", () => {
    expect(
      partyLobbyReducer(withParty({ phase: "closed", error: "x" }), { type: "dismissClosed" }),
    ).toMatchObject({
      open: false,
      phase: "chooser",
      error: null,
    });
  });

  it("records a created party as the host", () => {
    const current = party();
    expect(
      partyLobbyReducer(initialPartyLobbyState, { type: "createSucceeded", party: current }),
    ).toMatchObject({ phase: "host", party: current, members: current.members });
  });

  it("records a joined party as the guest", () => {
    const current = party();
    expect(
      partyLobbyReducer(initialPartyLobbyState, { type: "joinSucceeded", party: current }),
    ).toMatchObject({ phase: "guest", joinedOk: true, party: current });
  });

  it("chooses join without clearing the party", () => {
    expect(
      partyLobbyReducer(withParty({ phase: "chooser" }), { type: "chooseJoin" }),
    ).toMatchObject({
      phase: "guest",
      party: withParty().party,
    });
  });

  it("opens an invite without changing phase", () => {
    const next = partyLobbyReducer(withParty({ phase: "host" }), {
      type: "openInvite",
      code: "ABCD",
    });
    expect(next).toMatchObject({
      open: true,
      error: null,
      busy: true,
      joinCode: "ABCD",
      joinedOk: false,
      party: null,
      members: [],
      phase: "host",
    });
  });

  it("marks a join failure", () => {
    expect(partyLobbyReducer(withParty({ joinedOk: true }), { type: "joinFailed" }).joinedOk).toBe(
      false,
    );
  });

  it("marks an invite failure and keeps the code", () => {
    const next = partyLobbyReducer(withParty({ joinCode: "ABCD", phase: "chooser" }), {
      type: "inviteFailed",
    });
    expect(next).toMatchObject({ phase: "guest", joinedOk: false, joinCode: "ABCD" });
  });

  it("resets after leaving", () => {
    expect(
      partyLobbyReducer(withParty({ open: true, joinedOk: true }), { type: "leaveReset" }),
    ).toMatchObject({
      party: null,
      members: [],
      joinedOk: false,
      phase: "chooser",
      open: false,
    });
  });

  it("sets busy, error, and join code", () => {
    const busy = partyLobbyReducer(initialPartyLobbyState, { type: "setBusy", busy: true });
    const errored = partyLobbyReducer(busy, { type: "setError", error: "nope" });
    const coded = partyLobbyReducer(errored, { type: "setJoinCode", joinCode: "ZZ" });
    expect(partyLobbyReducer(coded, { type: "clearError" })).toMatchObject({
      busy: true,
      error: null,
      joinCode: "ZZ",
    });
  });
});
