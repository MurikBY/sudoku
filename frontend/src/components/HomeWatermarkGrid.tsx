import { CellNotesMarks } from "@/components/CellNotesMarks";
import { HOME_WATERMARK_NOTES, HOME_WATERMARK_PUZZLE } from "@/content/homeWatermarkGrid";
import { isBoxBorderBottom, isBoxBorderRight, rowCol } from "@/lib/play/sudokuGrid";
import { cn } from "@/lib/classNames";

function watermarkDigit(index: number): number | null {
  const digit = HOME_WATERMARK_PUZZLE[index];
  if (digit === "." || digit === "0") {
    return null;
  }
  return Number(digit);
}

export function HomeWatermarkGrid() {
  return (
    <div className="home-watermark" aria-hidden="true">
      <div className="home-watermark-grid-frame sudoku-grid-frame">
        <div className="sudoku-grid">
          {Array.from({ length: 81 }, (_, index) => {
            const given = watermarkDigit(index);
            const notes = HOME_WATERMARK_NOTES[index];
            const { row, col } = rowCol(index);
            return (
              <div
                key={index}
                className={cn(
                  "sudoku-grid-cell home-watermark-cell",
                  given !== null && "sudoku-grid-cell-given",
                  isBoxBorderRight(col) && "sudoku-grid-cell-box-border-r",
                  isBoxBorderBottom(row) && "sudoku-grid-cell-box-border-b",
                )}
              >
                {given !== null ? given : notes ? <CellNotesMarks digits={notes} /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
