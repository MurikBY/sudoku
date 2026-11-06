import createClient from "openapi-fetch";

import type { paths } from "@/api/schema";
import { ApiError, apiErrorFromStatus } from "@/lib/api/apiError";
import { readPlayLockToken } from "@/lib/play/playLockToken";

export const API_BASE_URL = "/api";

const REQUEST_TIMEOUT_MS = 15_000;

type ErrorBody = {
  code: string | null;
  message: string | null;
};

type JsonResult = {
  data?: unknown;
  response: Response;
};

function getInitData(): string {
  return window.Telegram.WebApp.initData;
}

function readErrorFields(payload: unknown): ErrorBody {
  if (payload === null || typeof payload !== "object") {
    return { code: null, message: null };
  }
  const body = payload as { code?: unknown; message?: unknown };
  return {
    code: typeof body.code === "string" ? body.code : null,
    message: typeof body.message === "string" ? body.message : null,
  };
}

async function readErrorBody(response: Response): Promise<ErrorBody> {
  try {
    return readErrorFields(await response.json());
  } catch {
    return { code: null, message: null };
  }
}

function normalizeClientError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError("timeout", null);
  }
  if (error instanceof TypeError) {
    return new ApiError("network", null);
  }
  return new ApiError("unknown", null);
}

function withAuthHeaders(input: Request, signal: AbortSignal): Request {
  const headers = new Headers(input.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Init-Data", getInitData());
  const playLockToken = readPlayLockToken();
  if (playLockToken) {
    headers.set("X-Play-Lock-Token", playLockToken);
  }
  return new Request(input, { headers, signal });
}

async function fetchWithDeadline(input: Request): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await globalThis.fetch(withAuthHeaders(input, controller.signal));
    if (!response.ok) {
      const { code, message } = await readErrorBody(response);
      throw apiErrorFromStatus(response.status, code, message);
    }
    return response;
  } catch (error) {
    throw normalizeClientError(error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// Paths include /api. An absolute base lets Request accept them outside a document.
export const api = createClient<paths>({
  baseUrl: window.location.origin,
  fetch: fetchWithDeadline,
});

export async function readJson<R extends JsonResult>(
  pending: Promise<R>,
): Promise<Exclude<R["data"], undefined>> {
  try {
    const { data } = await pending;
    if (data === undefined) {
      throw new ApiError("unknown", null);
    }
    // JSON null is a payload. The generic data type does not narrow to Exclude.
    return data as Exclude<R["data"], undefined>;
  } catch (error) {
    throw normalizeClientError(error);
  }
}

export async function readEmpty(pending: Promise<unknown>): Promise<void> {
  try {
    await pending;
  } catch (error) {
    throw normalizeClientError(error);
  }
}
