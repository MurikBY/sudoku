import { cn } from "@/lib/classNames";

type CellNotesMarksProps = {
  digits: readonly number[];
  accentDigit?: number | null;
  className?: string;
};

export function CellNotesMarks({ digits, accentDigit = null, className }: CellNotesMarksProps) {
  if (digits.length === 0) {
    return null;
  }

  return (
    <span className={cn("sudoku-cell-notes", className)}>
      {Array.from({ length: 9 }, (_, slot) => {
        const digit = slot + 1;
        const isPresent = digits.includes(digit);
        const isAccent = isPresent && accentDigit === digit;
        return (
          <span
            key={digit}
            className={cn("sudoku-cell-notes-mark", isAccent && "sudoku-cell-notes-mark-accent")}
          >
            {isPresent ? digit : ""}
          </span>
        );
      })}
    </span>
  );
}
