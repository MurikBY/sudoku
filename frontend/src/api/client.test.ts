// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import { ApiError } from "@/lib/api/apiError";
import { getOrCreatePlayLockToken } from "@/lib/play/playLockToken";

function installTelegram(): void {
  window.Telegram = {
    WebApp: {
      initData: "test-init-data",
    },
  } as Window["Telegram"];
}

beforeEach(() => {
  installTelegram();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe("api client", () => {
  it("maps a 409 body to a conflict ApiError", async () => {
    const playLockToken = getOrCreatePlayLockToken();
    const fetchMock = vi.fn(async (_input: Request) => {
      return new Response(JSON.stringify({ code: "party_full", message: "Party is full." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = api.GET("/api/health");
    await expect(pending).rejects.toBeInstanceOf(ApiError);
    await expect(pending).rejects.toMatchObject({
      kind: "conflict",
      status: 409,
      code: "party_full",
      serverMessage: "Party is full.",
    });

    const request = fetchMock.mock.calls[0][0];
    expect(request.method).toBe("GET");
    expect(new URL(request.url).pathname).toBe("/api/health");
    expect(request.headers.get("Content-Type")).toBe("application/json");
    expect(request.headers.get("X-Init-Data")).toBe("test-init-data");
    expect(request.headers.get("X-Play-Lock-Token")).toBe(playLockToken);
  });

  it("maps a TypeError to network", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(api.GET("/api/health")).rejects.toMatchObject({
      kind: "network",
      status: null,
      code: null,
    });
  });

  it("maps the 15s abort to timeout", async () => {
    vi.useFakeTimers();
    let aborted = false;
    vi.stubGlobal("fetch", (input: Request) => {
      return new Promise((_resolve, reject) => {
        input.signal.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });
    });

    const pending = api.GET("/api/health");
    const timedOut = expect(pending).rejects.toMatchObject({
      kind: "timeout",
      status: null,
      code: null,
    });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(aborted).toBe(true);
    await timedOut;
  });

  it("resolves a 204 with no request body", async () => {
    const fetchMock = vi.fn(async (input: Request) => {
      expect(await input.text()).toBe("");
      expect(input.headers.get("X-Play-Lock-Token")).toBeNull();
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.POST("/api/users/me/reset-play-data");
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(204);
  });

  it("forwards a JSON body", async () => {
    const fetchMock = vi.fn(async (input: Request) => {
      expect(input.method).toBe("POST");
      expect(await input.text()).toBe(JSON.stringify({ difficulty: "easy" }));
      return new Response(JSON.stringify({ id: "game-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.POST("/api/games", { body: { difficulty: "easy" } });
    expect(result.response.status).toBe(201);
    expect(result.data).toMatchObject({ id: "game-1" });
  });

  it("keeps a JSON null, skips empty query fields, and encodes a path", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", async (input: Request) => {
      const url = new URL(input.url);
      urls.push(url);
      if (url.pathname === "/api/games/resumable") {
        return new Response("null", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const resumable = await api.GET("/api/games/resumable");
    expect(resumable.data).toBeNull();

    await api.GET("/api/games/history", {
      params: {
        query: {
          limit: 40,
          offset: 0,
          difficulty: undefined,
          status: "completed",
        },
      },
    });
    await api.GET("/api/games/by-code/{code}", {
      params: { path: { code: "AB CD" } },
    });

    expect(urls.map((url) => `${url.pathname}${url.search}`)).toEqual([
      "/api/games/resumable",
      "/api/games/history?limit=40&offset=0&status=completed",
      "/api/games/by-code/AB%20CD",
    ]);
  });
});
