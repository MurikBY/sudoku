import type { Difficulty, Game, GameReview, Party, PartyMember } from "@/api/types";
import type { TechniqueArticleId } from "@/content/techniquesGuideCopy";
import type { PartyLobbyPhase } from "@/hooks/partyLobbyState";

export type PlaySessionHome = {
  playLocked: boolean;
  loading: boolean;
  creating: boolean;
  error: string | null;
  reconnecting: boolean;
  hasResumableGame: boolean;
  clearError: () => void;
  startNew: () => void;
  continueGame: () => void;
  playWithFriends: () => void;
  refreshResumable: () => Promise<Game | null>;
};

export type PlaySessionLobby = {
  open: boolean;
  phase: PartyLobbyPhase;
  party: Party | null;
  members: PartyMember[];
  joinCode: string;
  joinedOk: boolean;
  busy: boolean;
  error: string | null;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onJoinCodeChange: (value: string) => void;
  onChooseJoin: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onStart: () => void;
  onLeave: () => void;
  onClose: () => void;
  onDismissClosed: () => void;
  onClearError: () => void;
  onRetryCheck: () => void;
};

export type PlaySessionReview = {
  back: () => void;
  open: (review: GameReview) => void;
  openParty: (partyId: string) => void;
};

export type PlaySessionAnalysis = {
  playFromHere: (shareCode: string, eventIndex: number) => void;
  busy: boolean;
  error: string | null;
  onSolved: () => void;
  backToReview: () => void;
};

export type PlaySessionLesson = {
  start: (
    technique: TechniqueArticleId,
    variant: "taught" | "practice",
    excludePositionId?: string,
  ) => void;
  back: () => void;
  busy: boolean;
  error: string | null;
};

export type PlaySessionLeave = {
  home: () => void;
  rating: () => void;
};

export type PlaySession = {
  home: PlaySessionHome;
  lobby: PlaySessionLobby;
  review: PlaySessionReview;
  analysis: PlaySessionAnalysis;
  lesson: PlaySessionLesson;
  leave: PlaySessionLeave;
};
