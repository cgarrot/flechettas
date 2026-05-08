import type { Dart, Multiplier, NumberSegment, Turn } from "@/types";

import { turnScore } from "./utils";

const NUMBER_SEGMENTS = new Set<number>([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
]);

const MULTIPLIERS = new Set<number>([1, 2, 3]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isNumberSegment(segment: unknown): segment is NumberSegment {
  return typeof segment === "number" && Number.isInteger(segment) && NUMBER_SEGMENTS.has(segment);
}

export function isMultiplier(multiplier: unknown): multiplier is Multiplier {
  return typeof multiplier === "number" && Number.isInteger(multiplier) && MULTIPLIERS.has(multiplier);
}

export function isValidDart(dart: unknown): dart is Dart {
  if (!isRecord(dart)) {
    return false;
  }

  if (hasOwn(dart, "miss")) {
    return dart.miss === true && !hasOwn(dart, "segment") && !hasOwn(dart, "multiplier");
  }

  if (!hasOwn(dart, "segment") || !hasOwn(dart, "multiplier")) {
    return false;
  }

  const { segment, multiplier } = dart;

  if (isNumberSegment(segment)) {
    return isMultiplier(multiplier);
  }

  if (segment === 25 || segment === 50) {
    return multiplier === 1;
  }

  return false;
}

export function isValidTurn(turn: unknown): turn is Turn {
  return Array.isArray(turn) && turn.length <= 3 && turn.every(isValidDart);
}

export function isValidTurnTotal(darts: readonly Dart[]): boolean {
  return isValidTurn(darts) && turnScore(darts) <= 180;
}
