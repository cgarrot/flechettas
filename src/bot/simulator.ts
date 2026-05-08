import { getCheckouts } from "../data/checkouts";
import type {
  AroundTheClockConfig,
  AroundTheClockPlayerModeState,
  Bobs27Config,
  Bobs27PlayerModeState,
  BotProfile,
  Checkout121Config,
  Checkout121PlayerModeState,
  CricketConfig,
  CricketMarkMap,
  CricketPlayerModeState,
  CricketTarget,
  Dart,
  DartTarget,
  GameConfig,
  GameMode,
  GameState,
  KillerConfig,
  KillerPlayerModeState,
  Multiplier,
  NumberSegment,
  PlayerId,
  PlayerModeState,
  PlayerState,
  Segment,
  ShanghaiConfig,
  ShanghaiPlayerModeState,
  TrainingConfig,
  TrainingPlayerModeState,
  Turn,
} from "../types";

export type BotSeed = string | number;

export type BotRng = () => number;

export type BotDartOptions = {
  rng?: BotRng;
  seed?: BotSeed;
  pressure?: "checkout" | "cricket" | "scoring" | "training" | "normal";
};

export type BotTurnOptions = BotDartOptions & {
  gameState?: GameState;
  playerId?: PlayerId;
  playerState?: PlayerState;
  target?: DartTarget;
  cricketTargets?: readonly CricketTarget[];
};

type WeightedDart = {
  weight: number;
  dart: Dart;
};

type CricketSnapshot = {
  targets: readonly CricketTarget[];
  ownMarks: Map<CricketTarget, number>;
  opponentMarks: readonly CricketMarkMap[];
};

const NUMBER_SEGMENTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const satisfies readonly NumberSegment[];
const BOARD_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const satisfies readonly NumberSegment[];
const DEFAULT_CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const satisfies readonly CricketTarget[];
const DEFAULT_SHANGHAI_ROUNDS = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly NumberSegment[];
const DEFAULT_TRAINING_TARGETS = [{ segment: 20, multiplier: 3 }] as const satisfies readonly DartTarget[];
const NUMBER_SEGMENT_SET = new Set<number>(NUMBER_SEGMENTS);
const CRICKET_TARGET_SET = new Set<number>(DEFAULT_CRICKET_TARGETS);
const CLOSED_CRICKET_MARKS = 3;
const MAX_DARTS_PER_TURN = 3;
const MAX_X01_CHECKOUT = 170;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isNumberSegment(value: number): value is NumberSegment {
  return Number.isInteger(value) && NUMBER_SEGMENT_SET.has(value);
}

function isCricketTarget(value: number): value is CricketTarget {
  return Number.isInteger(value) && CRICKET_TARGET_SET.has(value);
}

function isMultiplier(value: number | undefined): value is Multiplier {
  return value === 1 || value === 2 || value === 3;
}

function isFiniteInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

function skillRatio(profile: BotProfile): number {
  return clamp(profile.avg3Dart / 120, 0.05, 1);
}

function checkoutProbability(profile: BotProfile): number {
  return clamp(profile.checkoutRate / 100, 0, 1);
}

function hashSeed(seed: BotSeed): number {
  const text = String(seed);
  let hash = 2_166_136_261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function createSeededRng(seed: BotSeed): BotRng {
  let state = hashSeed(seed) || 0x6d2b79f5;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function rngFor(options: BotDartOptions | undefined): BotRng {
  if (options?.rng) {
    return options.rng;
  }

  if (options?.seed !== undefined) {
    return createSeededRng(options.seed);
  }

  return Math.random;
}

function withRng(options: BotDartOptions | undefined, rng: BotRng): BotDartOptions {
  return {
    ...options,
    rng,
    seed: undefined,
  };
}

function numberDart(segment: NumberSegment, multiplier: Multiplier): Dart {
  return { segment, multiplier };
}

function singleBull(): Dart {
  return { segment: 25, multiplier: 1 };
}

function bullseye(): Dart {
  return { segment: 50, multiplier: 1 };
}

function miss(): Dart {
  return { miss: true };
}

function cloneDart(dart: Dart): Dart {
  if ("miss" in dart) {
    return miss();
  }

  if (dart.segment === 25) {
    return singleBull();
  }

  if (dart.segment === 50) {
    return bullseye();
  }

  return numberDart(dart.segment, dart.multiplier);
}

function cloneTurn(turn: readonly Dart[]): Dart[] {
  return turn.map(cloneDart);
}

function dartScore(dart: Dart): number {
  if ("miss" in dart) {
    return 0;
  }

  return dart.segment * dart.multiplier;
}

function normalizeTarget(targetPreference: DartTarget | Segment): DartTarget {
  const target = typeof targetPreference === "number"
    ? { segment: targetPreference }
    : targetPreference;

  if (target.segment === 50) {
    return { segment: 50, multiplier: 1 };
  }

  if (target.segment === 25) {
    return { segment: 25, multiplier: 1 };
  }

  return {
    segment: target.segment,
    multiplier: isMultiplier(target.multiplier) ? target.multiplier : undefined,
  };
}

function dartFromTarget(target: DartTarget): Dart {
  if (target.segment === 50) {
    return bullseye();
  }

  if (target.segment === 25) {
    return singleBull();
  }

  return numberDart(target.segment, target.multiplier ?? 1);
}

function targetFromDart(dart: Dart | undefined, fallback: DartTarget): DartTarget {
  if (!dart || "miss" in dart) {
    return fallback;
  }

  if (dart.segment === 50) {
    return { segment: 50, multiplier: 1 };
  }

  if (dart.segment === 25) {
    return { segment: 25, multiplier: 1 };
  }

  return { segment: dart.segment, multiplier: dart.multiplier };
}

function dartsEqual(left: Dart, right: Dart): boolean {
  if ("miss" in left || "miss" in right) {
    return "miss" in left && "miss" in right;
  }

  return left.segment === right.segment && left.multiplier === right.multiplier;
}

function chooseWeightedDart(rng: BotRng, outcomes: readonly WeightedDart[]): Dart {
  const positiveOutcomes = outcomes.filter((outcome) => outcome.weight > 0);
  const totalWeight = positiveOutcomes.reduce((total, outcome) => total + outcome.weight, 0);

  if (totalWeight <= 0) {
    return miss();
  }

  let threshold = rng() * totalWeight;

  for (const outcome of positiveOutcomes) {
    threshold -= outcome.weight;

    if (threshold <= 0) {
      return cloneDart(outcome.dart);
    }
  }

  return cloneDart(positiveOutcomes[positiveOutcomes.length - 1].dart);
}

function boardNeighbor(segment: NumberSegment, direction: -1 | 1): NumberSegment {
  const index = BOARD_ORDER.indexOf(segment);
  const nextIndex = (index + direction + BOARD_ORDER.length) % BOARD_ORDER.length;

  return BOARD_ORDER[nextIndex];
}

function effectiveTripleRate(profile: BotProfile, pressure: BotDartOptions["pressure"]): number {
  if (pressure === "checkout") {
    return clamp(profile.tripleRate, 0, 0.75);
  }

  const skill = skillRatio(profile);
  const boost = profile.tripleRate * skill * 0.55;

  return clamp(profile.tripleRate + boost, profile.tripleRate, 0.62);
}

function scatterChance(profile: BotProfile): number {
  return clamp(0.82 - skillRatio(profile) * 0.72, 0.08, 0.72);
}

function calibratedTripleSingleRate(
  profile: BotProfile,
  target: NumberSegment,
  tripleChance: number,
  scatter: number,
  pressure: BotDartOptions["pressure"],
): number {
  const available = Math.max(0, 0.97 - tripleChance - scatter);

  if (target !== 20 || pressure === "checkout") {
    return clamp(0.24 + skillRatio(profile) * 0.4, 0.08, available);
  }

  const desiredPerDart = profile.avg3Dart / 3;
  const estimatedScatterScore = 2.7 + skillRatio(profile) * 5;
  const needed = (desiredPerDart - tripleChance * 60 - scatter * estimatedScatterScore) / 20;

  return clamp(needed, 0.04, available);
}

function generateNumberTripleDart(
  profile: BotProfile,
  target: NumberSegment,
  options: BotDartOptions | undefined,
): Dart {
  const rng = rngFor(options);
  const tripleChance = effectiveTripleRate(profile, options?.pressure);
  const scatter = scatterChance(profile);
  const singleChance = calibratedTripleSingleRate(
    profile,
    target,
    tripleChance,
    scatter,
    options?.pressure,
  );
  const left = boardNeighbor(target, -1);
  const right = boardNeighbor(target, 1);
  const highRingShare = clamp(skillRatio(profile) * 0.15, 0.02, 0.15);
  const neighborSingleShare = (1 - highRingShare) / 2;
  const neighborTripleShare = highRingShare * 0.35;
  const targetDoubleShare = highRingShare * 0.3;
  const positiveWeight = tripleChance + singleChance + scatter;

  return chooseWeightedDart(rng, [
    { weight: tripleChance, dart: numberDart(target, 3) },
    { weight: singleChance, dart: numberDart(target, 1) },
    { weight: scatter * neighborSingleShare, dart: numberDart(left, 1) },
    { weight: scatter * neighborSingleShare, dart: numberDart(right, 1) },
    { weight: scatter * neighborTripleShare, dart: numberDart(left, 3) },
    { weight: scatter * neighborTripleShare, dart: numberDart(right, 3) },
    { weight: scatter * targetDoubleShare, dart: numberDart(target, 2) },
    { weight: Math.max(0, 1 - positiveWeight), dart: miss() },
  ]);
}

function generateNumberDoubleDart(profile: BotProfile, target: NumberSegment, options: BotDartOptions | undefined): Dart {
  const rng = rngFor(options);
  const skill = skillRatio(profile);
  const doubleChance = clamp(profile.doubleRate, 0, 0.85);
  const scatter = clamp(0.18 - skill * 0.08, 0.06, 0.16);
  const singleChance = clamp(0.34 + skill * 0.22, 0.18, Math.max(0, 0.96 - doubleChance - scatter));
  const left = boardNeighbor(target, -1);
  const right = boardNeighbor(target, 1);
  const positiveWeight = doubleChance + singleChance + scatter;

  return chooseWeightedDart(rng, [
    { weight: doubleChance, dart: numberDart(target, 2) },
    { weight: singleChance, dart: numberDart(target, 1) },
    { weight: scatter * 0.25, dart: numberDart(left, 2) },
    { weight: scatter * 0.25, dart: numberDart(right, 2) },
    { weight: scatter * 0.25, dart: numberDart(left, 1) },
    { weight: scatter * 0.25, dart: numberDart(right, 1) },
    { weight: Math.max(0, 1 - positiveWeight), dart: miss() },
  ]);
}

function generateNumberSingleDart(profile: BotProfile, target: NumberSegment, options: BotDartOptions | undefined): Dart {
  const rng = rngFor(options);
  const skill = skillRatio(profile);
  const singleChance = clamp(0.34 + skill * 0.5, 0.18, 0.9);
  const scatter = clamp(0.28 - skill * 0.16, 0.08, 0.26);
  const left = boardNeighbor(target, -1);
  const right = boardNeighbor(target, 1);
  const positiveWeight = singleChance + scatter;

  return chooseWeightedDart(rng, [
    { weight: singleChance, dart: numberDart(target, 1) },
    { weight: scatter * 0.4, dart: numberDart(left, 1) },
    { weight: scatter * 0.4, dart: numberDart(right, 1) },
    { weight: scatter * 0.1, dart: numberDart(target, 2) },
    { weight: scatter * 0.1, dart: numberDart(target, 3) },
    { weight: Math.max(0, 1 - positiveWeight), dart: miss() },
  ]);
}

function generateBullseyeDart(profile: BotProfile, options: BotDartOptions | undefined): Dart {
  const rng = rngFor(options);
  const skill = skillRatio(profile);
  const bullChance = clamp(profile.doubleRate, 0, 0.8);
  const singleBullChance = clamp(0.22 + skill * 0.3, 0.16, Math.max(0, 0.94 - bullChance));
  const numberScatter = clamp(0.16 - skill * 0.07, 0.05, 0.14);
  const positiveWeight = bullChance + singleBullChance + numberScatter;

  return chooseWeightedDart(rng, [
    { weight: bullChance, dart: bullseye() },
    { weight: singleBullChance, dart: singleBull() },
    { weight: numberScatter * 0.4, dart: numberDart(20, 1) },
    { weight: numberScatter * 0.35, dart: numberDart(5, 1) },
    { weight: numberScatter * 0.25, dart: numberDart(1, 1) },
    { weight: Math.max(0, 1 - positiveWeight), dart: miss() },
  ]);
}

function generateSingleBullDart(profile: BotProfile, options: BotDartOptions | undefined): Dart {
  const rng = rngFor(options);
  const skill = skillRatio(profile);
  const singleBullChance = clamp(0.38 + skill * 0.34, 0.22, 0.86);
  const bullChance = clamp(profile.doubleRate * 0.22, 0.01, 0.18);
  const numberScatter = clamp(0.2 - skill * 0.08, 0.08, 0.18);
  const positiveWeight = singleBullChance + bullChance + numberScatter;

  return chooseWeightedDart(rng, [
    { weight: singleBullChance, dart: singleBull() },
    { weight: bullChance, dart: bullseye() },
    { weight: numberScatter * 0.4, dart: numberDart(20, 1) },
    { weight: numberScatter * 0.35, dart: numberDart(5, 1) },
    { weight: numberScatter * 0.25, dart: numberDart(1, 1) },
    { weight: Math.max(0, 1 - positiveWeight), dart: miss() },
  ]);
}

export function generateBotDart(
  profile: BotProfile,
  targetPreference: DartTarget | Segment,
  options?: BotDartOptions,
): Dart {
  const target = normalizeTarget(targetPreference);

  if (target.segment === 50) {
    return generateBullseyeDart(profile, options);
  }

  if (target.segment === 25) {
    return generateSingleBullDart(profile, options);
  }

  if (target.multiplier === 3) {
    return generateNumberTripleDart(profile, target.segment, options);
  }

  if (target.multiplier === 2) {
    return generateNumberDoubleDart(profile, target.segment, options);
  }

  return generateNumberSingleDart(profile, target.segment, options);
}

function safeRemaining(remaining: number): number {
  return isFiniteInteger(remaining) ? Math.max(0, remaining) : 0;
}

function exactCheckoutRoute(remaining: number): Dart[] | undefined {
  const routes = getCheckouts(remaining);

  return routes[0] ? cloneTurn(routes[0]) : undefined;
}

function isX01Bust(remainingBeforeDart: number, dart: Dart): boolean {
  const score = dartScore(dart);

  if (score === 0) {
    return false;
  }

  const nextRemaining = remainingBeforeDart - score;

  return nextRemaining < 0 || nextRemaining === 1;
}

function generateX01Turn(profile: BotProfile, remaining: number, options: BotTurnOptions | undefined): Dart[] {
  const rng = rngFor(options);
  const currentRemaining = safeRemaining(remaining);
  const initialRoute = currentRemaining <= MAX_X01_CHECKOUT ? exactCheckoutRoute(currentRemaining) : undefined;

  if (initialRoute && rng() < checkoutProbability(profile)) {
    return initialRoute.slice(0, MAX_DARTS_PER_TURN);
  }

  const turn: Dart[] = [];
  let nextRemaining = currentRemaining;

  while (turn.length < MAX_DARTS_PER_TURN && nextRemaining > 0) {
    const route = nextRemaining <= MAX_X01_CHECKOUT ? exactCheckoutRoute(nextRemaining) : undefined;
    const target = targetFromDart(route?.[0], { segment: 20, multiplier: 3 });
    const pressure = route ? "checkout" : "scoring";
    const dart = generateBotDart(profile, target, withRng({ ...options, pressure }, rng));

    turn.push(dart);

    if (isX01Bust(nextRemaining, dart)) {
      break;
    }

    nextRemaining -= dartScore(dart);

    if (nextRemaining === 0) {
      break;
    }
  }

  return turn;
}

function resolvePlayer(options: BotTurnOptions | undefined): PlayerState | undefined {
  if (options?.playerState) {
    return options.playerState;
  }

  const state = options?.gameState;

  if (!state) {
    return undefined;
  }

  const playerId = options.playerId ?? state.activePlayerId;

  return state.players.find((player) => player.id === playerId);
}

function configFromState(options: BotTurnOptions | undefined): GameConfig | undefined {
  return options?.gameState?.config;
}

function isCricketModeState(modeState: PlayerModeState | undefined): modeState is CricketPlayerModeState {
  return modeState?.mode === "cricket";
}

function isCricketConfig(config: GameConfig | undefined): config is CricketConfig {
  return config?.mode === "cricket";
}

function cricketTargetsFor(options: BotTurnOptions | undefined): readonly CricketTarget[] {
  const config = configFromState(options);
  const configuredTargets = options?.cricketTargets ?? (isCricketConfig(config)
    ? config.targets
    : undefined) ?? DEFAULT_CRICKET_TARGETS;
  const targets: CricketTarget[] = [];

  for (const target of configuredTargets) {
    if (isCricketTarget(target) && !targets.includes(target)) {
      targets.push(target);
    }
  }

  return targets.length > 0 ? targets : DEFAULT_CRICKET_TARGETS;
}

function cricketSnapshot(options: BotTurnOptions | undefined): CricketSnapshot {
  const player = resolvePlayer(options);
  const targets = cricketTargetsFor(options);
  const ownModeState = isCricketModeState(player?.modeState) ? player.modeState : undefined;
  const ownMarks = new Map<CricketTarget, number>();

  for (const target of targets) {
    ownMarks.set(target, ownModeState?.marks[target] ?? 0);
  }

  const state = options?.gameState;
  const playerId = player?.id ?? options?.playerId;
  const opponentMarks: CricketMarkMap[] = [];

  if (state) {
    for (const candidate of state.players) {
      if (candidate.id !== playerId && isCricketModeState(candidate.modeState)) {
        opponentMarks.push(candidate.modeState.marks);
      }
    }
  }

  return { targets, ownMarks, opponentMarks };
}

function allOpponentsClosed(snapshot: CricketSnapshot, target: CricketTarget): boolean {
  return snapshot.opponentMarks.length > 0 && snapshot.opponentMarks.every((marks) => (marks[target] ?? 0) >= CLOSED_CRICKET_MARKS);
}

function anyOpponentOpen(snapshot: CricketSnapshot, target: CricketTarget): boolean {
  return snapshot.opponentMarks.length === 0 || snapshot.opponentMarks.some((marks) => (marks[target] ?? 0) < CLOSED_CRICKET_MARKS);
}

function selectCricketTarget(snapshot: CricketSnapshot): CricketTarget {
  for (const target of snapshot.targets) {
    if ((snapshot.ownMarks.get(target) ?? 0) < CLOSED_CRICKET_MARKS) {
      return target;
    }
  }

  for (const target of snapshot.targets) {
    if ((snapshot.ownMarks.get(target) ?? 0) >= CLOSED_CRICKET_MARKS && anyOpponentOpen(snapshot, target)) {
      return target;
    }
  }

  return snapshot.targets.find((target) => !allOpponentsClosed(snapshot, target)) ?? snapshot.targets[0] ?? 20;
}

function cricketDartTarget(profile: BotProfile, target: CricketTarget): DartTarget {
  if (target === 25) {
    return profile.level >= 4 ? { segment: 50, multiplier: 1 } : { segment: 25, multiplier: 1 };
  }

  return { segment: target, multiplier: 3 };
}

function cricketMarksForDart(dart: Dart): { target: CricketTarget; marks: number } | undefined {
  if ("miss" in dart) {
    return undefined;
  }

  if (dart.segment === 50) {
    return { target: 25, marks: 2 };
  }

  if (dart.segment === 25) {
    return { target: 25, marks: 1 };
  }

  if (isCricketTarget(dart.segment)) {
    return { target: dart.segment, marks: dart.multiplier };
  }

  return undefined;
}

function generateCricketTurn(profile: BotProfile, options: BotTurnOptions | undefined): Dart[] {
  const rng = rngFor(options);
  const snapshot = cricketSnapshot(options);
  const turn: Dart[] = [];

  while (turn.length < MAX_DARTS_PER_TURN) {
    const target = selectCricketTarget(snapshot);
    const dart = generateBotDart(
      profile,
      cricketDartTarget(profile, target),
      withRng({ ...options, pressure: "cricket" }, rng),
    );
    const marks = cricketMarksForDart(dart);

    turn.push(dart);

    if (marks && snapshot.targets.includes(marks.target) && !allOpponentsClosed(snapshot, marks.target)) {
      snapshot.ownMarks.set(marks.target, (snapshot.ownMarks.get(marks.target) ?? 0) + marks.marks);
    }
  }

  return turn;
}

function isAroundTheClockModeState(
  modeState: PlayerModeState | undefined,
): modeState is AroundTheClockPlayerModeState {
  return modeState?.mode === "around-the-clock";
}

function isAroundTheClockConfig(config: GameConfig | undefined): config is AroundTheClockConfig {
  return config?.mode === "around-the-clock";
}

function aroundTheClockTargets(config: AroundTheClockConfig | undefined): readonly (NumberSegment | 25)[] {
  const start = config && isNumberSegment(config.startSegment) ? config.startSegment : 1;
  const end = config?.endSegment === 25 ? 20 : config?.endSegment ?? 20;
  const startIndex = NUMBER_SEGMENTS.indexOf(start);
  const endIndex = NUMBER_SEGMENTS.indexOf(end);
  const targets = startIndex <= endIndex
    ? NUMBER_SEGMENTS.slice(startIndex, endIndex + 1)
    : NUMBER_SEGMENTS.slice(endIndex, startIndex + 1).reverse();
  const withBull: (NumberSegment | 25)[] = [...targets];

  if ((config?.endSegment === 25 || config?.includeBull === true) && !withBull.includes(25)) {
    withBull.push(25);
  }

  return withBull.length > 0 ? withBull : [1];
}

function nextAroundTheClockTarget(
  currentTarget: NumberSegment | 25,
  config: AroundTheClockConfig | undefined,
): NumberSegment | 25 | undefined {
  const targets = aroundTheClockTargets(config);
  const index = targets.indexOf(currentTarget);

  return index === -1 ? targets[0] : targets[index + 1];
}

function aroundTheClockDartTarget(currentTarget: NumberSegment | 25, config: AroundTheClockConfig | undefined): DartTarget {
  const requiredMultiplier = config?.requiredMultiplier ?? "open";

  if (currentTarget === 25) {
    return requiredMultiplier === 2 ? { segment: 50, multiplier: 1 } : { segment: 25, multiplier: 1 };
  }

  return requiredMultiplier === "open"
    ? { segment: currentTarget, multiplier: 1 }
    : { segment: currentTarget, multiplier: requiredMultiplier };
}

function targetMatches(dart: Dart, target: DartTarget): boolean {
  if ("miss" in dart) {
    return false;
  }

  if (target.segment === 50) {
    return dart.segment === 50;
  }

  if (target.segment === 25) {
    return target.multiplier === undefined
      ? dart.segment === 25 || dart.segment === 50
      : dart.segment === 25 && dart.multiplier === target.multiplier;
  }

  return dart.segment === target.segment && (target.multiplier === undefined || dart.multiplier === target.multiplier);
}

function generateAroundTheClockTurn(
  profile: BotProfile,
  remaining: number,
  options: BotTurnOptions | undefined,
): Dart[] {
  const rng = rngFor(options);
  const player = resolvePlayer(options);
  const stateConfig = configFromState(options);
  const config = isAroundTheClockConfig(stateConfig) ? stateConfig : undefined;
  let currentTarget = isAroundTheClockModeState(player?.modeState)
    ? player.modeState.currentTarget
    : isNumberSegment(remaining) || remaining === 25
      ? remaining
      : config?.startSegment ?? 1;
  const turn: Dart[] = [];

  while (turn.length < MAX_DARTS_PER_TURN) {
    const matchTarget = config?.requiredMultiplier === "open" || config?.requiredMultiplier === undefined
      ? { segment: currentTarget }
      : aroundTheClockDartTarget(currentTarget, config);
    const dart = generateBotDart(
      profile,
      aroundTheClockDartTarget(currentTarget, config),
      withRng({ ...options, pressure: "training" }, rng),
    );

    turn.push(dart);

    if (targetMatches(dart, matchTarget)) {
      currentTarget = nextAroundTheClockTarget(currentTarget, config) ?? currentTarget;
    }
  }

  return turn;
}

function isBobs27ModeState(modeState: PlayerModeState | undefined): modeState is Bobs27PlayerModeState {
  return modeState?.mode === "bobs-27";
}

function isBobs27Config(config: GameConfig | undefined): config is Bobs27Config {
  return config?.mode === "bobs-27";
}

function bobs27TargetFromConfig(config: Bobs27Config | undefined): NumberSegment | 25 {
  const firstRound = config?.rounds?.find((target) => isNumberSegment(target) || target === 25);

  return firstRound ?? 1;
}

function doubleTarget(segment: NumberSegment | 25): DartTarget {
  return segment === 25 ? { segment: 50, multiplier: 1 } : { segment, multiplier: 2 };
}

function generateBobs27Turn(profile: BotProfile, remaining: number, options: BotTurnOptions | undefined): Dart[] {
  const rng = rngFor(options);
  const player = resolvePlayer(options);
  const stateConfig = configFromState(options);
  const config = isBobs27Config(stateConfig) ? stateConfig : undefined;
  const currentTarget = isBobs27ModeState(player?.modeState)
    ? player.modeState.currentDouble
    : isNumberSegment(remaining) || remaining === 25
      ? remaining
      : bobs27TargetFromConfig(config);
  const target = doubleTarget(currentTarget);

  return [
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
  ];
}

function isCheckout121ModeState(
  modeState: PlayerModeState | undefined,
): modeState is Checkout121PlayerModeState {
  return modeState?.mode === "checkout-121";
}

function isCheckout121Config(config: GameConfig | undefined): config is Checkout121Config {
  return config?.mode === "checkout-121";
}

function checkout121Remaining(remaining: number, options: BotTurnOptions | undefined): number {
  const player = resolvePlayer(options);
  const stateConfig = configFromState(options);
  const config = isCheckout121Config(stateConfig) ? stateConfig : undefined;

  if (isCheckout121ModeState(player?.modeState)) {
    return player.modeState.remainingTargetScore;
  }

  return safeRemaining(remaining) || config?.startingTarget || 121;
}

function isShanghaiModeState(modeState: PlayerModeState | undefined): modeState is ShanghaiPlayerModeState {
  return modeState?.mode === "shanghai";
}

function isShanghaiConfig(config: GameConfig | undefined): config is ShanghaiConfig {
  return config?.mode === "shanghai";
}

function shanghaiRoundFromConfig(config: ShanghaiConfig | undefined): NumberSegment {
  return config?.rounds?.find(isNumberSegment) ?? DEFAULT_SHANGHAI_ROUNDS[0];
}

function generateShanghaiTurn(profile: BotProfile, remaining: number, options: BotTurnOptions | undefined): Dart[] {
  const rng = rngFor(options);
  const player = resolvePlayer(options);
  const stateConfig = configFromState(options);
  const config = isShanghaiConfig(stateConfig) ? stateConfig : undefined;
  const round = isShanghaiModeState(player?.modeState)
    ? player.modeState.round
    : isNumberSegment(remaining)
      ? remaining
      : shanghaiRoundFromConfig(config);

  return [
    generateBotDart(profile, { segment: round, multiplier: 1 }, withRng({ ...options, pressure: "training" }, rng)),
    generateBotDart(profile, { segment: round, multiplier: 2 }, withRng({ ...options, pressure: "training" }, rng)),
    generateBotDart(profile, { segment: round, multiplier: 3 }, withRng({ ...options, pressure: "training" }, rng)),
  ];
}

function isTrainingModeState(modeState: PlayerModeState | undefined): modeState is TrainingPlayerModeState {
  return modeState?.mode === "training";
}

function isTrainingConfig(config: GameConfig | undefined): config is TrainingConfig {
  return config?.mode === "training";
}

function validTrainingTarget(target: DartTarget): boolean {
  if (target.segment === 25 || target.segment === 50) {
    return target.multiplier === undefined || target.multiplier === 1;
  }

  return isNumberSegment(target.segment);
}

function defaultTrainingTargets(config: TrainingConfig | undefined): readonly DartTarget[] {
  switch (config?.focus) {
    case "singles":
      return [{ segment: 1, multiplier: 1 }];
    case "doubles":
      return [{ segment: 20, multiplier: 2 }];
    case "checkout":
      return [{ segment: 20, multiplier: 2 }];
    case "cricket":
      return [{ segment: 20, multiplier: 3 }];
    case "custom":
      return [{ segment: 20, multiplier: 1 }];
    case "scoring":
    case undefined:
      return DEFAULT_TRAINING_TARGETS;
  }
}

function trainingTargets(config: TrainingConfig | undefined): readonly DartTarget[] {
  const configuredTargets = config?.targets?.filter(validTrainingTarget) ?? [];

  return configuredTargets.length > 0 ? configuredTargets : defaultTrainingTargets(config);
}

function currentTrainingTarget(options: BotTurnOptions | undefined): DartTarget {
  if (options?.target && validTrainingTarget(options.target)) {
    return normalizeTarget(options.target);
  }

  const stateConfig = configFromState(options);
  const config = isTrainingConfig(stateConfig) ? stateConfig : undefined;
  const targets = trainingTargets(config);
  const player = resolvePlayer(options);
  const targetIndex = isTrainingModeState(player?.modeState)
    ? player.modeState.targetHistory.length % targets.length
    : 0;

  return normalizeTarget(targets[targetIndex] ?? targets[0] ?? DEFAULT_TRAINING_TARGETS[0]);
}

function generateTrainingTurn(profile: BotProfile, options: BotTurnOptions | undefined): Dart[] {
  const rng = rngFor(options);
  const target = currentTrainingTarget(options);

  return [
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
  ];
}

function isKillerModeState(modeState: PlayerModeState | undefined): modeState is KillerPlayerModeState {
  return modeState?.mode === "killer";
}

function isKillerConfig(config: GameConfig | undefined): config is KillerConfig {
  return config?.mode === "killer";
}

function assignedOpponentNumber(options: BotTurnOptions | undefined, playerId: PlayerId | undefined): NumberSegment | undefined {
  const opponent = options?.gameState?.players.find(
    (candidate) => candidate.id !== playerId && candidate.status !== "eliminated" &&
      isKillerModeState(candidate.modeState) && candidate.modeState.assignedNumber !== undefined,
  );

  return isKillerModeState(opponent?.modeState) ? opponent.modeState.assignedNumber : undefined;
}

function firstAvailableKillerNumber(options: BotTurnOptions | undefined, fallback: number): NumberSegment {
  if (isNumberSegment(fallback)) {
    return fallback;
  }

  const stateConfig = configFromState(options);
  const config = isKillerConfig(stateConfig) ? stateConfig : undefined;
  const assignedNumbers = new Set<NumberSegment>();

  for (const player of options?.gameState?.players ?? []) {
    if (isKillerModeState(player.modeState) && player.modeState.assignedNumber !== undefined) {
      assignedNumbers.add(player.modeState.assignedNumber);
    }
  }

  return NUMBER_SEGMENTS.find((segment) => config?.allowSharedNumbers === true || !assignedNumbers.has(segment)) ?? 20;
}

function generateKillerTurn(profile: BotProfile, remaining: number, options: BotTurnOptions | undefined): Dart[] {
  const rng = rngFor(options);
  const player = resolvePlayer(options);
  const modeState = isKillerModeState(player?.modeState) ? player.modeState : undefined;
  const targetNumber = modeState?.isKiller
    ? assignedOpponentNumber(options, player?.id) ?? modeState.assignedNumber ?? firstAvailableKillerNumber(options, remaining)
    : modeState?.assignedNumber ?? firstAvailableKillerNumber(options, remaining);
  const target = doubleTarget(targetNumber);

  return [
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
    generateBotDart(profile, target, withRng({ ...options, pressure: "training" }, rng)),
  ];
}

export function generateBotTurn(
  profile: BotProfile,
  remaining: number,
  mode: GameMode,
  options?: BotTurnOptions,
): Turn {
  switch (mode) {
    case "x01":
      return generateX01Turn(profile, remaining, options);
    case "cricket":
      return generateCricketTurn(profile, options);
    case "around-the-clock":
      return generateAroundTheClockTurn(profile, remaining, options);
    case "bobs-27":
      return generateBobs27Turn(profile, remaining, options);
    case "checkout-121":
      return generateX01Turn(profile, checkout121Remaining(remaining, options), options);
    case "shanghai":
      return generateShanghaiTurn(profile, remaining, options);
    case "training":
      return generateTrainingTurn(profile, options);
    case "killer":
      return generateKillerTurn(profile, remaining, options);
  }
}

export function scoreBotTurn(turn: Turn): number {
  return turn.reduce((total, dart) => total + dartScore(dart), 0);
}

export function isExactTargetHit(dart: Dart, targetPreference: DartTarget | Segment): boolean {
  return dartsEqual(dart, dartFromTarget(normalizeTarget(targetPreference)));
}
