import type { Dart, Turn } from "@/types";

function isRuntimeDart(dart: Dart): boolean {
  if ("miss" in dart) {
    return dart.miss === true;
  }

  if (dart.segment === 25 || dart.segment === 50) {
    return dart.multiplier === 1;
  }

  return dart.segment >= 1 && dart.segment <= 20 && dart.multiplier >= 1 && dart.multiplier <= 3;
}

const MULTIPLIER_LABELS = {
  1: "S",
  2: "D",
  3: "T",
} as const;

export function dartScore(dart: Dart): number {
  if (!isRuntimeDart(dart) || "miss" in dart) {
    return 0;
  }

  return dart.segment * dart.multiplier;
}

export function turnScore(turn: Turn): number {
  return turn.reduce((score, dart) => score + dartScore(dart), 0);
}

export function formatDart(dart: Dart): string {
  if (!isRuntimeDart(dart)) {
    return "INVALID";
  }

  if ("miss" in dart) {
    return "MISS";
  }

  if (dart.segment === 25) {
    return "SB";
  }

  if (dart.segment === 50) {
    return "BULL";
  }

  return `${MULTIPLIER_LABELS[dart.multiplier]}${dart.segment}`;
}
