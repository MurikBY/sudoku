import { INFO_GUIDE_LANGS, type InfoGuideLang } from "@/content/infoGuideCopy";
import { cn } from "@/lib/classNames";

function FlagUk({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
      <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

function FlagUa({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="20" fill="#0057B7" />
      <rect y="20" width="60" height="20" fill="#FFD700" />
    </svg>
  );
}

function FlagBy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 40" aria-hidden="true">
      <rect width="60" height="40" fill="#fff" />
      <rect y="13.33" width="60" height="13.34" fill="#E4002B" />
    </svg>
  );
}

function LangFlag({ lang, className }: { lang: InfoGuideLang; className?: string }) {
  if (lang === "ua") {
    return <FlagUa className={className} />;
  }
  if (lang === "by") {
    return <FlagBy className={className} />;
  }
  return <FlagUk className={className} />;
}

export function GuideLangSwitch({
  lang,
  onLangChange,
}: {
  lang: InfoGuideLang;
  onLangChange: (lang: InfoGuideLang) => void;
}) {
  return (
    <div className="gazette-guide-langs" role="tablist" aria-label="Guide language">
      {INFO_GUIDE_LANGS.map((option) => {
        const isActive = lang === option.code;
        return (
          <button
            key={option.code}
            type="button"
            role="tab"
            aria-label={option.label}
            aria-selected={isActive}
            className={cn("gazette-guide-lang-tab", isActive && "gazette-guide-lang-tab-active")}
            onClick={() => onLangChange(option.code)}
          >
            <LangFlag lang={option.code} className="gazette-guide-flag" />
          </button>
        );
      })}
    </div>
  );
}
