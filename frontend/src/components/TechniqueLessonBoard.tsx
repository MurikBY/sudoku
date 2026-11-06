import type { TaughtLessonSnapshot } from "@/api/types";
import { SudokuGrid } from "@/components/SudokuGrid";
import { taughtLessonHighlight } from "@/lib/play/taughtLessonHighlight";

type TechniqueLessonBoardProps = {
  snapshot: TaughtLessonSnapshot;
  label: string;
};

export function TechniqueLessonBoard({ snapshot, label }: TechniqueLessonBoardProps) {
  const highlight = taughtLessonHighlight(snapshot);
  return (
    <div className="gazette-guide-lesson-board" role="img" aria-label={label}>
      <SudokuGrid
        puzzle={snapshot.grid}
        currentGrid={snapshot.grid}
        notes={snapshot.notes}
        selectedIndex={null}
        highlightPeers={false}
        highlightSameDigit={false}
        coachOutlineIndices={highlight.outline}
        coachElimIndices={highlight.elim}
        coachHouses={highlight.houses}
        onSelectCell={() => {}}
      />
    </div>
  );
}
