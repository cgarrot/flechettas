import { ACTIVE_GAME_ID, getDb, type ActiveGameRecord } from "./schema";

import type { GameEvent, GameState } from "@/types";

export type ActiveGameSource = "local" | "shared";

type SaveActiveGameOptions = Readonly<{
  source?: ActiveGameSource;
  sharedSessionCode?: string;
}>;

type LoadActiveGamesOptions = Readonly<{
  source?: ActiveGameSource;
}>;

export type LoadedActiveGame = Readonly<{
  id: string;
  gameState: GameState;
  eventLog: readonly GameEvent[];
  updatedAt: string;
  source: ActiveGameSource;
  sharedSessionCode?: string;
}>;

function sourceForRecord(record: ActiveGameRecord): ActiveGameSource {
  return record.source ?? "local";
}

function loadedActiveGameFromRecord(record: ActiveGameRecord): LoadedActiveGame {
  return {
    id: record.id,
    gameState: record.gameState,
    eventLog: record.eventLog,
    updatedAt: record.updatedAt,
    source: sourceForRecord(record),
    sharedSessionCode: record.sharedSessionCode,
  };
}

function isNewerRecord(candidate: ActiveGameRecord, existing: ActiveGameRecord): boolean {
  return candidate.updatedAt > existing.updatedAt;
}

async function migrateLegacyActiveGame(record: ActiveGameRecord): Promise<ActiveGameRecord> {
  if (record.id !== ACTIVE_GAME_ID || record.gameState.id === ACTIVE_GAME_ID) {
    return record;
  }

  const db = getDb();
  const migratedRecord: ActiveGameRecord = {
    ...record,
    id: record.gameState.id,
    source: sourceForRecord(record),
  };
  let selectedRecord = migratedRecord;

  await db.transaction("rw", db.activeGame, async () => {
    const existingRecord = await db.activeGame.get(migratedRecord.id);

    if (existingRecord !== undefined && !isNewerRecord(migratedRecord, existingRecord)) {
      selectedRecord = existingRecord;
    } else {
      await db.activeGame.put(migratedRecord);
    }

    await db.activeGame.delete(ACTIVE_GAME_ID);
  });

  return selectedRecord;
}

async function migrateLegacyActiveGameIfNeeded(nextRecordId: string): Promise<void> {
  if (nextRecordId === ACTIVE_GAME_ID) {
    return;
  }

  const legacyRecord = await getDb().activeGame.get(ACTIVE_GAME_ID);

  if (legacyRecord !== undefined) {
    await migrateLegacyActiveGame(legacyRecord);
  }
}

export async function saveActiveGame(
  gameState: GameState,
  eventLog: readonly GameEvent[],
  options: SaveActiveGameOptions = {},
): Promise<void> {
  const record: ActiveGameRecord = {
    id: gameState.id,
    gameState,
    eventLog,
    updatedAt: new Date().toISOString(),
    source: options.source ?? "local",
    sharedSessionCode: options.sharedSessionCode,
  };

  const db = getDb();

  await migrateLegacyActiveGameIfNeeded(record.id);

  await db.transaction("rw", db.activeGame, async () => {
    await db.activeGame.put(record);
  });
}

export async function loadActiveGames(options: LoadActiveGamesOptions = {}): Promise<LoadedActiveGame[]> {
  const records = await getDb().activeGame.orderBy("updatedAt").reverse().toArray();
  const migratedRecords: ActiveGameRecord[] = [];
  const activeGamesById = new Map<string, ActiveGameRecord>();

  for (const record of records) {
    migratedRecords.push(await migrateLegacyActiveGame(record));
  }

  for (const record of migratedRecords) {
    if (!activeGamesById.has(record.id)) {
      activeGamesById.set(record.id, record);
    }
  }

  return [...activeGamesById.values()]
    .filter((record) => options.source === undefined || sourceForRecord(record) === options.source)
    .map(loadedActiveGameFromRecord);
}

export async function loadActiveGame(gameId?: string): Promise<LoadedActiveGame | null> {
  if (gameId === undefined) {
    const [latestActiveGame] = await loadActiveGames({ source: "local" });

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

export async function clearSharedActiveGameCache(sharedSessionCode: string): Promise<void> {
  const db = getDb();
  const records = await db.activeGame.toArray();
  const recordIds = records
    .filter((record) => sourceForRecord(record) === "shared" && record.sharedSessionCode === sharedSessionCode)
    .map((record) => record.id);

  if (recordIds.length > 0) {
    await db.activeGame.bulkDelete(recordIds);
  }
}
