import type { PlayerId } from "./darts";
import type { GameConfig, GameEvent, GameMode, GameState } from "./game";

export type SharedSessionPlayer = {
  id: PlayerId;
  sessionCode: string;
  name: string;
  isHost: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SharedSessionSummary = {
  code: string;
  createdAt: string;
  updatedAt: string;
  players: SharedSessionPlayer[];
};

export type SharedActiveGameSnapshot = {
  gameState: GameState | null;
  eventLog: GameEvent[];
  mode: GameMode | null;
  config: GameConfig | null;
};

export type SharedActiveGame = {
  sessionCode: string;
  revision: number;
  snapshot: SharedActiveGameSnapshot;
  updatedAt: string;
  updatedByPlayerId: PlayerId | null;
  updatedByDeviceId: string | null;
};

export type SharedCompletedGame = {
  id: string;
  sessionCode: string;
  gameId: string;
  completedAt: string;
  createdAt: string;
};
