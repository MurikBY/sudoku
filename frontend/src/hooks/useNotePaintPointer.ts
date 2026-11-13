import { useRef, type PointerEvent as ReactPointerEvent } from "react";

type NotePaintStroke = {
  pointerId: number;
  startIndex: number | null;
  painted: boolean;
  visited: Set<number>;
};

type GridPointerEvent = ReactPointerEvent<HTMLDivElement>;

function cellIndexFromPoint(clientX: number, clientY: number): number | null {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!(hit instanceof Element)) {
    return null;
  }
  const cell = hit.closest("[data-cell-index]");
  if (!(cell instanceof HTMLElement)) {
    return null;
  }
  const rawIndex = cell.dataset.cellIndex;
  if (rawIndex === undefined) {
    return null;
  }
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0 || index > 80) {
    return null;
  }
  return index;
}

function startsStroke(event: GridPointerEvent): boolean {
  if (!event.isPrimary) {
    return false;
  }
  return event.pointerType !== "mouse" || event.button === 0;
}

// Marks the cell visited and returns the cells to paint, in order. The first move
// over a new cell also paints the cell the stroke started on.
function cellsToPaintOnMove(stroke: NotePaintStroke, index: number): number[] {
  if (stroke.visited.has(index)) {
    return [];
  }
  stroke.visited.add(index);
  const cells: number[] = [];
  if (!stroke.painted) {
    stroke.painted = true;
    if (stroke.startIndex !== null) {
      cells.push(stroke.startIndex);
    }
  }
  if (index !== stroke.startIndex) {
    cells.push(index);
  }
  return cells;
}

function releaseCapture(event: GridPointerEvent) {
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

type UseNotePaintPointerArgs = {
  notePaintEnabled: boolean;
  onSelectCell: (index: number) => void;
  onPaintCell?: (index: number) => void;
};

// Selection happens on pointer up over a cell. With note paint on, a drag across cells
// paints each one once, and a press without a drag still selects the cell it started on.
export function useNotePaintPointer({
  notePaintEnabled,
  onSelectCell,
  onPaintCell,
}: UseNotePaintPointerArgs) {
  const strokeRef = useRef<NotePaintStroke | null>(null);

  const paintCell = (index: number) => {
    if (!onPaintCell) {
      throw new Error("onPaintCell required when note paint is enabled");
    }
    onPaintCell(index);
  };

  const endStroke = (event: GridPointerEvent) => {
    const stroke = strokeRef.current;
    if (stroke === null || stroke.pointerId !== event.pointerId) {
      return;
    }
    strokeRef.current = null;
    releaseCapture(event);
    if (!stroke.painted && stroke.startIndex !== null) {
      onSelectCell(stroke.startIndex);
    }
  };

  const onPointerDown = (event: GridPointerEvent) => {
    if (!notePaintEnabled || !startsStroke(event)) {
      return;
    }
    const index = cellIndexFromPoint(event.clientX, event.clientY);
    strokeRef.current = {
      pointerId: event.pointerId,
      startIndex: index,
      painted: false,
      visited: index === null ? new Set() : new Set([index]),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: GridPointerEvent) => {
    const stroke = strokeRef.current;
    if (stroke === null || stroke.pointerId !== event.pointerId) {
      return;
    }
    const index = cellIndexFromPoint(event.clientX, event.clientY);
    if (index === null) {
      return;
    }
    cellsToPaintOnMove(stroke, index).forEach(paintCell);
  };

  const onPointerUp = (event: GridPointerEvent) => {
    if (notePaintEnabled) {
      endStroke(event);
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const index = cellIndexFromPoint(event.clientX, event.clientY);
    if (index !== null) {
      onSelectCell(index);
    }
  };

  const onPointerCancel = (event: GridPointerEvent) => {
    if (!notePaintEnabled) {
      return;
    }
    strokeRef.current = null;
    releaseCapture(event);
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
