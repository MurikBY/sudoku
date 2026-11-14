const RELOAD_SESSION_KEY = "sudoku_build_reload";

type VersionPayload = {
  buildId: string;
};

function parseVersionPayload(value: unknown): VersionPayload {
  if (typeof value !== "object" || value === null) {
    throw new Error("version.json must be an object");
  }
  if (!("buildId" in value) || typeof value.buildId !== "string" || value.buildId.trim() === "") {
    throw new Error("version.json is missing buildId");
  }
  return { buildId: value.buildId };
}

export async function ensureFreshBuild(): Promise<void> {
  if (import.meta.env.DEV) {
    return;
  }

  const embeddedBuildId = import.meta.env.VITE_BUILD_ID;
  if (!embeddedBuildId) {
    throw new Error("VITE_BUILD_ID is missing from the client bundle");
  }

  let serverBuildId: string;
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) {
      throw new Error(`version.json HTTP ${response.status}`);
    }
    serverBuildId = parseVersionPayload(await response.json()).buildId;
  } catch {
    // The check is best effort: a throw here would show FatalErrorScreen to every player,
    // while the bundle that is already loaded still works.
    return;
  }

  if (serverBuildId === embeddedBuildId) {
    sessionStorage.removeItem(RELOAD_SESSION_KEY);
    return;
  }

  if (sessionStorage.getItem(RELOAD_SESSION_KEY) === serverBuildId) {
    return;
  }

  sessionStorage.setItem(RELOAD_SESSION_KEY, serverBuildId);
  window.location.reload();
  await new Promise<never>(() => {});
}
