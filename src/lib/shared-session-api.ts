import type {
  GameEvent,
  PlayerId,
  SharedActiveGame,
  SharedActiveGameSnapshot,
  SharedCompletedGame,
  SharedSessionPlayer,
  SharedSessionSummary,
} from "@/types";

type SessionResponse = {
  session: SharedSessionSummary;
};

type PlayerResponse = SessionResponse & {
  player: SharedSessionPlayer;
};

type ActiveGameResponse = {
  activeGame: SharedActiveGame | null;
};

type ActiveGameConflictResponse = ActiveGameResponse & {
  error: "revision_conflict";
  revision: number;
};

type CompletedGameResponse = {
  completedGame: SharedCompletedGame;
};

type CompletedGameConflictResponse = {
  error: "revision_conflict";
  activeGame: SharedActiveGame | null;
  revision: number;
};

export type SaveSharedActiveGameClientResult =
  | { ok: true; activeGame: SharedActiveGame }
  | { ok: false; conflict: true; activeGame: SharedActiveGame | null; revision: number };

export type SaveSharedCompletedGameClientResult =
  | { ok: true; completedGame: SharedCompletedGame }
  | { ok: false; conflict: true; activeGame: SharedActiveGame | null; revision: number };

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const parsed: unknown = await response.json();

  return parsed as T;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} for ${url}.`);
  }

  return parseJsonResponse<T>(response);
}

export async function createSharedSession(code?: string): Promise<SharedSessionSummary> {
  const response = await requestJson<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(code ? { code } : {}),
  });

  return response.session;
}

export async function ensureSharedSession(code: string): Promise<SharedSessionSummary> {
  const response = await requestJson<SessionResponse>(`/api/sessions/${encodeURIComponent(code)}`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.session;
}

export async function fetchSharedSession(code: string): Promise<SharedSessionSummary> {
  const response = await requestJson<SessionResponse>(`/api/sessions/${encodeURIComponent(code)}`);

  return response.session;
}

export async function createSharedSessionPlayer(code: string, name: string): Promise<PlayerResponse> {
  return requestJson<PlayerResponse>(`/api/sessions/${encodeURIComponent(code)}/players`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteSharedSessionPlayer(code: string, playerId: PlayerId): Promise<SharedSessionSummary> {
  const response = await requestJson<SessionResponse>(`/api/sessions/${encodeURIComponent(code)}/players`, {
    method: "DELETE",
    body: JSON.stringify({ playerId }),
  });

  return response.session;
}

export async function fetchSharedActiveGame(code: string): Promise<SharedActiveGame | null> {
  const response = await requestJson<ActiveGameResponse>(`/api/sessions/${encodeURIComponent(code)}/active-game`);

  return response.activeGame;
}

export async function saveSharedActiveGame(input: {
  code: string;
  snapshot: SharedActiveGameSnapshot;
  expectedRevision: number;
  updatedByPlayerId: PlayerId | null;
  updatedByDeviceId: string | null;
}): Promise<SaveSharedActiveGameClientResult> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(input.code)}/active-game`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      snapshot: input.snapshot,
      expectedRevision: input.expectedRevision,
      updatedByPlayerId: input.updatedByPlayerId,
      updatedByDeviceId: input.updatedByDeviceId,
    }),
  });

  if (response.status === 409) {
    const body = await parseJsonResponse<ActiveGameConflictResponse>(response);

    return {
      ok: false,
      conflict: true,
      activeGame: body.activeGame,
      revision: body.revision,
    };
  }

  if (!response.ok) {
    throw new Error(`Active game save failed with ${response.status}.`);
  }

  const body = await parseJsonResponse<ActiveGameResponse>(response);

  if (body.activeGame === null) {
    throw new Error("Active game save returned no snapshot.");
  }

  return { ok: true, activeGame: body.activeGame };
}

export async function saveSharedCompletedGame(input: {
  code: string;
  gameId: string;
  completedAt: string;
  snapshot: SharedActiveGameSnapshot;
  eventLog: readonly GameEvent[];
  idempotencyKey: string;
  expectedRevision: number;
  savedByPlayerId: PlayerId | null;
  savedByDeviceId: string | null;
}): Promise<SaveSharedCompletedGameClientResult> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(input.code)}/completed-games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (response.status === 409) {
    const body = await parseJsonResponse<CompletedGameConflictResponse>(response);

    return {
      ok: false,
      conflict: true,
      activeGame: body.activeGame,
      revision: body.revision,
    };
  }

  if (!response.ok) {
    throw new Error(`Completed game save failed with ${response.status}.`);
  }

  const body = await parseJsonResponse<CompletedGameResponse>(response);

  return { ok: true, completedGame: body.completedGame };
}
