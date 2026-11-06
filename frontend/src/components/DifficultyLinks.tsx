import type { Difficulty } from "@/api/types";
import { cn } from "@/lib/classNames";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

type DifficultyLinksProps = {
  difficulty: Difficulty;
  readOnly?: boolean;
  onDifficultyChange?: (difficulty: Difficulty) => void;
  className?: string;
};

export function DifficultyLinks({
  difficulty,
  readOnly = false,
  onDifficultyChange,
  className,
}: DifficultyLinksProps) {
  if (!readOnly && onDifficultyChange === undefined) {
    throw new Error("onDifficultyChange is required when difficulty links are editable");
  }

  return (
    <div className={cn("home-difficulty-row", className)}>
      {DIFFICULTIES.map((level, index) => (
        <span key={level} className="inline-flex items-center">
          {index > 0 && (
            <span className="home-difficulty-sep" aria-hidden="true">
              •
            </span>
          )}
          <button
            type="button"
            disabled={readOnly}
            onClick={
              readOnly || onDifficultyChange === undefined
                ? undefined
                : () => onDifficultyChange(level)
            }
            className={cn(
              "home-difficulty-link",
              difficulty === level && "home-difficulty-link-active",
            )}
          >
            {level}
          </button>
        </span>
      ))}
    </div>
  );
}
