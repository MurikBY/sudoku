import { TriangleAlert, X } from "lucide-react";

import { coachHintChrome } from "@/content/coachHintCopy";
import type { InfoGuideLang } from "@/content/infoGuideCopy";

type CoachHintCardProps = {
  lang: InfoGuideLang;
  text: string;
  warn: boolean;
  canStrengthen: boolean;
  onStrengthen: () => void;
  onClose: () => void;
};

export function CoachHintCard({
  lang,
  text,
  warn,
  canStrengthen,
  onStrengthen,
  onClose,
}: CoachHintCardProps) {
  const chrome = coachHintChrome(lang);
  return (
    <div
      className={warn ? "gazette-coach-card gazette-coach-card-warn" : "gazette-coach-card"}
      role="status"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="gazette-coach-card-close"
        aria-label={chrome.closeAriaLabel}
        onClick={onClose}
      >
        <X className="size-4" strokeWidth={1.75} />
      </button>
      <div className="gazette-coach-card-inner">
        <p className="gazette-coach-card-text">
          {warn && (
            <TriangleAlert
              className="gazette-coach-card-notes-icon"
              strokeWidth={2.25}
              aria-hidden
            />
          )}
          <span>{text}</span>
        </p>
        {canStrengthen && (
          <button type="button" className="gazette-coach-card-strengthen" onClick={onStrengthen}>
            {chrome.showMore}
          </button>
        )}
      </div>
    </div>
  );
}
