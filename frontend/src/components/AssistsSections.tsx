import { useRef, useState, type MouseEvent } from "react";
import { Check, X } from "lucide-react";

import type { AppearanceTheme } from "@/lib/appearance/appearance";
import {
  applyAppearanceTheme,
  loadAppearanceTheme,
  saveAppearanceTheme,
} from "@/lib/appearance/appearance";
import type { AssistKey, GameAssists } from "@/lib/play/gameSettings";
import { cn } from "@/lib/classNames";

const POINTER_CLICK_SUPPRESS_MS = 500;
const APPEARANCE_THEMES: AppearanceTheme[] = ["light", "auto", "dark"];
const DEVELOPER_CHAT_URL = "https://t.me/Murik_BY";

function openDeveloperChat(event: MouseEvent<HTMLAnchorElement>) {
  const openTelegramLink = window.Telegram?.WebApp?.openTelegramLink;
  if (typeof openTelegramLink !== "function") {
    return;
  }
  event.preventDefault();
  openTelegramLink(DEVELOPER_CHAT_URL);
}

export function AppearancePicker() {
  const [appearanceTheme, setAppearanceTheme] = useState(loadAppearanceTheme);
  return (
    <div className="gazette-assists-appearance">
      <p className="gazette-assists-appearance-kicker">Appearance</p>
      <div className="home-difficulty-row">
        {APPEARANCE_THEMES.map((theme, index) => (
          <span key={theme} className="inline-flex items-center">
            {index > 0 && (
              <span className="home-difficulty-sep" aria-hidden="true">
                •
              </span>
            )}
            <button
              type="button"
              aria-pressed={appearanceTheme === theme}
              onClick={() => {
                saveAppearanceTheme(theme);
                applyAppearanceTheme(theme);
                setAppearanceTheme(theme);
              }}
              className={cn(
                "home-difficulty-link",
                appearanceTheme === theme && "home-difficulty-link-active",
              )}
            >
              {theme}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

type AssistToggleListProps = {
  assists: GameAssists;
  assistRows: { key: AssistKey; label: string }[];
  onAssistToggle: (key: AssistKey) => void;
};

// A touch toggles on pointer up; the click that follows it is ignored so the row flips once.
export function AssistToggleList({ assists, assistRows, onAssistToggle }: AssistToggleListProps) {
  const lastPointerAssistToggleAtRef = useRef(0);
  return (
    <div className="gazette-assists-list">
      {assistRows.map((row) => {
        const isOn = assists[row.key];
        return (
          <button
            key={row.key}
            type="button"
            onPointerUp={(event) => {
              if (!event.isPrimary) {
                return;
              }
              if (event.pointerType === "mouse" && event.button !== 0) {
                return;
              }
              lastPointerAssistToggleAtRef.current = performance.now();
              onAssistToggle(row.key);
            }}
            onClick={() => {
              if (
                performance.now() - lastPointerAssistToggleAtRef.current <
                POINTER_CLICK_SUPPRESS_MS
              ) {
                return;
              }
              onAssistToggle(row.key);
            }}
            className="gazette-assists-row touch-manipulation"
          >
            {isOn ? (
              <Check className="gazette-assists-mark gazette-assists-mark-on" aria-hidden />
            ) : (
              <X className="gazette-assists-mark gazette-assists-mark-off" aria-hidden />
            )}
            <span
              className={cn(
                "gazette-assists-label",
                isOn ? "gazette-assists-label-on" : "gazette-assists-label-off",
              )}
            >
              {row.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AssistsFooter({ onOpenGuideAssists }: { onOpenGuideAssists: () => void }) {
  return (
    <div className="gazette-assists-footer">
      <button
        type="button"
        className="gazette-home-assists-hint gazette-home-assists-hint-btn"
        onClick={onOpenGuideAssists}
      >
        What these settings mean – see Guide
      </button>
      <div className="gazette-home-settings-rule" aria-hidden="true" />
      <p className="gazette-assists-credit">
        Made by{" "}
        <a href={DEVELOPER_CHAT_URL} onClick={openDeveloperChat}>
          @Murik_BY
        </a>
        . Ideas and bugs welcome.
      </p>
    </div>
  );
}
