import {
  clearActiveGame,
  deleteGame,
  getGameById,
  getGameHistory,
  saveGameResult,
  saveStartedGame,
  type StoredGameRecord,
} from "@/db";
import { computeMatchSummary } from "@/stats";

import type {
  GameEvent,
  GameMode,
  GameResult,
  GameState,
  HistoryDetail,
  HistoryEntry,
  HistoryThumbnailStat,
  MatchSummary,
  PlayerId,
} from "@/types";

const DEFAULT_HISTORY_LIMIT = 10;
const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

type NonTrainingGameMode = Exclude<GameMode, "training">;

type ModeDisplayKey =
  | "Modes.x01"
  | "Modes.cricket"
  | "Modes.aroundTheClock"
  | "Modes.bobs27"
  | "Modes.checkout121"
  | "Modes.shanghai"
  | "Modes.doublesTraining"
  | "Modes.singlesTraining"
  | "Modes.killer";

const DISPLAY_MODE_KEY_BY_MODE: Record<NonTrainingGameMode, ModeDisplayKey> = {
  x01: "Modes.x01",
  cricket: "Modes.cricket",
  "around-the-clock": "Modes.aroundTheClock",
  "bobs-27": "Modes.bobs27",
  "checkout-121": "Modes.checkout121",
  shanghai: "Modes.shanghai",
  killer: "Modes.killer",
};

type CompletedStoredGameRecord = StoredGameRecord & {
  result: GameResult;
  stats: MatchSummary;
};

type CompletedMatchSummary = MatchSummary & {
  completedAt: string;
  result: GameResult;
};

function addUniquePlayerId(playerIds: PlayerId[], playerId: PlayerId | undefined): void {
  if (playerId !== undefined && !playerIds.includes(playerId)) {
    playerIds.push(playerId);
  }
}

function completedRecordsStart(offset: number | undefined): number {
  return Math.max(0, Math.trunc(offset ?? 0));
}

function completedRecordsLimit(limit: number | undefined): number {
  return Math.max(0, Math.trunc(limit ?? DEFAULT_HISTORY_LIMIT));
}

function durationMs(startedAt: string, completedAt: string | undefined): number | undefined {
  if (completedAt === undefined) {
    return undefined;
  }

  const startedTime = Date.parse(startedAt);
  const completedTime = Date.parse(completedAt);

  if (!Number.isFinite(startedTime) || !Number.isFinite(completedTime)) {
    return undefined;
  }

  return Math.max(0, completedTime - startedTime);
}

function eventLogFor(state: GameState, events: readonly GameEvent[]): readonly GameEvent[] {
  return events.length > 0 ? events : state.events;
}

function firstTimestamp(events: readonly GameEvent[]): string | undefined {
  return events[0]?.occurredAt;
}

function lastTimestamp(events: readonly GameEvent[]): string | undefined {
  return events[events.length - 1]?.occurredAt;
}

function latestMatchResult(events: readonly GameEvent[]): GameResult | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event.type === "match_won") {
      return event.result;
    }
  }

  return undefined;
}

function playerIdsFor(state: GameState): readonly PlayerId[] {
  const playerIds: PlayerId[] = [];

  for (const playerId of state.playerOrder) {
    addUniquePlayerId(playerIds, playerId);
  }

  for (const player of state.config.players) {
    addUniquePlayerId(playerIds, player.id);
  }

  for (const player of state.players) {
    addUniquePlayerId(playerIds, player.id);
  }

  return playerIds;
}

function startedAtFor(state: GameState, events: readonly GameEvent[]): string {
  return state.createdAt || firstTimestamp(events) || DEFAULT_TIMESTAMP;
}

function resultFromCompletedState(
  state: GameState,
  events: readonly GameEvent[],
  summary: MatchSummary,
): GameResult | undefined {
  if (state.phase !== "match-complete") {
    return undefined;
  }

  const completedAt = summary.completedAt || lastTimestamp(events) || state.updatedAt;
  const legsWonByPlayer: Record<PlayerId, number> = {};
  const setsWonByPlayer: Record<PlayerId, number> = {};
  let hasSetWins = false;

  for (const player of state.players) {
    legsWonByPlayer[player.id] = player.legsWon;
    setsWonByPlayer[player.id] = player.setsWon;
    hasSetWins = hasSetWins || player.setsWon > 0;
  }

  return {
    winnerId: state.players.find((player) => player.status === "winner")?.id,
    mode: state.mode,
    completedAt,
    finalPlayers: state.players,
    legsWonByPlayer,
    setsWonByPlayer: hasSetWins ? setsWonByPlayer : undefined,
  };
}

function completedResultFor(
  state: GameState,
  events: readonly GameEvent[],
  summary: MatchSummary,
): GameResult {
  const result = state.result ?? latestMatchResult(events) ?? resultFromCompletedState(state, events, summary);

  if (result === undefined) {
    throw new Error(`Cannot complete game ${state.id} without a completed result.`);
  }

  return result;
}

function completedSummaryFor(
  state: GameState,
  events: readonly GameEvent[],
): CompletedMatchSummary {
  const baseSummary = computeMatchSummary(events, playerIdsFor(state), state.mode);
  const result = completedResultFor(state, events, baseSummary);
  const startedAt = startedAtFor(state, events);
  const completedAt = result.completedAt;

  return {
    ...baseSummary,
    startedAt,
    completedAt,
    durationMs: durationMs(startedAt, completedAt),
    winnerId: result.winnerId,
    result,
  };
}

function isCompletedRecord(record: StoredGameRecord): record is CompletedStoredGameRecord {
  return record.result !== undefined && record.stats !== undefined;
}

function thumbnailStatsFor(summary: MatchSummary): readonly HistoryThumbnailStat[] {
  return summary.playerStats.map((playerStats) => ({
    playerId: playerStats.playerId,
    playerName: playerStats.playerName,
    turnsPlayed: playerStats.turnsPlayed,
    dartsThrown: playerStats.dartsThrown,
    totalScore: playerStats.totalScore,
    average3Dart: playerStats.average3Dart,
    highestTurn: playerStats.highestTurn,
  }));
}

function playerNamesFor(record: CompletedStoredGameRecord): readonly string[] {
  if (record.players.length > 0) {
    return record.players.map((player) => player.name);
  }

  return record.stats.playerStats.map((playerStats) => playerStats.playerName);
}

function playerNameById(
  record: CompletedStoredGameRecord,
  playerId: PlayerId | undefined,
): string | undefined {
  if (playerId === undefined) {
    return undefined;
  }

  return (
    record.players.find((player) => player.id === playerId)?.name ??
    record.result.finalPlayers.find((player) => player.id === playerId)?.name ??
    record.stats.playerStats.find((playerStats) => playerStats.playerId === playerId)?.playerName
  );
}

function trainingDisplayModeKeyFor(record: CompletedStoredGameRecord): ModeDisplayKey {
  if (record.config.mode !== "training") {
    return "Modes.singlesTraining";
  }

  switch (record.config.focus) {
    case "doubles":
      return "Modes.doublesTraining";
    case "singles":
    case "scoring":
    case "checkout":
    case "cricket":
    case "custom":
      return "Modes.singlesTraining";
  }
}

function displayModeKeyFor(record: CompletedStoredGameRecord): ModeDisplayKey {
  if (record.mode === "training") {
    return trainingDisplayModeKeyFor(record);
  }

  return DISPLAY_MODE_KEY_BY_MODE[record.mode];
}

function historyEntryFromRecord(record: CompletedStoredGameRecord): HistoryEntry {
  const completedAt = record.completedAt ?? record.result.completedAt;

  return {
    id: record.id,
    mode: record.mode,
    displayMode: displayModeKeyFor(record),
    startedAt: record.startedAt,
    completedAt,
    playerNames: playerNamesFor(record),
    winnerName: playerNameById(record, record.stats.winnerId ?? record.result.winnerId),
    duration: record.stats.durationMs ?? durationMs(record.startedAt, completedAt),
    thumbnailStats: thumbnailStatsFor(record.stats),
    summaryId: record.stats.id,
    summary: record.stats,
  };
}

function completedRecordIdBase(gameId: string, completedAt: string): string {
  const timestampKey = completedAt.replace(/[^0-9A-Za-z]+/g, "");

  return `${gameId}-completed-${timestampKey || "unknown"}`;
}

async function uniqueCompletedRecordId(gameId: string, completedAt: string): Promise<string> {
  const baseId = completedRecordIdBase(gameId, completedAt);
  let candidateId = baseId;
  let suffix = 1;

  while ((await getGameById(candidateId)) !== undefined) {
    suffix += 1;
    candidateId = `${baseId}-${suffix}`;
  }

  return candidateId;
}

async function saveCompletionRecord(
  state: GameState,
  eventLog: readonly GameEvent[],
  summary: CompletedMatchSummary,
): Promise<string> {
  const existingRecord = await getGameById(state.id);
  const historyRecordId = await uniqueCompletedRecordId(state.id, summary.completedAt);
  const startedRecord: StoredGameRecord = {
    id: historyRecordId,
    startedAt: existingRecord !== undefined && !isCompletedRecord(existingRecord)
      ? existingRecord.startedAt
      : summary.startedAt,
    mode: state.mode,
    config: state.config,
    players: state.config.players,
    eventLog,
  };

  await saveStartedGame(startedRecord);

  return saveGameResult(historyRecordId, summary.result, summary);
}

export async function onGameComplete(
  state: GameState,
  events: readonly GameEvent[],
  options: { clearActive?: boolean } = {},
): Promise<string> {
  const eventLog = eventLogFor(state, events);
  const summary = completedSummaryFor(state, eventLog);
  const gameId = await saveCompletionRecord(state, eventLog, summary);

  if (options.clearActive ?? true) {
    await clearActiveGame(state.id);
  }

  return gameId;
}

export async function loadHistory(limit?: number, offset?: number): Promise<HistoryEntry[]> {
  const start = completedRecordsStart(offset);
  const end = start + completedRecordsLimit(limit);
  const records = await getGameHistory();

  return records.filter(isCompletedRecord).slice(start, end).map(historyEntryFromRecord);
}

export async function loadGameDetail(gameId: string): Promise<HistoryDetail | null> {
  const record = await getGameById(gameId);

  if (record === undefined || !isCompletedRecord(record)) {
    return null;
  }

  return {
    ...historyEntryFromRecord(record),
    config: record.config,
    events: record.eventLog ?? [],
    result: record.result,
    stats: record.stats,
  };
}

export async function deleteHistoryEntry(gameId: string): Promise<void> {
  await deleteGame(gameId);
}
