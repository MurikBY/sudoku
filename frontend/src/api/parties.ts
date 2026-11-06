import { API_BASE_URL, api, readEmpty, readJson } from "@/api/client";
import type {
  Difficulty,
  Party,
  PartyProgress,
  PartyResults,
  PartyWsTicketResponse,
  StartPartyResponse,
} from "@/api/types";
import type { AssistsPayload } from "@/lib/play/preferencesSync";

export function createParty(difficulty: Difficulty, assists: AssistsPayload): Promise<Party> {
  return readJson(api.POST("/api/parties", { body: { difficulty, assists } }));
}

export function joinParty(code: string): Promise<Party> {
  return readJson(api.POST("/api/parties/join", { body: { code } }));
}

export function fetchCurrentParty(): Promise<Party | null> {
  return readJson(api.GET("/api/parties/current"));
}

export function fetchPartyResults(partyId: string): Promise<PartyResults> {
  return readJson(
    api.GET("/api/parties/{party_id}/results", {
      params: { path: { party_id: partyId } },
    }),
  );
}

export function fetchPartyProgress(partyId: string): Promise<PartyProgress> {
  return readJson(
    api.GET("/api/parties/{party_id}/progress", {
      params: { path: { party_id: partyId } },
    }),
  );
}

export function startParty(partyId: string, difficulty: Difficulty): Promise<StartPartyResponse> {
  return readJson(
    api.POST("/api/parties/{party_id}/start", {
      params: { path: { party_id: partyId } },
      body: { difficulty },
    }),
  );
}

export function updatePartyDifficulty(partyId: string, difficulty: Difficulty): Promise<Party> {
  return readJson(
    api.PATCH("/api/parties/{party_id}", {
      params: { path: { party_id: partyId } },
      body: { difficulty },
    }),
  );
}

export function leaveParty(partyId: string): Promise<void> {
  return readEmpty(
    api.POST("/api/parties/{party_id}/leave", {
      params: { path: { party_id: partyId } },
    }),
  );
}

export function cancelParty(partyId: string): Promise<void> {
  return readEmpty(
    api.POST("/api/parties/{party_id}/cancel", {
      params: { path: { party_id: partyId } },
    }),
  );
}

function requirePartyWsTicket(payload: PartyWsTicketResponse): string {
  if (typeof payload.ticket !== "string" || payload.ticket === "") {
    throw new Error("party ws ticket missing");
  }
  return payload.ticket;
}

export async function partyWebSocketUrl(partyId: string): Promise<string> {
  const ticket = requirePartyWsTicket(
    await readJson(
      api.POST("/api/parties/{party_id}/ws-ticket", {
        params: { path: { party_id: partyId } },
      }),
    ),
  );
  const absolute =
    API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://")
      ? new URL(API_BASE_URL)
      : new URL(API_BASE_URL, window.location.origin);
  const wsProtocol = absolute.protocol === "https:" ? "wss:" : "ws:";
  const path = absolute.pathname.replace(/\/$/, "");
  return `${wsProtocol}//${absolute.host}${path}/ws/parties/${partyId}?${new URLSearchParams({
    ticket,
  }).toString()}`;
}
