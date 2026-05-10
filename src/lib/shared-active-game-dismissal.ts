import type { SharedActiveGame } from "@/types";

const STORAGE_KEY = "flechettas.dismissedSharedActiveGames";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): Record<string, string> {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return { ...(parsed as Record<string, string>) };
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, string>): void {
  if (!isBrowser()) {
    return;
  }

  try {
    if (Object.keys(map).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * After a server fetch: drop a stale dismissal if the session has no active game,
 * or the active game id no longer matches what the user hid on this device.
 */
export function reconcileSharedActiveGameDismissal(
  sessionCode: string,
  activeGame: SharedActiveGame | null,
): void {
  const dismissedId = readDismissedSharedActiveGameId(sessionCode);

  if (dismissedId === null) {
    return;
  }

  if (activeGame === null) {
    clearDismissedSharedActiveGame(sessionCode);

    return;
  }

  const currentId = activeGame.snapshot.gameState?.id;

  if (currentId === undefined || currentId !== dismissedId) {
    clearDismissedSharedActiveGame(sessionCode);
  }
}

export function readDismissedSharedActiveGameId(sessionCode: string): string | null {
  const id = readAll()[sessionCode];

  return typeof id === "string" && id.length > 0 ? id : null;
}

export function dismissSharedActiveGameOnDevice(sessionCode: string, gameId: string): void {
  if (!isBrowser() || gameId.length === 0) {
    return;
  }

  const next = readAll();
  next[sessionCode] = gameId;
  writeAll(next);
}

export function clearDismissedSharedActiveGame(sessionCode: string): void {
  if (!isBrowser()) {
    return;
  }

  const next = readAll();

  if (!(sessionCode in next)) {
    return;
  }

  delete next[sessionCode];
  writeAll(next);
}

export function isSharedActiveGameDismissedOnDevice(
  sessionCode: string,
  activeGame: SharedActiveGame,
): boolean {
  const dismissedId = readDismissedSharedActiveGameId(sessionCode);
  const currentId = activeGame.snapshot.gameState?.id;

  return dismissedId !== null && currentId !== undefined && dismissedId === currentId;
}
