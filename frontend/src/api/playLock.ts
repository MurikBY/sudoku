import { api, readEmpty, readJson } from "@/api/client";

export type PlayLockStatus = {
  locked: boolean;
  is_holder: boolean;
};

export function fetchPlayLockStatus(): Promise<PlayLockStatus> {
  return readJson(api.GET("/api/play-lock"));
}

export function acquirePlayLock(token: string): Promise<void> {
  return readEmpty(api.POST("/api/play-lock/acquire", { body: { token } }));
}

export function heartbeatPlayLock(token: string): Promise<void> {
  return readEmpty(api.POST("/api/play-lock/heartbeat", { body: { token } }));
}

export function releasePlayLock(token: string): Promise<void> {
  return readEmpty(api.POST("/api/play-lock/release", { body: { token } }));
}
