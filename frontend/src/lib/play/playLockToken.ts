const PLAY_LOCK_TOKEN_KEY = "sudoku_play_lock_token";

export function getOrCreatePlayLockToken(): string {
  const persistedToken = localStorage.getItem(PLAY_LOCK_TOKEN_KEY);
  if (persistedToken) {
    return persistedToken;
  }

  const token = crypto.randomUUID();
  localStorage.setItem(PLAY_LOCK_TOKEN_KEY, token);
  return token;
}

export function readPlayLockToken(): string | null {
  return localStorage.getItem(PLAY_LOCK_TOKEN_KEY);
}
