import type { ReactNode } from "react";

import { NewspaperBackdrop } from "@/components/NewspaperBackdrop";
import { APP_HEADER_TOP_OFFSET } from "@/lib/layout";

type LayoutProps = {
  title?: string;
  lockScroll?: boolean;
  bare?: boolean;
  headerLeft?: ReactNode;
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function Layout({
  title = "",
  lockScroll = false,
  bare = false,
  headerLeft,
  headerCenter,
  headerRight,
  footer,
  children,
}: LayoutProps) {
  if (bare) {
    return (
      <div className="relative mx-auto flex h-[var(--app-vh,100dvh)] max-w-lg flex-col overflow-hidden bg-transparent">
        <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  const footerPadding = footer
    ? "calc(5.25rem + var(--safe-bottom))"
    : "max(1rem, var(--safe-bottom))";

  return (
    <div className="relative mx-auto flex h-[var(--app-vh,100dvh)] max-w-lg flex-col overflow-hidden bg-transparent">
      <NewspaperBackdrop />

      <header
        className="fixed top-0 left-1/2 z-30 box-border w-full max-w-lg -translate-x-1/2 bg-[var(--background)]"
        style={{
          height: APP_HEADER_TOP_OFFSET,
          paddingTop: "max(0.35rem, var(--safe-top))",
        }}
      >
        <div className="relative z-10 flex h-full items-center justify-center px-4">
          {headerLeft && (
            <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2">{headerLeft}</div>
          )}
          {headerCenter ? (
            <div className="px-16 text-center">{headerCenter}</div>
          ) : (
            title.trim() !== "" && (
              <h1 className="font-display text-sm font-semibold tracking-[0.08em] uppercase text-foreground">
                {title}
              </h1>
            )
          )}
          {headerRight && (
            <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">{headerRight}</div>
          )}
        </div>
        <div className="absolute inset-x-4 bottom-0 h-px bg-[color-mix(in_oklch,var(--rule)_35%,transparent)]" />
      </header>

      <main
        className={
          lockScroll
            ? "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-4"
            : "relative z-10 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4"
        }
        style={{
          paddingTop: APP_HEADER_TOP_OFFSET,
          paddingBottom: footerPadding,
        }}
      >
        {children}
      </main>

      {footer && (
        <div
          className="fixed bottom-0 left-1/2 z-30 w-full max-w-lg -translate-x-1/2 border-t border-[color-mix(in_oklch,var(--rule)_40%,transparent)] bg-[var(--background)] px-4 pt-3"
          style={{ paddingBottom: "max(0.75rem, var(--safe-bottom))" }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
