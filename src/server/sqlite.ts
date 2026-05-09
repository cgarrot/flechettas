import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomInt, randomUUID } from "node:crypto";

import {
  isValidSharedSessionCode,
  MIN_SHARED_SESSION_CODE_LENGTH,
  normalizeSharedSessionCode,
} from "@/lib/shared-session-code";
import { HttpResponseError } from "@/server/route-utils";

import type {
  GameEvent,
  PlayerId,
  SharedActiveGame,
  SharedActiveGameSnapshot,
  SharedCompletedGame,
  SharedSessionPlayer,
  SharedSessionSummary,
} from "@/types";

type SqliteDatabase = Database.Database;

type SessionRow = {
  code: string;
  created_at: string;
  updated_at: string;
};

type SessionPlayerRow = {
  id: string;
  session_code: string;
  name: string;
  is_host: number;
  created_at: string;
  updated_at: string;
};

type ActiveGameRow = {
  session_code: string;
  game_id: string;
  revision: number;
  snapshot_json: string;
  updated_at: string;
  updated_by_player_id: string | null;
  updated_by_device_id: string | null;
};

type CompletedGameRow = {
  id: string;
  session_code: string;
  game_id: string;
  completed_at: string;
  created_at: string;
};

type SaveActiveGameConflict = {
  ok: false;
  latest: SharedActiveGame | null;
  revision: number;
};

type SaveActiveGameSuccess = {
  ok: true;
  activeGame: SharedActiveGame;
};

export type SaveActiveGameResult = SaveActiveGameSuccess | SaveActiveGameConflict;

type SaveCompletedGameConflict = {
  ok: false;
  latest: SharedActiveGame | null;
  revision: number;
};

type SaveCompletedGameSuccess = {
  ok: true;
  completedGame: SharedCompletedGame;
};

export type SaveCompletedGameResult = SaveCompletedGameSuccess | SaveCompletedGameConflict;

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const MAX_SESSION_PLAYERS = 20;
const MAX_COMPLETED_GAMES_PER_SESSION = 1_000;

let database: SqliteDatabase | null = null;

function sqlitePath(): string {
  return process.env.SQLITE_PATH ??
    process.env.DATABASE_PATH ??
    path.join(process.cwd(), "data", "flechettas.sqlite");
}

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeSessionCode(input: string): string {
  return normalizeSharedSessionCode(input);
}

export function isValidSessionCode(code: string): boolean {
  return isValidSharedSessionCode(code);
}

function assertValidSessionCode(code: string): void {
  if (!isValidSessionCode(code)) {
    throw new Error(`Invalid shared session code: ${code}`);
  }
}

function createDatabase(): SqliteDatabase {
  const dbPath = sqlitePath();

  mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      code TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_players (
      id TEXT PRIMARY KEY,
      session_code TEXT NOT NULL,
      name TEXT NOT NULL,
      is_host INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(session_code, name COLLATE NOCASE),
      FOREIGN KEY(session_code) REFERENCES sessions(code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_games (
      session_code TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by_player_id TEXT,
      updated_by_device_id TEXT,
      FOREIGN KEY(session_code) REFERENCES sessions(code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS completed_games (
      id TEXT PRIMARY KEY,
      session_code TEXT NOT NULL,
      game_id TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      event_log_json TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      saved_by_player_id TEXT,
      saved_by_device_id TEXT,
      UNIQUE(session_code, idempotency_key),
      FOREIGN KEY(session_code) REFERENCES sessions(code) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS session_players_session_position_idx
      ON session_players(session_code, position, created_at);

    CREATE INDEX IF NOT EXISTS completed_games_session_created_idx
      ON completed_games(session_code, created_at);
  `);

  return db;
}

function getDatabase(): SqliteDatabase {
  if (database === null) {
    database = createDatabase();
  }

  return database;
}

function randomSessionCode(): string {
  let code = "";

  for (let index = 0; index < MIN_SHARED_SESSION_CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  return code;
}

function rowToSessionPlayer(row: SessionPlayerRow): SharedSessionPlayer {
  return {
    id: row.id,
    sessionCode: row.session_code,
    name: row.name,
    isHost: row.is_host === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToActiveGame(row: ActiveGameRow): SharedActiveGame {
  return {
    sessionCode: row.session_code,
    revision: row.revision,
    snapshot: JSON.parse(row.snapshot_json) as SharedActiveGameSnapshot,
    updatedAt: row.updated_at,
    updatedByPlayerId: row.updated_by_player_id as PlayerId | null,
    updatedByDeviceId: row.updated_by_device_id,
  };
}

function rowToCompletedGame(row: CompletedGameRow): SharedCompletedGame {
  return {
    id: row.id,
    sessionCode: row.session_code,
    gameId: row.game_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function getCompletedGameByIdempotencyKey(db: SqliteDatabase, code: string, idempotencyKey: string): SharedCompletedGame | null {
  const row = db
    .prepare(`
      SELECT id, session_code, game_id, completed_at, created_at
      FROM completed_games
      WHERE session_code = ? AND idempotency_key = ?
    `)
    .get(code, idempotencyKey) as CompletedGameRow | undefined;

  return row === undefined ? null : rowToCompletedGame(row);
}

function getSessionRow(code: string): SessionRow | undefined {
  return getDatabase()
    .prepare("SELECT code, created_at, updated_at FROM sessions WHERE code = ?")
    .get(code) as SessionRow | undefined;
}

function getSessionPlayers(code: string): SharedSessionPlayer[] {
  const rows = getDatabase()
    .prepare(`
      SELECT id, session_code, name, is_host, created_at, updated_at
      FROM session_players
      WHERE session_code = ?
      ORDER BY position ASC, created_at ASC
    `)
    .all(code) as SessionPlayerRow[];

  return rows.map(rowToSessionPlayer);
}

export function getSharedSession(codeInput: string): SharedSessionSummary | null {
  const code = normalizeSessionCode(codeInput);

  if (!isValidSessionCode(code)) {
    return null;
  }

  const row = getSessionRow(code);

  if (row === undefined) {
    return null;
  }

  return {
    code: row.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    players: getSessionPlayers(row.code),
  };
}

export function ensureSharedSession(codeInput?: string): SharedSessionSummary {
  const db = getDatabase();
  let code = codeInput === undefined ? randomSessionCode() : normalizeSessionCode(codeInput);

  if (codeInput === undefined) {
    while (getSessionRow(code) !== undefined) {
      code = randomSessionCode();
    }
  }

  assertValidSessionCode(code);

  const existing = getSessionRow(code);
  const timestamp = nowIso();

  if (existing === undefined) {
    db.prepare("INSERT INTO sessions (code, created_at, updated_at) VALUES (?, ?, ?)")
      .run(code, timestamp, timestamp);
  } else {
    db.prepare("UPDATE sessions SET updated_at = ? WHERE code = ?")
      .run(timestamp, code);
  }

  const row = getSessionRow(code);

  if (row === undefined) {
    throw new Error(`Failed to create shared session ${code}.`);
  }

  return {
    code: row.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    players: getSessionPlayers(row.code),
  };
}

export function createSharedSessionPlayer(codeInput: string, nameInput: string): SharedSessionPlayer {
  const session = ensureSharedSession(codeInput);
  const name = nameInput.trim();

  if (name.length === 0) {
    throw new Error("Shared session player name is required.");
  }

  const db = getDatabase();
  const existing = db
    .prepare(`
      SELECT id, session_code, name, is_host, created_at, updated_at
      FROM session_players
      WHERE session_code = ? AND name = ? COLLATE NOCASE
    `)
    .get(session.code, name) as SessionPlayerRow | undefined;

  if (existing !== undefined) {
    return rowToSessionPlayer(existing);
  }

  const playerCount = db
    .prepare("SELECT COUNT(*) AS count FROM session_players WHERE session_code = ?")
    .get(session.code) as { count: number };

  if (playerCount.count >= MAX_SESSION_PLAYERS) {
    throw new HttpResponseError(409, `Shared sessions can include up to ${MAX_SESSION_PLAYERS} players.`);
  }

  const timestamp = nowIso();
  const id = `session-player-${randomUUID()}`;

  db.prepare(`
    INSERT INTO session_players (
      id,
      session_code,
      name,
      is_host,
      position,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    session.code,
    name,
    playerCount.count === 0 ? 1 : 0,
    playerCount.count,
    timestamp,
    timestamp,
  );

  const row = db
    .prepare(`
      SELECT id, session_code, name, is_host, created_at, updated_at
      FROM session_players
      WHERE id = ?
    `)
    .get(id) as SessionPlayerRow | undefined;

  if (row === undefined) {
    throw new Error(`Failed to create shared session player in ${session.code}.`);
  }

  return rowToSessionPlayer(row);
}

export function getSharedActiveGame(codeInput: string): SharedActiveGame | null {
  const code = normalizeSessionCode(codeInput);

  if (!isValidSessionCode(code)) {
    return null;
  }

  const row = getDatabase()
    .prepare(`
      SELECT session_code, game_id, revision, snapshot_json, updated_at, updated_by_player_id, updated_by_device_id
      FROM active_games
      WHERE session_code = ?
    `)
    .get(code) as ActiveGameRow | undefined;

  return row === undefined ? null : rowToActiveGame(row);
}

export function saveSharedActiveGame(input: {
  sessionCode: string;
  snapshot: SharedActiveGameSnapshot;
  expectedRevision: number;
  updatedByPlayerId: PlayerId | null;
  updatedByDeviceId: string | null;
}): SaveActiveGameResult {
  const session = ensureSharedSession(input.sessionCode);
  const db = getDatabase();

  return db.transaction((): SaveActiveGameResult => {
    const latest = getSharedActiveGame(session.code);
    const latestRevision = latest?.revision ?? 0;

    if (latestRevision !== input.expectedRevision) {
      return { ok: false, latest, revision: latestRevision };
    }

    const timestamp = nowIso();
    const nextRevision = latestRevision + 1;
    const gameId = input.snapshot.gameState?.id ?? latest?.snapshot.gameState?.id ?? "unknown";

    db.prepare(`
      INSERT INTO active_games (
        session_code,
        game_id,
        revision,
        snapshot_json,
        updated_at,
        updated_by_player_id,
        updated_by_device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_code) DO UPDATE SET
        game_id = excluded.game_id,
        revision = excluded.revision,
        snapshot_json = excluded.snapshot_json,
        updated_at = excluded.updated_at,
        updated_by_player_id = excluded.updated_by_player_id,
        updated_by_device_id = excluded.updated_by_device_id
    `).run(
      session.code,
      gameId,
      nextRevision,
      JSON.stringify(input.snapshot),
      timestamp,
      input.updatedByPlayerId,
      input.updatedByDeviceId,
    );

    const activeGame = getSharedActiveGame(session.code);

    if (activeGame === null) {
      throw new Error(`Failed to save active game for shared session ${session.code}.`);
    }

    return { ok: true, activeGame };
  })();
}

export function saveSharedCompletedGame(input: {
  sessionCode: string;
  gameId: string;
  completedAt: string;
  snapshot: SharedActiveGameSnapshot;
  eventLog: readonly GameEvent[];
  idempotencyKey: string;
  expectedRevision: number;
  savedByPlayerId: PlayerId | null;
  savedByDeviceId: string | null;
}): SaveCompletedGameResult {
  const session = ensureSharedSession(input.sessionCode);
  const db = getDatabase();

  return db.transaction((): SaveCompletedGameResult => {
    const existing = getCompletedGameByIdempotencyKey(db, session.code, input.idempotencyKey);

    if (existing !== null) {
      return { ok: true, completedGame: existing };
    }

    const activeRow = db
      .prepare(`
        SELECT session_code, game_id, revision, snapshot_json, updated_at, updated_by_player_id, updated_by_device_id
        FROM active_games
        WHERE session_code = ?
      `)
      .get(session.code) as ActiveGameRow | undefined;
    const latestRevision = activeRow?.revision ?? 0;

    if (activeRow === undefined || activeRow.game_id !== input.gameId || latestRevision !== input.expectedRevision) {
      return {
        ok: false,
        latest: activeRow === undefined ? null : rowToActiveGame(activeRow),
        revision: latestRevision,
      };
    }

    const completedCount = db
      .prepare("SELECT COUNT(*) AS count FROM completed_games WHERE session_code = ?")
      .get(session.code) as { count: number };

    if (completedCount.count >= MAX_COMPLETED_GAMES_PER_SESSION) {
      throw new HttpResponseError(409, "Shared session completed-game limit reached.");
    }

    const timestamp = nowIso();
    const id = `completed-${randomUUID()}`;

    db.prepare(`
      INSERT OR IGNORE INTO completed_games (
        id,
        session_code,
        game_id,
        completed_at,
        snapshot_json,
        event_log_json,
        idempotency_key,
        created_at,
        saved_by_player_id,
        saved_by_device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      session.code,
      input.gameId,
      input.completedAt,
      JSON.stringify(input.snapshot),
      JSON.stringify(input.eventLog),
      input.idempotencyKey,
      timestamp,
      input.savedByPlayerId,
      input.savedByDeviceId,
    );

    db.prepare("DELETE FROM active_games WHERE session_code = ? AND game_id = ? AND revision = ?")
      .run(session.code, input.gameId, input.expectedRevision);

    const completedGame = getCompletedGameByIdempotencyKey(db, session.code, input.idempotencyKey);

    if (completedGame === null) {
      throw new Error(`Failed to save completed game for shared session ${session.code}.`);
    }

    return { ok: true, completedGame };
  })();
}
