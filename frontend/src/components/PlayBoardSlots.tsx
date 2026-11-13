import type { PointerEvent as ReactPointerEvent } from "react";

import type { Game } from "@/api/types";
import { CoachHintCard } from "@/components/CoachHintCard";
import { NumberPad } from "@/components/NumberPad";
import { SudokuGrid } from "@/components/SudokuGrid";
import type { usePlayBoardSession } from "@/hooks/usePlayBoardSession";
import {
  coachElimCells,
  coachHintText,
  coachMaxLevel,
  coachOutlineCells,
} from "@/content/coachHintCopy";
import type { GameAssists } from "@/lib/play/gameSettings";
import type { InfoGuideLang } from "@/content/infoGuideCopy";

const GRID_HOUSE_CONFLICT_INDICES: ReadonlySet<number> = new Set();

export type PlayBoardSession = ReturnType<typeof usePlayBoardSession>;

export type BoardFlashes = {
  animatedMistakeIndex: number | null;
  hintedCellIndex: number | null;
  flashedCellIndices: ReadonlySet<number>;
  celebratingIndices: ReadonlySet<number>;
};

type BoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => void;

function coachCells(session: PlayBoardSession): {
  outline: ReadonlySet<number>;
  elim: ReadonlySet<number>;
} {
  if (!session.coachOpen || session.coachEpisode === null) {
    return { outline: new Set(), elim: new Set() };
  }
  const { hint, level } = session.coachEpisode;
  return {
    outline: new Set(coachOutlineCells(hint, level)),
    elim: new Set(coachElimCells(hint, level)),
  };
}

type PlayBoardGridProps = {
  game: Game;
  assists: GameAssists;
  session: PlayBoardSession;
  selectedIndex: number | null;
  flashes: BoardFlashes;
  onPointerDown: BoardPointerDown;
};

export function PlayBoardGrid({
  game,
  assists,
  session,
  selectedIndex,
  flashes,
  onPointerDown,
}: PlayBoardGridProps) {
  const coach = coachCells(session);
  return (
    <div className="gazette-play-grid-slot" onPointerDown={onPointerDown}>
      <SudokuGrid
        puzzle={game.puzzle}
        currentGrid={game.current_grid}
        notes={game.notes}
        selectedIndex={selectedIndex}
        conflictIndices={GRID_HOUSE_CONFLICT_INDICES}
        wrongDigitIndices={session.visibleWrongDigitIndices}
        animatedMistakeIndex={assists.mistakeFeedback ? flashes.animatedMistakeIndex : null}
        hintedCellIndex={flashes.hintedCellIndex}
        flashedCellIndices={flashes.flashedCellIndices}
        coachOutlineIndices={coach.outline}
        coachElimIndices={coach.elim}
        celebratingIndices={assists.unitCompleteAnimation ? flashes.celebratingIndices : new Set()}
        pencilActive={session.isPencilMode}
        highlightPeers={assists.highlightPeers}
        highlightSameDigit={assists.highlightSameDigit}
        stickyDigit={assists.stickyDigit ? session.stickyDigit : null}
        notePaintEnabled={session.notePaintEnabled}
        onSelectCell={session.handleSelectCell}
        onPaintCell={session.notePaintEnabled ? session.handlePaintNoteCell : undefined}
        onDigit={(digit) => void session.handlePick(digit)}
        onClear={() => void session.handleClear()}
      />
    </div>
  );
}

type PlayBoardPadProps = {
  assists: GameAssists;
  session: PlayBoardSession;
  isPlaying: boolean;
  lang: InfoGuideLang;
  onPointerDown: BoardPointerDown;
};

export function PlayBoardPad({
  assists,
  session,
  isPlaying,
  lang,
  onPointerDown,
}: PlayBoardPadProps) {
  const episode = session.coachOpen ? session.coachEpisode : null;
  return (
    <div
      className="gazette-play-pad-slot"
      onPointerDown={(event) => {
        onPointerDown(event);
        session.dismissCoachCard();
      }}
    >
      {episode !== null && (
        <CoachHintCard
          lang={lang}
          text={coachHintText(episode.hint, episode.level, lang)}
          warn={episode.hint.kind === "notes"}
          canStrengthen={episode.level < coachMaxLevel(episode.hint)}
          onStrengthen={session.handleStrengthenHint}
          onClose={session.dismissCoachCard}
        />
      )}
      <NumberPad
        disabled={!isPlaying || session.isBusy}
        pencilActive={session.isPencilMode}
        activeDigit={session.activeDigit}
        stickyDigit={assists.stickyDigit ? session.stickyDigit : null}
        stickyEnabled={assists.stickyDigit}
        noteDigits={session.noteDigits}
        completedDigits={session.padCompletedDigits}
        onPick={(digit) => void session.handlePick(digit)}
        onStickyDigit={session.handleStickyDigit}
      />
    </div>
  );
}
