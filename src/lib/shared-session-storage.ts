import type { PlayerId } from "@/types";

import { normalizeSharedSessionCode } from "@/lib/shared-session-code";

export const SESSION_CODE_KEY = "flechettas.sessionCode";
export const SESSION_DEVICE_ID_KEY = "flechettas.session.deviceId";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function sessionPlayerKey(code: string): string {
  return `flechettas.session.${code}.playerId`;
}

export function normalizeStoredSessionCode(value: string): string {
  return normalizeSharedSessionCode(value);
}

export function readStoredSessionCode(): string | null {
  if (!hasStorage()) {
    return null;
  }

  const code = normalizeStoredSessionCode(window.localStorage.getItem(SESSION_CODE_KEY) ?? "");

  return code.length > 0 ? code : null;
}

export function writeStoredSessionCode(code: string): string {
  const normalizedCode = normalizeStoredSessionCode(code);

  if (hasStorage()) {
    window.localStorage.setItem(SESSION_CODE_KEY, normalizedCode);
  }

  return normalizedCode;
}

export function clearStoredSessionCode(): void {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(SESSION_CODE_KEY);
}

export function readStoredSessionPlayerId(code: string): PlayerId | null {
  if (!hasStorage()) {
    return null;
  }

  const playerId = window.localStorage.getItem(sessionPlayerKey(code));

  return playerId && playerId.length > 0 ? playerId : null;
}

export function writeStoredSessionPlayerId(code: string, playerId: PlayerId): void {
  if (hasStorage()) {
    window.localStorage.setItem(sessionPlayerKey(code), playerId);
  }
}

export function clearStoredSessionPlayerId(code: string): void {
  if (hasStorage()) {
    window.localStorage.removeItem(sessionPlayerKey(code));
  }
}

export function readOrCreateDeviceId(): string {
  if (!hasStorage()) {
    return "server-render";
  }

  const existingDeviceId = window.localStorage.getItem(SESSION_DEVICE_ID_KEY);

  if (existingDeviceId && existingDeviceId.length > 0) {
    return existingDeviceId;
  }

  const deviceId = `device-${crypto.randomUUID()}`;

  window.localStorage.setItem(SESSION_DEVICE_ID_KEY, deviceId);

  return deviceId;
}
