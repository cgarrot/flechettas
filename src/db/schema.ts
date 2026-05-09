import Dexie, { type Table } from "dexie";

import type {
  GameConfig,
  GameEvent,
  GameMode,
  GameResult,
  GameState,
  PlayerDef,
} from "@/types";
import type { MatchSummary } from "@/types";

const DATABASE_NAME = "flechettas";

export const ACTIVE_GAME_ID = "current" as const;

export type StoredGameRecord = {
  id: string;
  startedAt: string;
  completedAt?: string;
  mode: GameMode;
  config: GameConfig;
  players: readonly PlayerDef[];
  eventLog?: readonly GameEvent[];
  result?: GameResult;
  stats?: MatchSummary;
};

export type ActiveGameRecord = {
  id: string;
  gameState: GameState;
  eventLog: readonly GameEvent[];
  updatedAt: string;
};

export class FlechettasDatabase extends Dexie {
  games!: Table<StoredGameRecord, string>;
  activeGame!: Table<ActiveGameRecord, string>;

  constructor() {
    super(DATABASE_NAME);

    this.version(1).stores({
      games: "id, startedAt, completedAt, mode",
      activeGame: "id, updatedAt",
    });
  }
}

let database: FlechettasDatabase | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

export function getDb(): FlechettasDatabase {
  if (!hasIndexedDb()) {
    throw new Error("Flechettas IndexedDB storage is browser-only.");
  }

  if (database === null) {
    database = new FlechettasDatabase();
  }

  return database;
}

const databaseProxyHandler: ProxyHandler<FlechettasDatabase> = {
  get(_target, property, receiver) {
    const currentDb = getDb();
    const value = Reflect.get(currentDb, property, receiver) as unknown;

    if (typeof value === "function") {
      return value.bind(currentDb);
    }

    return value;
  },
};

export const db: FlechettasDatabase = new Proxy(
  Object.create(null) as FlechettasDatabase,
  databaseProxyHandler,
);
