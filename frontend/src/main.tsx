import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { AppErrorBoundary, FatalErrorScreen } from "@/components/AppErrorBoundary";
import { queryRetryDelayMs, retryQueryFailure } from "@/lib/api/queryLoadStatus";
import { ensureFreshBuild } from "@/lib/telegram/ensureFreshBuild";
import { applyStoredAppearance } from "@/lib/appearance/appearance";
import { disableTelegramVerticalSwipes } from "@/lib/telegram/disableTelegramVerticalSwipes";
import { lockPortraitOrientation } from "@/lib/telegram/lockPortraitOrientation";
import { syncAppViewportHeight } from "@/lib/telegram/syncAppViewportHeight";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
      retry: retryQueryFailure,
      retryDelay: queryRetryDelayMs,
    },
  },
});

if (import.meta.env.DEV) {
  const { installDevTelegramStub } = await import("@/lib/telegram/devTelegramStub");
  installDevTelegramStub();
}

window.Telegram?.WebApp?.ready();
applyStoredAppearance();
window.Telegram?.WebApp?.expand();
disableTelegramVerticalSwipes();
lockPortraitOrientation();
syncAppViewportHeight();

function mountRoot(tree: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider>
    </StrictMode>,
  );
}

void ensureFreshBuild()
  .then(() => {
    mountRoot(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>,
    );
  })
  .catch(() => {
    mountRoot(<FatalErrorScreen />);
  });
