import { X } from "lucide-react";

import type { CompletionRecap, Difficulty } from "@/api/types";
import { AssistsDetailGroups } from "@/components/AssistsDetailGroups";
import { LabeledMetric } from "@/components/LabeledMetric";
import { formatOptionalElapsedSeconds } from "@/lib/format/formatElapsedSeconds";
import type { GameAssists } from "@/lib/play/gameSettings";

type CompletionCardProps = {
  difficulty: Difficulty;
  formattedElapsed: string;
  mistakesCount: number;
  hintsCount: number;
  pencilCount: number;
  completion: CompletionRecap;
  assists: GameAssists;
  onClose: () => void;
  onOpenRating: () => void;
  onPartyResults?: () => void;
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function CompletionCard({
  difficulty,
  formattedElapsed,
  mistakesCount,
  hintsCount,
  pencilCount,
  completion,
  assists,
  onClose,
  onOpenRating,
  onPartyResults,
}: CompletionCardProps) {
  const difficultyLabel = DIFFICULTY_LABEL[difficulty];
  const ratingMove = ratingMoveCopy(difficultyLabel, completion);

  return (
    <article className="completion-card completion-card-enter space-y-5 border border-[color-mix(in_oklch,var(--rule)_40%,transparent)] px-5 py-6 text-center">
      <button type="button" className="completion-card-close" aria-label="Close" onClick={onClose}>
        <X className="size-4" strokeWidth={1.75} />
      </button>
      <header className="space-y-1">
        {ratingMove !== null && (
          <p className="font-display text-base font-semibold italic tracking-tight text-primary">
            {ratingMove}
          </p>
        )}
        <h2 className="font-display text-3xl font-bold italic tracking-tight text-primary">
          Puzzle solved
        </h2>
        <hr className="gazette-rule-double mx-auto mt-3 w-24" />
        <p className="pt-2 text-sm text-muted-foreground">
          Difficulty: <span className="capitalize">{difficulty}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {completion.clean ? "Clean win" : "Not a clean win"}
        </p>
      </header>

      <div className="mx-auto flex max-w-xs justify-center gap-6 font-mono text-sm">
        <LabeledMetric layout="stacked" label="Time" value={formattedElapsed} />
        <LabeledMetric layout="stacked" label="Mistakes" value={mistakesCount} />
        <LabeledMetric layout="stacked" label="Hints" value={hintsCount} />
        <LabeledMetric layout="stacked" label="Pencil" value={pencilCount} />
      </div>

      <div className="mx-auto space-y-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
        <p>
          Your clean average – {formatOptionalElapsedSeconds(completion.your_avg_clean_seconds)}
        </p>
        <p>
          All clean average – {formatOptionalElapsedSeconds(completion.global_avg_clean_seconds)}
        </p>
      </div>

      <div className="mx-auto w-full max-w-sm">
        <AssistsDetailGroups assists={assists} />
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          className="font-mono text-[0.82rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary"
          onClick={onOpenRating}
        >
          Go to Rating
        </button>
        {onPartyResults && (
          <button
            type="button"
            className="font-mono text-[0.82rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary"
            onClick={onPartyResults}
          >
            Party results
          </button>
        )}
      </div>
    </article>
  );
}

function ratingMoveCopy(difficultyLabel: string, recap: CompletionRecap): string | null {
  if (recap.rating_rank === null || recap.rating_rank === recap.previous_rating_rank) {
    return null;
  }
  if (recap.previous_rating_rank === null) {
    return `Entered ${difficultyLabel} rating at #${recap.rating_rank}`;
  }
  return `Moved to #${recap.rating_rank} in ${difficultyLabel} rating (from #${recap.previous_rating_rank})`;
}
