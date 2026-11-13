import type { CellNotesMap } from "@/api/types";
import { SudokuGridCell, type CellState } from "@/components/SudokuGridCell";
import { useNotePaintPointer } from "@/hooks/useNotePaintPointer";
import {
  cellDigitValue,
  cellDisplayValue,
  isGivenCell,
  noteDigitIndices,
  notesForCell,
  peerIndices,
  sameDigitIndices,
} from "@/lib/play/sudokuGrid";
import { cn } from "@/lib/classNames";

const EMPTY_INDEX_SET: ReadonlySet<number> = new Set();
const EMPTY_NOTES: CellNotesMap = {};
const NO_HOUSES: readonly CoachHouse[] = [];

type CoachHouse = { kind: "row" | "col" | "box"; index: number };

type SudokuGridProps = {
  puzzle: string;
  currentGrid: string;
  notes?: CellNotesMap;
  selectedIndex: number | null;
  stickyDigit?: number | null;
  conflictIndices?: ReadonlySet<number>;
  wrongDigitIndices?: ReadonlySet<number>;
  celebratingIndices?: ReadonlySet<number>;
  animatedMistakeIndex?: number | null;
  hintedCellIndex?: number | null;
  flashedCellIndices?: ReadonlySet<number>;
  coachOutlineIndices?: ReadonlySet<number>;
  coachElimIndices?: ReadonlySet<number>;
  coachHouses?: readonly CoachHouse[];
  pencilActive?: boolean;
  highlightPeers?: boolean;
  highlightSameDigit?: boolean;
  notePaintEnabled?: boolean;
  onSelectCell: (index: number) => void;
  onPaintCell?: (index: number) => void;
  onDigit?: (digit: number) => void;
  onClear?: () => void;
};

type Highlights = {
  focusDigit: number | null;
  peers: ReadonlySet<number>;
  sameDigit: ReadonlySet<number>;
  sameNote: ReadonlySet<number>;
};

type ResolvedGridProps = SudokuGridProps &
  Required<
    Pick<
      SudokuGridProps,
      | "notes"
      | "stickyDigit"
      | "conflictIndices"
      | "wrongDigitIndices"
      | "celebratingIndices"
      | "animatedMistakeIndex"
      | "hintedCellIndex"
      | "coachOutlineIndices"
      | "coachElimIndices"
      | "coachHouses"
      | "pencilActive"
      | "highlightPeers"
      | "highlightSameDigit"
      | "notePaintEnabled"
    >
  >;

function resolveGridProps(props: SudokuGridProps): ResolvedGridProps {
  return {
    ...props,
    notes: props.notes ?? EMPTY_NOTES,
    stickyDigit: props.stickyDigit ?? null,
    conflictIndices: props.conflictIndices ?? EMPTY_INDEX_SET,
    wrongDigitIndices: props.wrongDigitIndices ?? EMPTY_INDEX_SET,
    celebratingIndices: props.celebratingIndices ?? EMPTY_INDEX_SET,
    animatedMistakeIndex: props.animatedMistakeIndex ?? null,
    hintedCellIndex: props.hintedCellIndex ?? null,
    coachOutlineIndices: props.coachOutlineIndices ?? EMPTY_INDEX_SET,
    coachElimIndices: props.coachElimIndices ?? EMPTY_INDEX_SET,
    coachHouses: props.coachHouses ?? NO_HOUSES,
    pencilActive: props.pencilActive ?? false,
    highlightPeers: props.highlightPeers ?? true,
    highlightSameDigit: props.highlightSameDigit ?? true,
    notePaintEnabled: props.notePaintEnabled ?? false,
  };
}

function boardHighlights(grid: ResolvedGridProps): Highlights {
  const { currentGrid, selectedIndex, notes, stickyDigit } = grid;
  const peers =
    !grid.highlightPeers || selectedIndex === null
      ? new Set<number>()
      : new Set(peerIndices(selectedIndex));
  const selectedDigit = selectedIndex === null ? null : cellDigitValue(currentGrid, selectedIndex);
  const focusDigit = stickyDigit ?? selectedDigit;
  const showSame = grid.highlightSameDigit && focusDigit !== null;
  return {
    focusDigit,
    peers,
    sameDigit: showSame ? new Set(sameDigitIndices(currentGrid, focusDigit)) : new Set<number>(),
    sameNote: showSame
      ? new Set(noteDigitIndices(notes, currentGrid, focusDigit))
      : new Set<number>(),
  };
}

function cellStateAt(grid: ResolvedGridProps, highlights: Highlights, index: number): CellState {
  const isGiven = isGivenCell(grid.puzzle, index);
  const isSelected = grid.selectedIndex === index;
  const isCoachOutline = grid.coachOutlineIndices.has(index);
  return {
    isGiven,
    isSelected,
    isPeer: highlights.peers.has(index),
    isSameDigit: highlights.sameDigit.has(index),
    isSameNote: highlights.sameNote.has(index),
    isConflict: grid.conflictIndices.has(index),
    isWrong: grid.wrongDigitIndices.has(index),
    isCelebrating: grid.celebratingIndices.has(index),
    isAnimatedMistake: grid.animatedMistakeIndex === index,
    isHintFlash: grid.hintedCellIndex === index || (grid.flashedCellIndices?.has(index) ?? false),
    isCoachOutline,
    isCoachElim: !isCoachOutline && grid.coachElimIndices.has(index),
    showPencilMark: grid.pencilActive && isSelected && !isGiven,
    notes: notesForCell(grid.notes, index),
    digitDisplay: cellDisplayValue(grid.currentGrid, index),
  };
}

export function SudokuGrid(props: SudokuGridProps) {
  const grid = resolveGridProps(props);
  const { notePaintEnabled, onSelectCell, onPaintCell } = grid;
  const pointer = useNotePaintPointer({ notePaintEnabled, onSelectCell, onPaintCell });
  const highlights = boardHighlights(grid);

  return (
    <div
      className={cn(
        "sudoku-grid-frame",
        grid.pencilActive && "sudoku-grid-frame-pencil-mode",
        notePaintEnabled && "sudoku-grid-frame-note-paint",
      )}
    >
      <div className="sudoku-grid" role="group" aria-label="Sudoku board" {...pointer}>
        {Array.from({ length: 81 }, (_, index) => (
          <SudokuGridCell
            key={index}
            index={index}
            state={cellStateAt(grid, highlights, index)}
            selectedIndex={grid.selectedIndex}
            focusDigit={highlights.focusDigit}
            onSelectCell={onSelectCell}
            onDigit={grid.onDigit}
            onClear={grid.onClear}
          />
        ))}
        {grid.coachHouses.map((house) => (
          <div
            key={`${house.kind}-${house.index}`}
            className="sudoku-grid-coach-house-ring"
            style={coachHouseRingStyle(house)}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

function coachHouseRingStyle(house: CoachHouse): {
  top: string;
  left: string;
  width: string;
  height: string;
} {
  const cell = 100 / 9;
  if (house.kind === "row") {
    return {
      top: `${house.index * cell}%`,
      left: "0%",
      width: "100%",
      height: `${cell}%`,
    };
  }
  if (house.kind === "col") {
    return {
      top: "0%",
      left: `${house.index * cell}%`,
      width: `${cell}%`,
      height: "100%",
    };
  }
  const bandRow = Math.floor(house.index / 3);
  const bandCol = house.index % 3;
  return {
    top: `${bandRow * 3 * cell}%`,
    left: `${bandCol * 3 * cell}%`,
    width: `${3 * cell}%`,
    height: `${3 * cell}%`,
  };
}
