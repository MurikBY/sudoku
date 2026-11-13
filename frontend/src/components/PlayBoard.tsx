import type { PointerEvent as ReactPointerEvent } from "react";

import type { Game } from "@/api/types";
import { GameActionBar } from "@/components/GameActionBar";
import { GameToolbar } from "@/components/GameToolbar";
import {
  PlayBoardGrid,
  PlayBoardPad,
  type BoardFlashes,
  type PlayBoardSession,
} from "@/components/PlayBoardSlots";
import type { GameAssists } from "@/lib/play/gameSettings";
import type { PlayMode } from "@/lib/play/playMode";
import type { InfoGuideLang } from "@/content/infoGuideCopy";

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
  flashes: BoardFlashes;
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
  flashes,
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
      <PlayBoardGrid
        game={game}
        assists={assists}
        session={session}
        selectedIndex={selectedIndex}
        flashes={flashes}
        onPointerDown={stopBoardClear}
      />
      <div className="gazette-play-balance" aria-hidden="true" />
      <PlayBoardPad
        assists={assists}
        session={session}
        isPlaying={isPlaying}
        lang={lang}
        onPointerDown={stopBoardClear}
      />
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
