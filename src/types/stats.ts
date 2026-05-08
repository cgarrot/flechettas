import type { CricketTarget, GameConfig, GameEvent, GameMode, GameResult } from "./game";
import type { DartTarget, NumberSegment, PlayerId } from "./darts";

export type ScoreBucketKey =
  | "40+"
  | "60+"
  | "80+"
  | "100+"
  | "120+"
  | "140+"
  | "160+"
  | "180";

export type ScoreBuckets = Readonly<Record<ScoreBucketKey, number>>;

export type X01Stats = {
  mode: "x01";
  average3Dart: number;
  first9Average?: number;
  turnsPlayed: number;
  dartsThrown: number;
  scoringDarts: number;
  totalScore: number;
  highestTurn: number;
  highestCheckout?: number;
  checkoutAttempts: number;
  checkoutHits: number;
  checkoutRate: number;
  busts: number;
  scoreBuckets: ScoreBuckets;
};

export type CricketStats = {
  mode: "cricket";
  marksPerRound: number;
  scoringAverage: number;
  roundsPlayed: number;
  dartsThrown: number;
  totalMarks: number;
  points: number;
  closedTargets: readonly CricketTarget[];
  hitsByTarget: Readonly<Partial<Record<CricketTarget, number>>>;
};

export type AroundTheClockStats = {
  mode: "around-the-clock";
  completedTargets: readonly (NumberSegment | 25)[];
  dartsUsed: number;
  misses: number;
};

export type Bobs27Stats = {
  mode: "bobs-27";
  finalScore: number;
  bestRoundScore: number;
  completedDoubles: readonly (NumberSegment | 25)[];
};

export type Checkout121Stats = {
  mode: "checkout-121";
  highestClearedTarget: number;
  successfulTargets: readonly number[];
  failedTargets: readonly number[];
  checkoutRate: number;
};

export type ShanghaiStats = {
  mode: "shanghai";
  totalScore: number;
  shanghaiRounds: readonly NumberSegment[];
  bestRoundScore: number;
};

export type TrainingStats = {
  mode: "training";
  completed: boolean;
  attempts: number;
  hits: number;
  accuracy: number;
  average3Dart?: number;
  targets: readonly DartTarget[];
};

export type KillerStats = {
  mode: "killer";
  kills: number;
  livesRemaining: number;
  livesLost: number;
  assignedNumber?: NumberSegment;
  eliminated: boolean;
};

export type PlayerModeStats =
  | X01Stats
  | CricketStats
  | AroundTheClockStats
  | Bobs27Stats
  | Checkout121Stats
  | ShanghaiStats
  | TrainingStats
  | KillerStats;

export type PlayerMatchStats = {
  playerId: PlayerId;
  playerName: string;
  mode: GameMode;
  turnsPlayed: number;
  dartsThrown: number;
  totalScore: number;
  average3Dart: number;
  highestTurn: number;
  scoreBuckets: ScoreBuckets;
  modeStats: PlayerModeStats;
};

export type MatchSummary = {
  id: string;
  mode: GameMode;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  winnerId?: PlayerId;
  playerStats: readonly PlayerMatchStats[];
  result?: GameResult;
};

export type HistoryThumbnailStat = {
  playerId: PlayerId;
  playerName: string;
  turnsPlayed: number;
  dartsThrown: number;
  totalScore: number;
  average3Dart: number;
  highestTurn: number;
};

export type HistoryEntry = {
  id: string;
  mode: GameMode;
  displayMode: string;
  startedAt: string;
  completedAt?: string;
  playerNames: readonly string[];
  winnerName?: string;
  duration?: number;
  thumbnailStats: readonly HistoryThumbnailStat[];
  summaryId: string;
  summary: MatchSummary;
};

export type HistoryDetail = HistoryEntry & {
  config: GameConfig;
  events: readonly GameEvent[];
  result?: GameResult;
  stats: MatchSummary;
};
