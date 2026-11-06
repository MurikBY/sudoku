import type { CellNotesMap, Difficulty } from "@/api/types";
import { CELL_COUNT, EMPTY_CELL, GRID_SIDE, cellIndex, notesForCell } from "@/lib/play/sudokuGrid";

const PUZZLE_EXPORT_FORMAT = "sudoku-export-v1";

export type PuzzleExport = {
  format: typeof PUZZLE_EXPORT_FORMAT;
  share_code: string;
  difficulty: Difficulty;
  puzzle: string;
  grid: string;
  notes: Record<string, number[]>;
  board: string;
};

function requireGrid(grid: string, field: string): string {
  if (grid.length !== CELL_COUNT) {
    throw new Error(`${field} must be ${CELL_COUNT} characters`);
  }
  for (const char of grid) {
    if (char < "0" || char > "9") {
      throw new Error(`${field} has invalid character: ${char}`);
    }
  }
  return grid;
}

function notesForExport(notes: CellNotesMap, grid: string): Record<string, number[]> {
  requireGrid(grid, "grid");
  const exported: Record<string, number[]> = {};
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (grid[index] !== EMPTY_CELL) {
      continue;
    }
    const rawDigits = notesForCell(notes, index);
    for (const digit of rawDigits) {
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) {
        throw new Error(`note digit out of range at cell ${index}: ${digit}`);
      }
    }
    const digits = [...new Set(rawDigits)].sort((left, right) => left - right);
    if (digits.length === 0) {
      continue;
    }
    exported[String(index)] = digits;
  }
  return exported;
}

function formatExportBoard(grid: string): string {
  requireGrid(grid, "grid");
  const rows: string[] = [];
  for (let row = 0; row < GRID_SIDE; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < GRID_SIDE; col += 1) {
      const digit = grid[cellIndex(row, col)];
      cells.push(digit === EMPTY_CELL ? "." : digit);
      if (col === 2 || col === 5) {
        cells.push("|");
      }
    }
    rows.push(cells.join(" "));
    if (row === 2 || row === 5) {
      rows.push("------+-------+------");
    }
  }
  return rows.join("\n");
}

export function buildPuzzleExport(input: {
  shareCode: string;
  difficulty: Difficulty;
  puzzle: string;
  grid: string;
  notes: CellNotesMap;
}): PuzzleExport {
  const shareCode = input.shareCode.trim();
  if (shareCode.length === 0) {
    throw new Error("share_code required");
  }
  const puzzle = requireGrid(input.puzzle, "puzzle");
  const grid = requireGrid(input.grid, "grid");
  return {
    format: PUZZLE_EXPORT_FORMAT,
    share_code: shareCode,
    difficulty: input.difficulty,
    puzzle,
    grid,
    notes: notesForExport(input.notes, grid),
    board: formatExportBoard(grid),
  };
}

function compactNotesJson(notes: Record<string, number[]>): string {
  const entries = Object.entries(notes).map(
    ([cell, digits]) => `${JSON.stringify(cell)}: [${digits.join(", ")}]`,
  );
  return `{${entries.join(", ")}}`;
}

export function puzzleExportJson(payload: PuzzleExport): string {
  const notesJson = compactNotesJson(payload.notes);
  return `{
  "format": ${JSON.stringify(payload.format)},
  "share_code": ${JSON.stringify(payload.share_code)},
  "difficulty": ${JSON.stringify(payload.difficulty)},
  "puzzle": ${JSON.stringify(payload.puzzle)},
  "grid": ${JSON.stringify(payload.grid)},
  "notes": ${notesJson},
  "board": ${JSON.stringify(payload.board)}
}
`;
}
