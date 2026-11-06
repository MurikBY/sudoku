export const GRID_SIDE = 9;
export const CELL_COUNT = GRID_SIDE * GRID_SIDE;
export const EMPTY_CELL = "0";

export function cellIndex(row: number, col: number): number {
  return row * GRID_SIDE + col;
}

export function rowCol(index: number): { row: number; col: number } {
  return { row: Math.floor(index / GRID_SIDE), col: index % GRID_SIDE };
}

export function boxIndex(row: number, col: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

function rowCellIndices(row: number): number[] {
  return Array.from({ length: GRID_SIDE }, (_, col) => cellIndex(row, col));
}

function colCellIndices(col: number): number[] {
  return Array.from({ length: GRID_SIDE }, (_, row) => cellIndex(row, col));
}

function boxCellIndices(box: number): number[] {
  const boxRow = Math.floor(box / 3) * 3;
  const boxCol = (box % 3) * 3;
  const indices: number[] = [];
  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let colOffset = 0; colOffset < 3; colOffset += 1) {
      indices.push(cellIndex(boxRow + rowOffset, boxCol + colOffset));
    }
  }
  return indices;
}

export type UnitKey = `row:${number}` | `col:${number}` | `box:${number}`;

export function cellIndicesForUnitKey(unitKey: UnitKey): number[] {
  const [unitType, unitIndexText] = unitKey.split(":");
  const unitIndex = Number(unitIndexText);
  if (unitType === "row") {
    return rowCellIndices(unitIndex);
  }
  if (unitType === "col") {
    return colCellIndices(unitIndex);
  }
  return boxCellIndices(unitIndex);
}

function isUnitComplete(
  indices: readonly number[],
  grid: string,
  conflictIndices: ReadonlySet<number>,
  wrongDigitIndices: ReadonlySet<number>,
): boolean {
  for (const index of indices) {
    if (grid[index] === EMPTY_CELL) {
      return false;
    }
    if (conflictIndices.has(index) || wrongDigitIndices.has(index)) {
      return false;
    }
  }
  return true;
}

export function completedUnitKeys(
  grid: string,
  conflictIndices: ReadonlySet<number>,
  wrongDigitIndices: ReadonlySet<number>,
): Set<UnitKey> {
  const keys = new Set<UnitKey>();
  for (let row = 0; row < GRID_SIDE; row += 1) {
    const key: UnitKey = `row:${row}`;
    if (isUnitComplete(rowCellIndices(row), grid, conflictIndices, wrongDigitIndices)) {
      keys.add(key);
    }
  }
  for (let col = 0; col < GRID_SIDE; col += 1) {
    const key: UnitKey = `col:${col}`;
    if (isUnitComplete(colCellIndices(col), grid, conflictIndices, wrongDigitIndices)) {
      keys.add(key);
    }
  }
  for (let box = 0; box < GRID_SIDE; box += 1) {
    const key: UnitKey = `box:${box}`;
    if (isUnitComplete(boxCellIndices(box), grid, conflictIndices, wrongDigitIndices)) {
      keys.add(key);
    }
  }
  return keys;
}

export function peerIndices(index: number): number[] {
  const { row, col } = rowCol(index);
  const peers = new Set<number>();

  for (let column = 0; column < GRID_SIDE; column += 1) {
    peers.add(cellIndex(row, column));
  }
  for (let rowIndex = 0; rowIndex < GRID_SIDE; rowIndex += 1) {
    peers.add(cellIndex(rowIndex, col));
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let colOffset = 0; colOffset < 3; colOffset += 1) {
      peers.add(cellIndex(boxRow + rowOffset, boxCol + colOffset));
    }
  }

  peers.delete(index);
  return [...peers];
}

export function isGivenCell(puzzle: string, index: number): boolean {
  return puzzle[index] !== EMPTY_CELL;
}

export function cellDisplayValue(currentGrid: string, index: number): string {
  const value = currentGrid[index];
  return value === EMPTY_CELL ? "" : value;
}

export function isBoxBorderRight(col: number): boolean {
  return col === 2 || col === 5;
}

export function isBoxBorderBottom(row: number): boolean {
  return row === 2 || row === 5;
}

export function isGridFilled(grid: string): boolean {
  return !grid.includes(EMPTY_CELL);
}

export function cellDigitValue(grid: string, index: number): number | null {
  const value = grid[index];
  if (value === EMPTY_CELL) {
    return null;
  }
  return Number(value);
}

export function wrongDigitIndices(
  playerGrid: string,
  puzzle: string,
  solution: string,
): Set<number> {
  if (
    playerGrid.length !== CELL_COUNT ||
    puzzle.length !== CELL_COUNT ||
    solution.length !== CELL_COUNT
  ) {
    throw new Error("grid length must be 81");
  }
  const wrong = new Set<number>();
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (puzzle[index] !== EMPTY_CELL) {
      continue;
    }
    const playerValue = playerGrid[index];
    if (playerValue !== EMPTY_CELL && playerValue !== solution[index]) {
      wrong.add(index);
    }
  }
  return wrong;
}

export function isCorrectDigitLocked(
  puzzle: string,
  grid: string,
  index: number,
  wrongDigitIndices: ReadonlySet<number>,
  mistakeFeedback: boolean,
): boolean {
  if (!mistakeFeedback) {
    return false;
  }
  if (isGivenCell(puzzle, index)) {
    return false;
  }
  if (cellDigitValue(grid, index) === null) {
    return false;
  }
  return !wrongDigitIndices.has(index);
}

export function sameDigitIndices(grid: string, digit: number): number[] {
  const digitChar = String(digit);
  const indices: number[] = [];
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (grid[index] === digitChar) {
      indices.push(index);
    }
  }
  return indices;
}

export function completedDigits(
  grid: string,
  conflictIndices: ReadonlySet<number>,
  wrongDigitIndices: ReadonlySet<number>,
): Set<number> {
  const completed = new Set<number>();
  for (let digit = 1; digit <= GRID_SIDE; digit += 1) {
    const indices = sameDigitIndices(grid, digit);
    if (indices.length !== GRID_SIDE) {
      continue;
    }
    const hasError = indices.some(
      (index) => conflictIndices.has(index) || wrongDigitIndices.has(index),
    );
    if (!hasError) {
      completed.add(digit);
    }
  }
  return completed;
}

export type CellNotesMap = Record<string, number[]>;

export function notesForCell(notes: CellNotesMap, index: number): number[] {
  return notes[String(index)] ?? [];
}

export function noteDigitIndices(notes: CellNotesMap, grid: string, digit: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (cellDigitValue(grid, index) !== null) {
      continue;
    }
    if (notesForCell(notes, index).includes(digit)) {
      indices.push(index);
    }
  }
  return indices;
}

export function toggleNoteDigit(digits: readonly number[], digit: number): number[] {
  if (digit < 1 || digit > 9) {
    throw new Error(`note digit out of range: ${digit}`);
  }
  if (digits.includes(digit)) {
    return digits.filter((value) => value !== digit);
  }
  return [...digits, digit].sort((left, right) => left - right);
}

export function addNoteDigit(digits: readonly number[], digit: number): number[] {
  if (digit < 1 || digit > 9) {
    throw new Error(`note digit out of range: ${digit}`);
  }
  if (digits.includes(digit)) {
    return [...digits];
  }
  return [...digits, digit].sort((left, right) => left - right);
}
