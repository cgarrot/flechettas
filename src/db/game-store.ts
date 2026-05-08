import { getDb, type StoredGameRecord } from "./schema";

import type { GameResult, MatchSummary } from "@/types";

function getRecordTime(record: StoredGameRecord): number {
  const timestamp = Date.parse(record.completedAt ?? record.startedAt);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return timestamp;
}

function getStart(offset: number | undefined): number {
  return Math.max(0, Math.trunc(offset ?? 0));
}

export async function saveStartedGame(record: StoredGameRecord): Promise<string> {
  await getDb().games.put(record);

  return record.id;
}

export async function saveGameResult(
  gameId: string,
  result: GameResult,
  stats: MatchSummary,
): Promise<string> {
  const db = getDb();
  const existingRecord = await db.games.get(gameId);

  if (existingRecord === undefined) {
    throw new Error(`Save started game before result for ${gameId}.`);
  }

  const nextRecord: StoredGameRecord = {
    ...existingRecord,
    completedAt: result.completedAt,
    result,
    stats,
  };

  await db.games.put(nextRecord);

  return gameId;
}

export async function getGameHistory(
  limit?: number,
  offset?: number,
): Promise<StoredGameRecord[]> {
  const start = getStart(offset);
  const records = await getDb().games.toArray();
  const sortedRecords = records.sort(
    (leftRecord, rightRecord) => getRecordTime(rightRecord) - getRecordTime(leftRecord),
  );

  if (limit === undefined) {
    return sortedRecords.slice(start);
  }

  const size = Math.max(0, Math.trunc(limit));

  return sortedRecords.slice(start, start + size);
}

export async function getGameById(id: string): Promise<StoredGameRecord | undefined> {
  return getDb().games.get(id);
}

export async function deleteGame(id: string): Promise<void> {
  await getDb().games.delete(id);
}
