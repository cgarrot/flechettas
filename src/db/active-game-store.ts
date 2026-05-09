import { ACTIVE_GAME_ID, getDb, type ActiveGameRecord } from "./schema";

import type { GameEvent, GameState } from "@/types";

export type LoadedActiveGame = Readonly<{
  id: string;
  gameState: GameState;
  eventLog: readonly GameEvent[];
  updatedAt: string;
}>;

function loadedActiveGameFromRecord(record: ActiveGameRecord): LoadedActiveGame {
  return {
    id: record.id,
    gameState: record.gameState,
    eventLog: record.eventLog,
    updatedAt: record.updatedAt,
  };
}

async function migrateLegacyActiveGame(record: ActiveGameRecord): Promise<ActiveGameRecord> {
  if (record.id !== ACTIVE_GAME_ID || record.gameState.id === ACTIVE_GAME_ID) {
    return record;
  }

  const db = getDb();
  const migratedRecord: ActiveGameRecord = {
    ...record,
    id: record.gameState.id,
  };

  await db.transaction("rw", db.activeGame, async () => {
    await db.activeGame.put(migratedRecord);
    await db.activeGame.delete(ACTIVE_GAME_ID);
  });

  return migratedRecord;
}

export async function saveActiveGame(
  gameState: GameState,
  eventLog: readonly GameEvent[],
): Promise<void> {
  const record: ActiveGameRecord = {
    id: gameState.id,
    gameState,
    eventLog,
    updatedAt: new Date().toISOString(),
  };

  const db = getDb();

  await db.transaction("rw", db.activeGame, async () => {
    await db.activeGame.put(record);

    if (record.id !== ACTIVE_GAME_ID) {
      await db.activeGame.delete(ACTIVE_GAME_ID);
    }
  });
}

export async function loadActiveGames(): Promise<LoadedActiveGame[]> {
  const records = await getDb().activeGame.orderBy("updatedAt").reverse().toArray();
  const migratedRecords = await Promise.all(records.map(migrateLegacyActiveGame));
  const activeGamesById = new Map<string, ActiveGameRecord>();

  for (const record of migratedRecords) {
    if (!activeGamesById.has(record.id)) {
      activeGamesById.set(record.id, record);
    }
  }

  return [...activeGamesById.values()].map(loadedActiveGameFromRecord);
}

export async function loadActiveGame(gameId?: string): Promise<LoadedActiveGame | null> {
  if (gameId === undefined) {
    const [latestActiveGame] = await loadActiveGames();

    return latestActiveGame ?? null;
  }

  const record = await getDb().activeGame.get(gameId);

  if (record === undefined) {
    return null;
  }

  return loadedActiveGameFromRecord(await migrateLegacyActiveGame(record));
}

export async function clearActiveGame(gameId: string = ACTIVE_GAME_ID): Promise<void> {
  await getDb().activeGame.delete(gameId);
}
