import type {
  Dart,
  DartIndex,
  DartTarget,
  Multiplier,
  NumberSegment,
  PlayerId,
  Segment,
  Turn,
} from "./darts";
import type { BotLevel } from "./bot";

export type GameMode =
  | "x01"
  | "cricket"
  | "around-the-clock"
  | "bobs-27"
  | "checkout-121"
  | "shanghai"
  | "training"
  | "killer";

export type GamePhase =
  | "setup"
  | "playing"
  | "paused"
  | "leg-complete"
  | "set-complete"
  | "match-complete"
  | "abandoned";

export type PlayerStatus = "waiting" | "active" | "bust" | "eliminated" | "winner";

export type PlayerDef = {
  id: PlayerId;
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
};

export type MatchFormat = {
  legsToWin: number;
  setsToWin?: number;
  winByTwoLegs?: boolean;
};

export type BaseGameConfig<TMode extends GameMode> = {
  mode: TMode;
  players: readonly PlayerDef[];
  matchFormat?: MatchFormat;
  startingPlayerId?: PlayerId;
};

export type X01StartScore = 301 | 501 | 701;

export type X01Config = BaseGameConfig<"x01"> & {
  startingScore: X01StartScore;
  doubleIn?: boolean;
  doubleOut: boolean;
  masterOut?: boolean;
};

export type CricketTarget = 15 | 16 | 17 | 18 | 19 | 20 | 25;

export type CricketVariant = "standard" | "cut-throat" | "no-score";

export type CricketConfig = BaseGameConfig<"cricket"> & {
  variant: CricketVariant;
  targets?: readonly CricketTarget[];
  scorePoints: boolean;
  pointsRequiredToWin?: number;
};

export type AroundTheClockConfig = BaseGameConfig<"around-the-clock"> & {
  startSegment: NumberSegment;
  endSegment: NumberSegment | 25;
  requiredMultiplier?: Multiplier | "open";
  includeBull?: boolean;
};

export type Bobs27Config = BaseGameConfig<"bobs-27"> & {
  startingScore: 27;
  doublesOnly: true;
  rounds?: readonly (NumberSegment | 25)[];
  allowNegativeScore?: boolean;
};

export type Checkout121Config = BaseGameConfig<"checkout-121"> & {
  startingTarget: 121;
  minimumTarget?: number;
  maximumTarget?: number;
  dartsPerTarget: 3 | 6 | 9;
  failureStep: number;
  successStep: number;
};

export type ShanghaiConfig = BaseGameConfig<"shanghai"> & {
  rounds?: readonly NumberSegment[];
  instantShanghaiWin: boolean;
};

export type TrainingFocus =
  | "scoring"
  | "singles"
  | "doubles"
  | "checkout"
  | "cricket"
  | "custom";

export type TrainingConfig = BaseGameConfig<"training"> & {
  focus: TrainingFocus;
  targets?: readonly DartTarget[];
  rounds?: number;
  maxTurns?: number;
  hitsRequiredToAdvance?: 1 | 2 | 3;
};

export type KillerAssignment = "manual" | "first-hit" | "random" | "sequential";

export type KillerConfig = BaseGameConfig<"killer"> & {
  startingLives: number;
  assignment: KillerAssignment;
  requiredHitsToBecomeKiller: number;
  allowSharedNumbers?: boolean;
  assignments?: Readonly<Partial<Record<PlayerId, NumberSegment>>>;
};

export type GameConfig =
  | X01Config
  | CricketConfig
  | AroundTheClockConfig
  | Bobs27Config
  | Checkout121Config
  | ShanghaiConfig
  | TrainingConfig
  | KillerConfig;

export type CricketMarks = number;

export type CricketMarkMap = Readonly<Partial<Record<CricketTarget, CricketMarks>>>;

export type ShanghaiHitMap = Readonly<Partial<Record<Multiplier, number>>>;

export type X01PlayerModeState = {
  mode: "x01";
  startingScore: X01StartScore;
  remainingScore: number;
  dartsThrownInLeg: number;
  busts: number;
  checkoutAttempts: number;
  checkoutHits: number;
};

export type CricketPlayerModeState = {
  mode: "cricket";
  marks: CricketMarkMap;
  points: number;
  closedTargets: readonly CricketTarget[];
};

export type AroundTheClockPlayerModeState = {
  mode: "around-the-clock";
  currentTarget: NumberSegment | 25;
  completedTargets: readonly (NumberSegment | 25)[];
  hits: number;
};

export type Bobs27PlayerModeState = {
  mode: "bobs-27";
  score: number;
  currentDouble: NumberSegment | 25;
  completedRounds: readonly (NumberSegment | 25)[];
};

export type Checkout121PlayerModeState = {
  mode: "checkout-121";
  currentTargetScore: number;
  remainingTargetScore: number;
  dartsThrownAtCurrentTarget: number;
  successfulTargets: readonly number[];
  failedTargets: readonly number[];
};

export type ShanghaiPlayerModeState = {
  mode: "shanghai";
  round: NumberSegment;
  score: number;
  hitsByMultiplier: ShanghaiHitMap;
  achievedShanghai: boolean;
  completedRounds: readonly NumberSegment[];
};

export type TrainingPlayerModeState = {
  mode: "training";
  focus: TrainingFocus;
  attempts: number;
  hits: number;
  score: number;
  currentTargetHits: number;
  targetHistory: readonly DartTarget[];
};

export type KillerPlayerModeState = {
  mode: "killer";
  lives: number;
  assignedNumber?: NumberSegment;
  killerHits: number;
  isKiller: boolean;
  kills: number;
};

export type PlayerModeState =
  | X01PlayerModeState
  | CricketPlayerModeState
  | AroundTheClockPlayerModeState
  | Bobs27PlayerModeState
  | Checkout121PlayerModeState
  | ShanghaiPlayerModeState
  | TrainingPlayerModeState
  | KillerPlayerModeState;

export type PlayerState = {
  id: PlayerId;
  name: string;
  isBot: boolean;
  botLevel?: BotLevel;
  status: PlayerStatus;
  legsWon: number;
  setsWon: number;
  turnsPlayed: number;
  dartsThrown: number;
  currentTurn: Turn;
  modeState: PlayerModeState;
};

export type GameResult = {
  winnerId?: PlayerId;
  mode: GameMode;
  completedAt: string;
  finalPlayers: readonly PlayerState[];
  legsWonByPlayer: Readonly<Record<PlayerId, number>>;
  setsWonByPlayer?: Readonly<Record<PlayerId, number>>;
};

export type GameState = {
  id: string;
  mode: GameMode;
  config: GameConfig;
  phase: GamePhase;
  players: readonly PlayerState[];
  playerOrder: readonly PlayerId[];
  activePlayerId?: PlayerId;
  currentLeg: number;
  currentSet: number;
  currentRound: number;
  currentTurn: Turn;
  events: readonly GameEvent[];
  result?: GameResult;
  createdAt: string;
  updatedAt: string;
};

export type GameEventType =
  | "game_started"
  | "dart_thrown"
  | "turn_total_submitted"
  | "turn_complete"
  | "player_bust"
  | "leg_won"
  | "set_won"
  | "round_advanced"
  | "match_won"
  | "undo";

export type GameWinReason = "shanghai";

export type BaseGameEvent<TType extends GameEventType> = {
  id: string;
  type: TType;
  occurredAt: string;
  playerId?: PlayerId;
};

export type GameStartedEvent = BaseGameEvent<"game_started"> & {
  config: GameConfig;
  playerOrder: readonly PlayerId[];
};

export type DartThrownEvent = BaseGameEvent<"dart_thrown"> & {
  playerId: PlayerId;
  dart: Dart;
  dartIndex: DartIndex;
  score?: number;
};

export type TurnTotalSubmittedEvent = BaseGameEvent<"turn_total_submitted"> & {
  playerId: PlayerId;
  total: number;
  darts?: Turn;
};

export type TurnCompleteEvent = BaseGameEvent<"turn_complete"> & {
  playerId: PlayerId;
  turn: Turn;
  score: number;
  remainingScore?: number;
};

export type PlayerBustEvent = BaseGameEvent<"player_bust"> & {
  playerId: PlayerId;
  scoreBeforeTurn: number;
  attemptedScore: number;
};

export type LegWonEvent = BaseGameEvent<"leg_won"> & {
  playerId: PlayerId;
  leg: number;
  checkoutScore?: number;
  finishingTurn?: Turn;
  reason?: GameWinReason;
};

export type SetWonEvent = BaseGameEvent<"set_won"> & {
  playerId: PlayerId;
  set: number;
  legsWon: number;
};

export type RoundAdvancedEvent = BaseGameEvent<"round_advanced"> & {
  fromRound: number;
  toRound: number;
  target?: Segment;
};

export type MatchWonEvent = BaseGameEvent<"match_won"> & {
  playerId: PlayerId;
  result: GameResult;
  reason?: GameWinReason;
};

export type UndoEvent = BaseGameEvent<"undo"> & {
  undoneEventId: string;
  undoneEventType: Exclude<GameEventType, "undo">;
};

export type GameEvent =
  | GameStartedEvent
  | DartThrownEvent
  | TurnTotalSubmittedEvent
  | TurnCompleteEvent
  | PlayerBustEvent
  | LegWonEvent
  | SetWonEvent
  | RoundAdvancedEvent
  | MatchWonEvent
  | UndoEvent;
