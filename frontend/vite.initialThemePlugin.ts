import type { Plugin } from "vite";

import {
  APPEARANCE_STORAGE_KEY,
  AUTO_DARK_END_HOUR,
  AUTO_DARK_START_HOUR,
} from "./src/lib/appearance/appearanceSchedule";

function initialThemeScript(): string {
  const storageKey = JSON.stringify(APPEARANCE_STORAGE_KEY);
  return `try {
        var appearance = JSON.parse(localStorage.getItem(${storageKey}));
        var theme = appearance && appearance.theme ? appearance.theme : "auto";
        var hour = new Date().getHours();
        var autoDark = theme === "auto" && (hour >= ${AUTO_DARK_START_HOUR} || hour < ${AUTO_DARK_END_HOUR});
        if (theme === "dark" || autoDark) {
          document.documentElement.classList.add("dark");
        }
      } catch (error) {}`;
}

export function initialThemePlugin(): Plugin {
  return {
    name: "sudoku-initial-theme",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          children: initialThemeScript(),
          injectTo: "head",
        },
      ];
    },
  };
}
