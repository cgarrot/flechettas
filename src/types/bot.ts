import type { DartTarget, Turn } from "./darts";

export type BotLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type BotProfile = {
  level: BotLevel;
  name: string;
  avg3Dart: number;
  checkoutRate: number;
  tripleRate: number;
  doubleRate: number;
};

export type BotDecisionContext<TGameState = unknown, TPlayerState = unknown> = {
  gameState: TGameState;
  playerState: TPlayerState;
  profile: BotProfile;
  preferredTarget?: DartTarget;
};

export type BotTargetSelector<TGameState = unknown, TPlayerState = unknown> = (
  context: BotDecisionContext<TGameState, TPlayerState>,
) => DartTarget;

export type BotTurnGenerator<TGameState = unknown, TPlayerState = unknown> = (
  context: BotDecisionContext<TGameState, TPlayerState>,
) => Turn | Promise<Turn>;
