// @vitest-environment jsdom

import { useState, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SudokuGrid } from "@/components/SudokuGrid";

const EMPTY_GRID = "0".repeat(81);
const row3Column5 = 2 * 9 + 4;

function withDigit(index: number, digit: string): string {
  return `${EMPTY_GRID.slice(0, index)}${digit}${EMPTY_GRID.slice(index + 1)}`;
}

function renderBoard(overrides: Partial<ComponentProps<typeof SudokuGrid>> = {}): string {
  return renderToStaticMarkup(
    <SudokuGrid
      puzzle={EMPTY_GRID}
      currentGrid={EMPTY_GRID}
      selectedIndex={null}
      onSelectCell={() => undefined}
      {...overrides}
    />,
  );
}

function buttonOpenTags(markup: string): string[] {
  return [...markup.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
}

function setupUser() {
  return userEvent.setup({ delay: null });
}

// jsdom does not implement elementFromPoint, and the board selects from that hit test.
function hitTestCell(cell: HTMLElement) {
  document.elementFromPoint = () => cell;
}

function ControlledBoard({ onDigit }: { onDigit?: (digit: number) => void }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  return (
    <SudokuGrid
      puzzle={EMPTY_GRID}
      currentGrid={EMPTY_GRID}
      selectedIndex={selectedIndex}
      onSelectCell={setSelectedIndex}
      onDigit={onDigit}
    />
  );
}

afterEach(() => {
  Reflect.deleteProperty(document, "elementFromPoint");
});

describe("SudokuGrid labels", () => {
  it("exposes one labelled group of 81 cells", () => {
    const markup = renderBoard();
    const buttons = buttonOpenTags(markup);

    expect(markup.match(/role="group"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Sudoku board"');
    expect(buttons).toHaveLength(81);
    expect(buttons[0]).toContain('aria-label="Row 1, column 1, empty"');
  });

  it("names a given digit, a player digit, and notes in ascending order", () => {
    const filled = withDigit(row3Column5, "7");
    const given = buttonOpenTags(renderBoard({ puzzle: filled, currentGrid: filled }));
    const played = buttonOpenTags(renderBoard({ currentGrid: filled }));
    const noted = buttonOpenTags(renderBoard({ notes: { 0: [9, 1, 4] } }));

    expect(given[row3Column5]).toContain('aria-label="Row 3, column 5, 7, given"');
    expect(played[row3Column5]).toContain('aria-label="Row 3, column 5, 7"');
    expect(noted[0]).toContain('aria-label="Row 1, column 1, empty, notes 1 4 9"');
  });

  it("keeps one tab stop, on the selected cell or the first cell", () => {
    const idle = buttonOpenTags(renderBoard());
    expect(idle.filter((tag) => tag.includes('tabindex="0"'))).toHaveLength(1);
    expect(idle[0]).toContain('tabindex="0"');
    expect(idle[0]).toContain('aria-pressed="false"');
    expect(idle[1]).toContain('tabindex="-1"');

    const selected = buttonOpenTags(renderBoard({ selectedIndex: row3Column5 }));
    expect(selected.filter((tag) => tag.includes('tabindex="0"'))).toHaveLength(1);
    expect(selected[row3Column5]).toContain('tabindex="0"');
    expect(selected[row3Column5]).toContain('aria-pressed="true"');
    expect(selected[0]).toContain('tabindex="-1"');
    expect(selected[0]).toContain('aria-pressed="false"');
  });
});

describe("SudokuGrid interaction", () => {
  it("moves the selection with the arrow keys", async () => {
    const user = setupUser();
    render(<ControlledBoard />);
    screen.getByRole("button", { name: "Row 1, column 1, empty" }).focus();

    await user.keyboard("{ArrowRight}{ArrowDown}");

    const landed = screen.getByRole("button", { name: "Row 2, column 2, empty" });
    expect(landed).toHaveAttribute("aria-pressed", "true");
    expect(landed).toHaveFocus();
  });

  it("selects the cell a click hits", async () => {
    const user = setupUser();
    render(<ControlledBoard />);
    const cell = screen.getByRole("button", { name: "Row 3, column 5, empty" });
    hitTestCell(cell);

    await user.click(cell);

    expect(cell).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onDigit for a digit key", async () => {
    const user = setupUser();
    const onDigit = vi.fn();
    render(<ControlledBoard onDigit={onDigit} />);
    screen.getByRole("button", { name: "Row 1, column 1, empty" }).focus();

    await user.keyboard("6");

    expect(onDigit).toHaveBeenCalledExactlyOnceWith(6);
  });
});
