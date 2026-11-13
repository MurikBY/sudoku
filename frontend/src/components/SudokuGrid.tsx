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

type HighlightInputs = {
  currentGrid: string;
  selectedIndex: number | null;
  notes: CellNotesMap;
  stickyDigit: number | null;
  highlightPeers: boolean;
  highlightSameDigit: boolean;
};

function boardHighlights(inputs: HighlightInputs): Highlights {
  const { currentGrid, selectedIndex, notes, stickyDigit } = inputs;
  const peers =
    !inputs.highlightPeers || selectedIndex === null
      ? new Set<number>()
      : new Set(peerIndices(selectedIndex));
  const selectedDigit = selectedIndex === null ? null : cellDigitValue(currentGrid, selectedIndex);
  const focusDigit = stickyDigit ?? selectedDigit;
  const showSame = inputs.highlightSameDigit && focusDigit !== null;
  return {
    focusDigit,
    peers,
    sameDigit: showSame ? new Set(sameDigitIndices(currentGrid, focusDigit)) : new Set<number>(),
    sameNote: showSame
      ? new Set(noteDigitIndices(notes, currentGrid, focusDigit))
      : new Set<number>(),
  };
}

export function SudokuGrid({
  puzzle,
  currentGrid,
  notes = EMPTY_NOTES,
  selectedIndex,
  stickyDigit = null,
  conflictIndices = EMPTY_INDEX_SET,
  wrongDigitIndices = EMPTY_INDEX_SET,
  celebratingIndices = EMPTY_INDEX_SET,
  animatedMistakeIndex = null,
  hintedCellIndex = null,
  flashedCellIndices,
  coachOutlineIndices = EMPTY_INDEX_SET,
  coachElimIndices = EMPTY_INDEX_SET,
  coachHouses = NO_HOUSES,
  pencilActive = false,
  highlightPeers = true,
  highlightSameDigit = true,
  notePaintEnabled = false,
  onSelectCell,
  onPaintCell,
  onDigit,
  onClear,
}: SudokuGridProps) {
  const pointer = useNotePaintPointer({ notePaintEnabled, onSelectCell, onPaintCell });
  const highlights = boardHighlights({
    currentGrid,
    selectedIndex,
    notes,
    stickyDigit,
    highlightPeers,
    highlightSameDigit,
  });

  const cellState = (index: number): CellState => {
    const isGiven = isGivenCell(puzzle, index);
    const isSelected = selectedIndex === index;
    const isCoachOutline = coachOutlineIndices.has(index);
    return {
      isGiven,
      isSelected,
      isPeer: highlights.peers.has(index),
      isSameDigit: highlights.sameDigit.has(index),
      isSameNote: highlights.sameNote.has(index),
      isConflict: conflictIndices.has(index),
      isWrong: wrongDigitIndices.has(index),
      isCelebrating: celebratingIndices.has(index),
      isAnimatedMistake: animatedMistakeIndex === index,
      isHintFlash: hintedCellIndex === index || (flashedCellIndices?.has(index) ?? false),
      isCoachOutline,
      isCoachElim: !isCoachOutline && coachElimIndices.has(index),
      showPencilMark: pencilActive && isSelected && !isGiven,
      notes: notesForCell(notes, index),
      digitDisplay: cellDisplayValue(currentGrid, index),
    };
  };

  return (
    <div
      className={cn(
        "sudoku-grid-frame",
        pencilActive && "sudoku-grid-frame-pencil-mode",
        notePaintEnabled && "sudoku-grid-frame-note-paint",
      )}
    >
      <div className="sudoku-grid" role="group" aria-label="Sudoku board" {...pointer}>
        {Array.from({ length: 81 }, (_, index) => (
          <SudokuGridCell
            key={index}
            index={index}
            state={cellState(index)}
            selectedIndex={selectedIndex}
            focusDigit={highlights.focusDigit}
            onSelectCell={onSelectCell}
            onDigit={onDigit}
            onClear={onClear}
          />
        ))}
        {coachHouses.map((house) => (
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
