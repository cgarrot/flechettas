import type { Dart, NumberSegment } from "@/types";

import { BULLSEYE, SINGLE_BULL } from "./bull-values";

const MIN_CHECKOUT = 2;
const MAX_CHECKOUT = 170;
const MAX_CANONICAL_ROUTES_PER_SCORE = 12;

export const BOGEY_SCORES = [169, 168, 166, 165, 163, 162, 159] as const;

const BOGEY_SCORE_SET = new Set<number>(BOGEY_SCORES);

const NUMBER_SEGMENTS = [
  20,
  19,
  18,
  17,
  16,
  15,
  14,
  13,
  12,
  11,
  10,
  9,
  8,
  7,
  6,
  5,
  4,
  3,
  2,
  1,
] satisfies readonly NumberSegment[];

const PREFERRED_DOUBLE_SEGMENTS = [
  20,
  16,
  10,
  8,
  18,
  12,
  4,
  2,
  1,
  15,
  19,
  17,
  13,
  11,
  9,
  7,
  6,
  5,
  3,
  14,
] satisfies readonly NumberSegment[];

function single(segment: NumberSegment): Dart {
  return { segment, multiplier: 1 };
}

function double(segment: NumberSegment): Dart {
  return { segment, multiplier: 2 };
}

function triple(segment: NumberSegment): Dart {
  return { segment, multiplier: 3 };
}

function singleBull(): Dart {
  return { segment: SINGLE_BULL, multiplier: 1 };
}

function bullseye(): Dart {
  return { segment: BULLSEYE, multiplier: 1 };
}

const FINISH_DARTS: Dart[] = [
  ...PREFERRED_DOUBLE_SEGMENTS.map(double),
  bullseye(),
];

const SETUP_DARTS: Dart[] = [
  ...NUMBER_SEGMENTS.map(triple),
  bullseye(),
  ...PREFERRED_DOUBLE_SEGMENTS.map(double),
  singleBull(),
  ...NUMBER_SEGMENTS.map(single),
];

function scoreDart(dart: Dart): number {
  if ("miss" in dart) {
    return 0;
  }

  return dart.segment * dart.multiplier;
}

function routeScore(route: Dart[]): number {
  return route.reduce((total, dart) => total + scoreDart(dart), 0);
}

function dartKey(dart: Dart): string {
  if ("miss" in dart) {
    return "M";
  }

  return `${dart.multiplier}:${dart.segment}`;
}

function routeKey(route: Dart[]): string {
  return route.map(dartKey).join("|");
}

function finishPreferenceIndex(dart: Dart): number {
  if ("miss" in dart) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (dart.segment === BULLSEYE) {
    return PREFERRED_DOUBLE_SEGMENTS.length;
  }

  if (dart.multiplier !== 2) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = PREFERRED_DOUBLE_SEGMENTS.indexOf(dart.segment);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function setupDoublePenalty(route: Dart[]): number {
  return route
    .slice(0, -1)
    .reduce(
      (penalty, dart) =>
        "miss" in dart || dart.multiplier !== 2 ? penalty : penalty + 1,
      0,
    );
}

function setupDartQuality(dart: Dart): number {
  if ("miss" in dart) {
    return 0;
  }

  const score = scoreDart(dart);

  if (dart.multiplier === 3) {
    return 3_000 + score;
  }

  if (dart.segment === BULLSEYE) {
    return 2_500 + score;
  }

  if (dart.segment === SINGLE_BULL) {
    return 2_000 + score;
  }

  if (dart.multiplier === 1) {
    return 1_500 + score;
  }

  return 1_000 + score;
}

function setupQuality(route: Dart[]): number {
  return route.slice(0, -1).reduce((quality, dart, index) => {
    const positionWeight = route.length - index;
    return quality + setupDartQuality(dart) * positionWeight;
  }, 0);
}

function compareRoutes(left: Dart[], right: Dart[]): number {
  const lengthDiff = left.length - right.length;

  if (lengthDiff !== 0) {
    return lengthDiff;
  }

  const setupPenaltyDiff = setupDoublePenalty(left) - setupDoublePenalty(right);

  if (setupPenaltyDiff !== 0) {
    return setupPenaltyDiff;
  }

  const finishDiff =
    finishPreferenceIndex(left[left.length - 1]) -
    finishPreferenceIndex(right[right.length - 1]);

  if (finishDiff !== 0) {
    return finishDiff;
  }

  const setupDiff = setupQuality(right) - setupQuality(left);

  if (setupDiff !== 0) {
    return setupDiff;
  }

  return routeKey(left).localeCompare(routeKey(right));
}

function cloneDart(dart: Dart): Dart {
  if ("miss" in dart) {
    return { miss: true };
  }

  if (dart.segment === SINGLE_BULL) {
    return { segment: SINGLE_BULL, multiplier: 1 };
  }

  if (dart.segment === BULLSEYE) {
    return { segment: BULLSEYE, multiplier: 1 };
  }

  return { segment: dart.segment, multiplier: dart.multiplier };
}

function cloneRoute(route: Dart[]): Dart[] {
  return route.map(cloneDart);
}

function isInCheckoutRange(score: number): boolean {
  return score >= MIN_CHECKOUT && score <= MAX_CHECKOUT;
}

function createCheckoutMap(): Map<number, Dart[][]> {
  const routesByScore = new Map<number, Dart[][]>();
  const routeKeysByScore = new Map<number, Set<string>>();

  for (let score = MIN_CHECKOUT; score <= MAX_CHECKOUT; score += 1) {
    routesByScore.set(score, []);
    routeKeysByScore.set(score, new Set());
  }

  function addRoute(route: Dart[]): void {
    const score = routeScore(route);

    if (!isInCheckoutRange(score) || BOGEY_SCORE_SET.has(score)) {
      return;
    }

    const routes = routesByScore.get(score);
    const keys = routeKeysByScore.get(score);

    if (routes === undefined || keys === undefined) {
      return;
    }

    const key = routeKey(route);

    if (keys.has(key)) {
      return;
    }

    keys.add(key);
    routes.push(route.map(cloneDart));
  }

  for (const finish of FINISH_DARTS) {
    addRoute([finish]);
  }

  for (const setup of SETUP_DARTS) {
    for (const finish of FINISH_DARTS) {
      addRoute([setup, finish]);
    }
  }

  for (let firstIndex = 0; firstIndex < SETUP_DARTS.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex;
      secondIndex < SETUP_DARTS.length;
      secondIndex += 1
    ) {
      for (const finish of FINISH_DARTS) {
        addRoute([SETUP_DARTS[firstIndex], SETUP_DARTS[secondIndex], finish]);
      }
    }
  }

  for (const [score, routes] of routesByScore) {
    routes.sort(compareRoutes);

    const oneDartRoutes = routes.filter((route) => route.length === 1);

    if (oneDartRoutes.length > 0) {
      routesByScore.set(score, oneDartRoutes);
      continue;
    }

    routesByScore.set(score, routes.slice(0, MAX_CANONICAL_ROUTES_PER_SCORE));
  }

  return routesByScore;
}

export const CHECKOUTS: Map<number, Dart[][]> = createCheckoutMap();

export function isBogeyScore(score: number): boolean {
  return BOGEY_SCORE_SET.has(score);
}

export function getCheckouts(score: number): Dart[][] {
  const routes = CHECKOUTS.get(score);

  if (routes === undefined) {
    return [];
  }

  return routes.map(cloneRoute);
}
