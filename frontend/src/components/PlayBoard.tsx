import type { PointerEvent as ReactPointerEvent } from "react";

import type { Game } from "@/api/types";
import { CoachHintCard } from "@/components/CoachHintCard";
import { GameActionBar } from "@/components/GameActionBar";
import { GameToolbar } from "@/components/GameToolbar";
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
import type { PlayMode } from "@/lib/play/playMode";
import type { InfoGuideLang } from "@/content/infoGuideCopy";

const GRID_HOUSE_CONFLICT_INDICES: ReadonlySet<number> = new Set();

type PlayBoardSession = ReturnType<typeof usePlayBoardSession>;

type PlayBoardProps = {
  game: Game;
  assists: GameAssists;
  session: PlayBoardSession;
  formattedElapsed: string;
  isPaused: boolean;
  isPlaying: boolean;
  selectedIndex: number | null;
  mode: PlayMode;
  lang: InfoGuideLang;
  animatedMistakeIndex: number | null;
  hintedCellIndex: number | null;
  flashedCellIndices: ReadonlySet<number>;
  celebratingIndices: ReadonlySet<number>;
};

export function PlayBoard({
  game,
  assists,
  session,
  formattedElapsed,
  isPaused,
  isPlaying,
  selectedIndex,
  mode,
  lang,
  animatedMistakeIndex,
  hintedCellIndex,
  flashedCellIndices,
  celebratingIndices,
}: PlayBoardProps) {
  const stopBoardClear = (event: ReactPointerEvent<HTMLDivElement>) => {
    session.stopBoardClearPropagation(event);
  };

  return (
    <>
      <div className="gazette-play-balance" aria-hidden="true" />
      <GameToolbar
        formattedElapsed={formattedElapsed}
        mistakesCount={game.mistakes_count}
        hintsCount={game.hints_count}
        showMistakes={assists.mistakeFeedback}
        isPaused={isPaused}
        mode={mode}
        stickyDigit={assists.stickyDigit ? session.stickyDigit : null}
        pencilActive={session.isPencilMode}
      />
      <div className="gazette-play-balance" aria-hidden="true" />
      <div className="gazette-play-grid-slot" onPointerDown={stopBoardClear}>
        <SudokuGrid
          puzzle={game.puzzle}
          currentGrid={game.current_grid}
          notes={game.notes}
          selectedIndex={selectedIndex}
          conflictIndices={GRID_HOUSE_CONFLICT_INDICES}
          wrongDigitIndices={session.visibleWrongDigitIndices}
          animatedMistakeIndex={assists.mistakeFeedback ? animatedMistakeIndex : null}
          hintedCellIndex={hintedCellIndex}
          flashedCellIndices={flashedCellIndices}
          coachOutlineIndices={
            session.coachOpen && session.coachEpisode !== null
              ? new Set(coachOutlineCells(session.coachEpisode.hint, session.coachEpisode.level))
              : new Set()
          }
          coachElimIndices={
            session.coachOpen && session.coachEpisode !== null
              ? new Set(coachElimCells(session.coachEpisode.hint, session.coachEpisode.level))
              : new Set()
          }
          celebratingIndices={assists.unitCompleteAnimation ? celebratingIndices : new Set()}
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
      <div className="gazette-play-balance" aria-hidden="true" />
      <div
        className="gazette-play-pad-slot"
        onPointerDown={(event) => {
          stopBoardClear(event);
          session.dismissCoachCard();
        }}
      >
        {session.coachOpen && session.coachEpisode !== null && (
          <CoachHintCard
            lang={lang}
            text={coachHintText(session.coachEpisode.hint, session.coachEpisode.level, lang)}
            warn={session.coachEpisode.hint.kind === "notes"}
            canStrengthen={session.coachEpisode.level < coachMaxLevel(session.coachEpisode.hint)}
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
      <div className="gazette-play-balance" aria-hidden="true" />
      <div className="gazette-play-actions-slot" onPointerDown={stopBoardClear}>
        <GameActionBar
          pencilActive={session.isPencilMode}
          onTogglePencil={session.handleTogglePencil}
          onClear={() => void session.handleClear()}
          onHint={() => void session.handleHint()}
          onUndo={() => void session.handleUndo()}
          canClear={session.canClear}
          canHint={session.canHint}
          canUndo={session.canUndo}
          disabled={session.isBusy}
        />
      </div>
    </>
  );
}
