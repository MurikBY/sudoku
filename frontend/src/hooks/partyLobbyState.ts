import type { Difficulty, Party, PartyMember } from "@/api/types";

export type PartyLobbyPhase = "chooser" | "host" | "guest" | "closed";

export type PartyLobbyState = {
  open: boolean;
  phase: PartyLobbyPhase;
  party: Party | null;
  members: PartyMember[];
  joinCode: string;
  joinedOk: boolean;
  busy: boolean;
  error: string | null;
};

export type PartyLobbyAction =
  | { type: "openChooser" }
  | { type: "showChooser" }
  | { type: "resumeWaiting"; party: Party; isHost: boolean }
  | { type: "applySnapshot"; party: Party }
  | {
      type: "membersEvent";
      members: PartyMember[];
      status: Party["status"];
      difficulty: Difficulty;
    }
  | { type: "closedByHost" }
  | { type: "close" }
  | { type: "dismissClosed" }
  | { type: "createSucceeded"; party: Party }
  | { type: "joinSucceeded"; party: Party }
  | { type: "chooseJoin" }
  | { type: "openInvite"; code: string }
  | { type: "joinFailed" }
  | { type: "inviteFailed" }
  | { type: "leaveReset" }
  | { type: "setBusy"; busy: boolean }
  | { type: "setError"; error: string }
  | { type: "clearError" }
  | { type: "setJoinCode"; joinCode: string };

export const initialPartyLobbyState: PartyLobbyState = {
  open: false,
  phase: "chooser",
  party: null,
  members: [],
  joinCode: "",
  joinedOk: false,
  busy: false,
  error: null,
};

function withSnapshot(state: PartyLobbyState, party: Party): PartyLobbyState {
  return { ...state, party, members: party.members };
}

type MembersEvent = Extract<PartyLobbyAction, { type: "membersEvent" }>;

function withMembersEvent(state: PartyLobbyState, event: MembersEvent): PartyLobbyState {
  if (state.party === null) {
    return { ...state, members: event.members };
  }
  return {
    ...state,
    members: event.members,
    party: {
      ...state.party,
      status: event.status,
      difficulty: event.difficulty,
      members: event.members,
    },
  };
}

function withoutParty(state: PartyLobbyState): PartyLobbyState {
  return { ...state, party: null, members: [], joinedOk: false };
}

function closedByHost(state: PartyLobbyState): PartyLobbyState {
  return { ...withoutParty(state), error: null, phase: "closed", open: true };
}

function openedForInvite(state: PartyLobbyState, code: string): PartyLobbyState {
  return { ...withoutParty(state), open: true, error: null, busy: true, joinCode: code };
}

function leftLobby(state: PartyLobbyState): PartyLobbyState {
  return { ...withoutParty(state), phase: "chooser", open: false };
}

export function partyLobbyReducer(
  state: PartyLobbyState,
  action: PartyLobbyAction,
): PartyLobbyState {
  switch (action.type) {
    case "openChooser":
      return { ...state, open: true, error: null, joinCode: "" };
    case "showChooser":
      return { ...state, phase: "chooser", joinedOk: false, party: null, members: [] };
    case "resumeWaiting":
      return {
        ...withSnapshot(state, action.party),
        phase: action.isHost ? "host" : "guest",
        joinedOk: !action.isHost,
      };
    case "applySnapshot":
      return withSnapshot(state, action.party);
    case "membersEvent":
      return withMembersEvent(state, action);
    case "closedByHost":
      return closedByHost(state);
    case "close":
      return {
        ...state,
        open: false,
        error: null,
        phase: state.phase === "closed" ? "chooser" : state.phase,
      };
    case "dismissClosed":
      return { ...state, open: false, phase: "chooser", error: null };
    case "createSucceeded":
      return { ...withSnapshot(state, action.party), phase: "host" };
    case "joinSucceeded":
      return { ...withSnapshot(state, action.party), joinedOk: true, phase: "guest" };
    case "chooseJoin":
      return { ...state, phase: "guest" };
    case "openInvite":
      return openedForInvite(state, action.code);
    case "joinFailed":
      return { ...state, joinedOk: false };
    case "inviteFailed":
      return { ...state, phase: "guest", joinedOk: false };
    case "leaveReset":
      return leftLobby(state);
    case "setBusy":
      return { ...state, busy: action.busy };
    case "setError":
      return { ...state, error: action.error };
    case "clearError":
      return { ...state, error: null };
    case "setJoinCode":
      return { ...state, joinCode: action.joinCode };
    default: {
      const unknownAction: never = action;
      return unknownAction;
    }
  }
}
