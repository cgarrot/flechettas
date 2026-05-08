import { getCheckouts } from "../data/checkouts";
import { dartScore } from "../engine/utils";

import type {
  AroundTheClockPlayerModeState,
  AroundTheClockStats,
  Bobs27Config,
  Bobs27PlayerModeState,
  Bobs27Stats,
  Checkout121PlayerModeState,
  Checkout121Stats,
  CricketConfig,
  CricketStats,
  CricketTarget,
  Dart,
  DartTarget,
  GameConfig,
  GameEvent,
  GameMode,
  GameResult,
  GameStartedEvent,
  KillerConfig,
  KillerPlayerModeState,
  KillerStats,
  MatchSummary,
  NumberSegment,
  PlayerId,
  PlayerMatchStats,
  PlayerModeState,
  PlayerModeStats,
  PlayerState,
  ScoreBucketKey,
  ScoreBuckets,
  ShanghaiPlayerModeState,
  ShanghaiStats,
  TrainingConfig,
  TrainingPlayerModeState,
  TrainingStats,
  Turn,
  X01Config,
  X01Stats,
} from "@/types";

const SCORE_BUCKETS = [
  { key: "40+", minimum: 40 },
  { key: "60+", minimum: 60 },
  { key: "80+", minimum: 80 },
  { key: "100+", minimum: 100 },
  { key: "120+", minimum: 120 },
  { key: "140+", minimum: 140 },
  { key: "160+", minimum: 160 },
  { key: "180", minimum: 180 },
] as const satisfies readonly { key: ScoreBucketKey; minimum: number }[];

const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";
const DEFAULT_X01_START_SCORE = 501;
const DEFAULT_CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const satisfies readonly CricketTarget[];
const NUMBER_SEGMENTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const satisfies readonly NumberSegment[];
const BOBS_27_DEFAULT_TARGETS = [...NUMBER_SEGMENTS, 25] as const;

type TrackedDart = {
  dart: Dart;
  score: number;
};

type BasicPlayerStats = {
  turnsPlayed: number;
  dartsThrown: number;
  totalScore: number;
  average3Dart: number;
  highestTurn: number;
  scoreBuckets: ScoreBuckets;
};

type CricketHit = {
  target: CricketTarget;
  marks: number;
};

function emptyScoreBuckets(): Record<ScoreBucketKey, number> {
  return {
    "40+": 0,
    "60+": 0,
    "80+": 0,
    "100+": 0,
    "120+": 0,
    "140+": 0,
    "160+": 0,
    "180": 0,
  };
}

function addScoreToBuckets(buckets: Record<ScoreBucketKey, number>, score: number): void {
  for (const bucket of SCORE_BUCKETS) {
    if (score >= bucket.minimum) {
      buckets[bucket.key] += 1;
    }
  }
}

function roundStat(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

function averagePerThree(totalScore: number, darts: number): number {
  return darts > 0 ? roundStat((totalScore / darts) * 3) : 0;
}

function percentage(hits: number, attempts: number): number {
  return attempts > 0 ? roundStat((hits / attempts) * 100) : 0;
}

function eventScore(score: number | undefined): number {
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

function firstGameStartedEvent(events: readonly GameEvent[]): GameStartedEvent | undefined {
  return events.find((event): event is GameStartedEvent => event.type === "game_started");
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

function finalPlayerState(events: readonly GameEvent[], playerId: PlayerId): PlayerState | undefined {
  return latestMatchResult(events)?.finalPlayers.find((player) => player.id === playerId);
}

function addUniquePlayerId(playerIds: PlayerId[], playerId: PlayerId | undefined): void {
  if (playerId !== undefined && !playerIds.includes(playerId)) {
    playerIds.push(playerId);
  }
}

function collectPlayerIds(events: readonly GameEvent[]): PlayerId[] {
  const playerIds: PlayerId[] = [];
  const startedEvent = firstGameStartedEvent(events);

  if (startedEvent) {
    for (const playerId of startedEvent.playerOrder) {
      addUniquePlayerId(playerIds, playerId);
    }

    for (const player of startedEvent.config.players) {
      addUniquePlayerId(playerIds, player.id);
    }
  }

  for (const event of events) {
    addUniquePlayerId(playerIds, event.playerId);
  }

  const result = latestMatchResult(events);

  if (result) {
    for (const player of result.finalPlayers) {
      addUniquePlayerId(playerIds, player.id);
    }
  }

  return playerIds;
}

function configFromEvents(events: readonly GameEvent[]): GameConfig | undefined {
  return firstGameStartedEvent(events)?.config;
}

function isX01Config(config: GameConfig | undefined): config is X01Config {
  return config?.mode === "x01";
}

function isCricketConfig(config: GameConfig | undefined): config is CricketConfig {
  return config?.mode === "cricket";
}

function isBobs27Config(config: GameConfig | undefined): config is Bobs27Config {
  return config?.mode === "bobs-27";
}

function isTrainingConfig(config: GameConfig | undefined): config is TrainingConfig {
  return config?.mode === "training";
}

function isKillerConfig(config: GameConfig | undefined): config is KillerConfig {
  return config?.mode === "killer";
}

function isAroundTheClockModeState(
  modeState: PlayerModeState,
): modeState is AroundTheClockPlayerModeState {
  return modeState.mode === "around-the-clock";
}

function isBobs27ModeState(modeState: PlayerModeState): modeState is Bobs27PlayerModeState {
  return modeState.mode === "bobs-27";
}

function isCheckout121ModeState(
  modeState: PlayerModeState,
): modeState is Checkout121PlayerModeState {
  return modeState.mode === "checkout-121";
}

function isShanghaiModeState(modeState: PlayerModeState): modeState is ShanghaiPlayerModeState {
  return modeState.mode === "shanghai";
}

function isTrainingModeState(modeState: PlayerModeState): modeState is TrainingPlayerModeState {
  return modeState.mode === "training";
}

function isKillerModeState(modeState: PlayerModeState): modeState is KillerPlayerModeState {
  return modeState.mode === "killer";
}

function playerName(events: readonly GameEvent[], playerId: PlayerId): string {
  const player = configFromEvents(events)?.players.find((candidate) => candidate.id === playerId);

  return player?.name ?? playerId;
}

function basicPlayerStats(events: readonly GameEvent[], playerId: PlayerId): BasicPlayerStats {
  const scoreBuckets = emptyScoreBuckets();
  let turnsPlayed = 0;
  let dartsThrown = 0;
  let totalScore = 0;
  let highestTurn = 0;

  for (const event of events) {
    if (event.playerId !== playerId) {
      continue;
    }

    if (event.type === "dart_thrown") {
      dartsThrown += 1;
    }

    if (event.type === "turn_complete") {
      turnsPlayed += 1;
      totalScore += event.score;
      highestTurn = Math.max(highestTurn, event.score);
      addScoreToBuckets(scoreBuckets, event.score);
    }
  }

  return {
    turnsPlayed,
    dartsThrown,
    totalScore,
    average3Dart: averagePerThree(totalScore, dartsThrown),
    highestTurn,
    scoreBuckets,
  };
}

function trackedScoresForTurn(eventTurn: Turn, trackedDarts: readonly TrackedDart[]): readonly TrackedDart[] {
  if (trackedDarts.length === eventTurn.length) {
    return trackedDarts;
  }

  return eventTurn.map((dart) => ({ dart, score: dartScore(dart) }));
}

function addToFirst9(
  trackedDarts: readonly TrackedDart[],
  legFirst9Darts: number,
): { legFirst9Darts: number; darts: number; score: number } {
  let nextLegFirst9Darts = legFirst9Darts;
  let addedDarts = 0;
  let addedScore = 0;

  for (const trackedDart of trackedDarts) {
    if (nextLegFirst9Darts >= 9) {
      break;
    }

    nextLegFirst9Darts += 1;
    addedDarts += 1;
    addedScore += trackedDart.score;
  }

  return { legFirst9Darts: nextLegFirst9Darts, darts: addedDarts, score: addedScore };
}

function startingX01Score(events: readonly GameEvent[]): number {
  const config = configFromEvents(events);

  if (isX01Config(config)) {
    return config.startingScore;
  }

  for (const event of events) {
    if (event.type === "turn_complete" && event.remainingScore !== undefined) {
      return event.remainingScore + event.score;
    }

    if (event.type === "player_bust") {
      return event.scoreBeforeTurn;
    }
  }

  return DEFAULT_X01_START_SCORE;
}

function isCheckoutOpportunity(score: number | undefined): boolean {
  return typeof score === "number" && getCheckouts(score).length > 0;
}

export function computeX01Stats(events: readonly GameEvent[], playerId: PlayerId): X01Stats {
  const scoreBuckets = emptyScoreBuckets();
  const startScore = startingX01Score(events);
  let remainingScore = startScore;
  let currentTurnDarts: TrackedDart[] = [];
  let currentTurnBusted = false;
  let bustScoreBeforeTurn: number | undefined;
  let turnsPlayed = 0;
  let dartsThrown = 0;
  let scoringDarts = 0;
  let totalScore = 0;
  let first9Darts = 0;
  let first9Score = 0;
  let legFirst9Darts = 0;
  let highestTurn = 0;
  let highestCheckout: number | undefined;
  let checkoutAttempts = 0;
  let checkoutHits = 0;
  let busts = 0;

  for (const event of events) {
    if (event.type === "dart_thrown" && event.playerId === playerId) {
      dartsThrown += 1;
      currentTurnDarts.push({ dart: event.dart, score: eventScore(event.score) });
      continue;
    }

    if (event.type === "player_bust" && event.playerId === playerId) {
      busts += 1;
      currentTurnBusted = true;
      bustScoreBeforeTurn = event.scoreBeforeTurn;
      continue;
    }

    if (event.type === "turn_complete" && event.playerId === playerId) {
      const trackedDarts = trackedScoresForTurn(event.turn, currentTurnDarts);
      const preTurnScore = currentTurnBusted
        ? bustScoreBeforeTurn
        : event.remainingScore !== undefined
          ? event.remainingScore + event.score
          : remainingScore;

      turnsPlayed += 1;
      totalScore += event.score;
      highestTurn = Math.max(highestTurn, event.score);
      addScoreToBuckets(scoreBuckets, event.score);

      if (isCheckoutOpportunity(preTurnScore)) {
        checkoutAttempts += 1;
      }

      if (!currentTurnBusted) {
        scoringDarts += trackedDarts.length;

        const first9Update = addToFirst9(trackedDarts, legFirst9Darts);
        legFirst9Darts = first9Update.legFirst9Darts;
        first9Darts += first9Update.darts;
        first9Score += first9Update.score;
      }

      if (event.remainingScore !== undefined) {
        remainingScore = event.remainingScore;
      } else if (!currentTurnBusted) {
        remainingScore = Math.max(0, remainingScore - event.score);
      }

      currentTurnDarts = [];
      currentTurnBusted = false;
      bustScoreBeforeTurn = undefined;
      continue;
    }

    if (event.type === "leg_won") {
      if (event.playerId === playerId && event.checkoutScore !== undefined) {
        checkoutHits += 1;
        highestCheckout = Math.max(highestCheckout ?? 0, event.checkoutScore);
      }

      remainingScore = startScore;
      legFirst9Darts = 0;
      currentTurnDarts = [];
      currentTurnBusted = false;
      bustScoreBeforeTurn = undefined;
    }
  }

  return {
    mode: "x01",
    average3Dart: averagePerThree(totalScore, scoringDarts),
    first9Average: first9Darts > 0 ? averagePerThree(first9Score, first9Darts) : undefined,
    turnsPlayed,
    dartsThrown,
    scoringDarts,
    totalScore,
    highestTurn,
    highestCheckout,
    checkoutAttempts,
    checkoutHits,
    checkoutRate: percentage(checkoutHits, checkoutAttempts),
    busts,
    scoreBuckets,
  };
}

function isCricketTarget(segment: number): segment is CricketTarget {
  return segment === 20 || segment === 19 || segment === 18 || segment === 17 ||
    segment === 16 || segment === 15 || segment === 25;
}

function cricketHitFor(dart: Dart): CricketHit | undefined {
  if ("miss" in dart) {
    return undefined;
  }

  if (dart.segment === 50) {
    return { target: 25, marks: 2 };
  }

  if (dart.segment === 25) {
    return { target: 25, marks: 1 };
  }

  return isCricketTarget(dart.segment)
    ? { target: dart.segment, marks: dart.multiplier }
    : undefined;
}

function cricketTargets(config: CricketConfig | undefined): readonly CricketTarget[] {
  if (!config?.targets || config.targets.length === 0) {
    return DEFAULT_CRICKET_TARGETS;
  }

  const targets: CricketTarget[] = [];

  for (const target of config.targets) {
    if (!targets.includes(target)) {
      targets.push(target);
    }
  }

  return targets.length > 0 ? targets : DEFAULT_CRICKET_TARGETS;
}

function playerMarks(
  marksByPlayer: Map<PlayerId, Map<CricketTarget, number>>,
  playerId: PlayerId,
): Map<CricketTarget, number> {
  const existingMarks = marksByPlayer.get(playerId);

  if (existingMarks) {
    return existingMarks;
  }

  const nextMarks = new Map<CricketTarget, number>();
  marksByPlayer.set(playerId, nextMarks);

  return nextMarks;
}

function targetMarks(
  marksByPlayer: Map<PlayerId, Map<CricketTarget, number>>,
  playerId: PlayerId,
  target: CricketTarget,
): number {
  return marksByPlayer.get(playerId)?.get(target) ?? 0;
}

function hasClosedCricketTarget(
  marksByPlayer: Map<PlayerId, Map<CricketTarget, number>>,
  playerId: PlayerId,
  target: CricketTarget,
): boolean {
  return targetMarks(marksByPlayer, playerId, target) >= 3;
}

function isDeadCricketTarget(
  marksByPlayer: Map<PlayerId, Map<CricketTarget, number>>,
  playerIds: readonly PlayerId[],
  target: CricketTarget,
): boolean {
  return playerIds.length > 0 && playerIds.every(
    (candidateId) => hasClosedCricketTarget(marksByPlayer, candidateId, target),
  );
}

function scoringMarks(previousMarks: number, hitMarks: number): number {
  const previousScoringMarks = Math.max(0, previousMarks - 3);
  const nextScoringMarks = Math.max(0, previousMarks + hitMarks - 3);

  return nextScoringMarks - previousScoringMarks;
}

function addPoints(pointsByPlayer: Map<PlayerId, number>, playerId: PlayerId, points: number): void {
  pointsByPlayer.set(playerId, (pointsByPlayer.get(playerId) ?? 0) + points);
}

function resetCricketLegMarks(
  marksByPlayer: Map<PlayerId, Map<CricketTarget, number>>,
  playerIds: readonly PlayerId[],
): void {
  marksByPlayer.clear();

  for (const candidateId of playerIds) {
    marksByPlayer.set(candidateId, new Map<CricketTarget, number>());
  }
}

export function computeCricketStats(events: readonly GameEvent[], playerId: PlayerId): CricketStats {
  const config = configFromEvents(events);
  const cricketConfig = isCricketConfig(config) ? config : undefined;
  const targets = cricketTargets(cricketConfig);
  const playerIds = collectPlayerIds(events);
  addUniquePlayerId(playerIds, playerId);

  const legMarksByPlayer = new Map<PlayerId, Map<CricketTarget, number>>();
  const aggregateMarksByPlayer = new Map<PlayerId, Map<CricketTarget, number>>();
  const pointsByPlayer = new Map<PlayerId, number>();
  let dartsThrown = 0;
  let completedTurns = 0;
  let resetLegBeforeNextDart = false;

  for (const candidateId of playerIds) {
    legMarksByPlayer.set(candidateId, new Map<CricketTarget, number>());
    aggregateMarksByPlayer.set(candidateId, new Map<CricketTarget, number>());
    pointsByPlayer.set(candidateId, 0);
  }

  for (const event of events) {
    if (event.type === "leg_won") {
      resetLegBeforeNextDart = true;
      continue;
    }

    if (event.type === "turn_complete" && event.playerId === playerId) {
      completedTurns += 1;
      continue;
    }

    if (event.type !== "dart_thrown") {
      continue;
    }

    if (resetLegBeforeNextDart) {
      resetCricketLegMarks(legMarksByPlayer, playerIds);
      resetLegBeforeNextDart = false;
    }

    if (event.playerId === playerId) {
      dartsThrown += 1;
    }

    const hit = cricketHitFor(event.dart);

    if (!hit || !targets.includes(hit.target) || isDeadCricketTarget(legMarksByPlayer, playerIds, hit.target)) {
      continue;
    }

    const hitterLegMarks = playerMarks(legMarksByPlayer, event.playerId);
    const hitterAggregateMarks = playerMarks(aggregateMarksByPlayer, event.playerId);
    const previousMarks = hitterLegMarks.get(hit.target) ?? 0;
    const scoredMarks = scoringMarks(previousMarks, hit.marks);
    const opponentsNotClosed = playerIds.filter(
      (candidateId) => candidateId !== event.playerId &&
        !hasClosedCricketTarget(legMarksByPlayer, candidateId, hit.target),
    );

    if (scoredMarks > 0 && cricketConfig?.variant !== "no-score" && opponentsNotClosed.length > 0) {
      const encodedScore = event.score;
      const perOpponentScore = eventScore(encodedScore) > 0 && cricketConfig?.variant === "cut-throat"
        ? eventScore(encodedScore) / opponentsNotClosed.length
        : hit.target * scoredMarks;

      if (cricketConfig?.variant === "cut-throat") {
        for (const opponentId of opponentsNotClosed) {
          addPoints(pointsByPlayer, opponentId, perOpponentScore);
        }
      } else {
        addPoints(pointsByPlayer, event.playerId, eventScore(encodedScore) || hit.target * scoredMarks);
      }
    }

    hitterLegMarks.set(hit.target, previousMarks + hit.marks);
    hitterAggregateMarks.set(hit.target, (hitterAggregateMarks.get(hit.target) ?? 0) + hit.marks);
  }

  const currentPlayerLegMarks = playerMarks(legMarksByPlayer, playerId);
  const currentPlayerAggregateMarks = playerMarks(aggregateMarksByPlayer, playerId);
  const hitsByTarget: Partial<Record<CricketTarget, number>> = {};
  const closedTargets: CricketTarget[] = [];
  let totalMarks = 0;

  for (const target of targets) {
    const aggregateMarks = currentPlayerAggregateMarks.get(target) ?? 0;
    const legMarks = currentPlayerLegMarks.get(target) ?? 0;

    if (aggregateMarks > 0) {
      hitsByTarget[target] = aggregateMarks;
      totalMarks += aggregateMarks;
    }

    if (legMarks >= 3) {
      closedTargets.push(target);
    }
  }

  const roundsPlayed = Math.max(completedTurns, Math.ceil(dartsThrown / 3));
  const points = roundStat(pointsByPlayer.get(playerId) ?? 0);

  return {
    mode: "cricket",
    marksPerRound: roundsPlayed > 0 ? roundStat(totalMarks / roundsPlayed) : 0,
    scoringAverage: roundsPlayed > 0 ? roundStat(points / roundsPlayed) : 0,
    roundsPlayed,
    dartsThrown,
    totalMarks,
    points,
    closedTargets,
    hitsByTarget,
  };
}

function targetForDart(dart: Dart): DartTarget | undefined {
  if ("miss" in dart) {
    return undefined;
  }

  return { segment: dart.segment, multiplier: dart.multiplier };
}

function sameTarget(left: DartTarget, right: DartTarget): boolean {
  return left.segment === right.segment && left.multiplier === right.multiplier;
}

function addUniqueTarget(targets: DartTarget[], target: DartTarget | undefined): void {
  if (target && !targets.some((candidate) => sameTarget(candidate, target))) {
    targets.push(target);
  }
}

function dartAttempts(events: readonly GameEvent[], playerId: PlayerId): {
  attempts: number;
  hits: number;
  totalScore: number;
  hitTargets: readonly DartTarget[];
} {
  const hitTargets: DartTarget[] = [];
  let attempts = 0;
  let hits = 0;
  let totalScore = 0;

  for (const event of events) {
    if (event.type !== "dart_thrown" || event.playerId !== playerId) {
      continue;
    }

    attempts += 1;
    totalScore += eventScore(event.score);

    if (eventScore(event.score) > 0) {
      hits += 1;
      addUniqueTarget(hitTargets, targetForDart(event.dart));
    }
  }

  return { attempts, hits, totalScore, hitTargets };
}

function playerCompleted(events: readonly GameEvent[], playerId: PlayerId): boolean {
  return events.some((event) => {
    if (event.type === "leg_won" || event.type === "match_won") {
      return event.playerId === playerId;
    }

    return false;
  });
}

function finalModeState(events: readonly GameEvent[], playerId: PlayerId): PlayerModeState | undefined {
  return finalPlayerState(events, playerId)?.modeState;
}

function finalStatus(events: readonly GameEvent[], playerId: PlayerId): PlayerState["status"] | undefined {
  return finalPlayerState(events, playerId)?.status;
}

function trainingTargetsFromConfig(config: TrainingConfig | undefined): readonly DartTarget[] {
  return config?.targets ?? [];
}

function computeTrainingModeStats(events: readonly GameEvent[], playerId: PlayerId): TrainingStats {
  const config = configFromEvents(events);
  const trainingConfig = isTrainingConfig(config) ? config : undefined;
  const attempts = dartAttempts(events, playerId);
  const modeState = finalModeState(events, playerId);
  const targets = modeState && isTrainingModeState(modeState)
    ? modeState.targetHistory
    : trainingTargetsFromConfig(trainingConfig).length > 0
      ? trainingTargetsFromConfig(trainingConfig)
      : attempts.hitTargets;

  return {
    mode: "training",
    completed: playerCompleted(events, playerId),
    attempts: attempts.attempts,
    hits: attempts.hits,
    accuracy: percentage(attempts.hits, attempts.attempts),
    average3Dart: averagePerThree(attempts.totalScore, attempts.attempts),
    targets,
  };
}

function bullAwareCompletedTarget(dart: Dart): NumberSegment | 25 | undefined {
  if ("miss" in dart) {
    return undefined;
  }

  if (dart.segment === 50) {
    return 25;
  }

  return dart.segment;
}

function computeAroundTheClockStats(events: readonly GameEvent[], playerId: PlayerId): AroundTheClockStats {
  const attempts = dartAttempts(events, playerId);
  const modeState = finalModeState(events, playerId);

  if (modeState && isAroundTheClockModeState(modeState)) {
    return {
      mode: "around-the-clock",
      completedTargets: modeState.completedTargets,
      dartsUsed: attempts.attempts,
      misses: attempts.attempts - modeState.hits,
    };
  }

  const completedTargets: (NumberSegment | 25)[] = [];

  for (const event of events) {
    if (event.type !== "dart_thrown" || event.playerId !== playerId || eventScore(event.score) <= 0) {
      continue;
    }

    const completedTarget = bullAwareCompletedTarget(event.dart);

    if (completedTarget !== undefined) {
      completedTargets.push(completedTarget);
    }
  }

  return {
    mode: "around-the-clock",
    completedTargets,
    dartsUsed: attempts.attempts,
    misses: attempts.attempts - attempts.hits,
  };
}

function turnScores(events: readonly GameEvent[], playerId: PlayerId): readonly number[] {
  const scores: number[] = [];

  for (const event of events) {
    if (event.type === "turn_complete" && event.playerId === playerId) {
      scores.push(event.score);
    }
  }

  return scores;
}

function bobs27Targets(config: Bobs27Config | undefined): readonly (NumberSegment | 25)[] {
  return config?.rounds ?? BOBS_27_DEFAULT_TARGETS;
}

function computeBobs27Stats(events: readonly GameEvent[], playerId: PlayerId): Bobs27Stats {
  const modeState = finalModeState(events, playerId);
  const scores = turnScores(events, playerId);
  const config = configFromEvents(events);
  const bobsConfig = isBobs27Config(config) ? config : undefined;

  if (modeState && isBobs27ModeState(modeState)) {
    return {
      mode: "bobs-27",
      finalScore: modeState.score,
      bestRoundScore: scores.reduce((highest, score) => Math.max(highest, score), 0),
      completedDoubles: modeState.completedRounds,
    };
  }

  return {
    mode: "bobs-27",
    finalScore: 27 + scores.reduce((total, score) => total + score, 0),
    bestRoundScore: scores.reduce((highest, score) => Math.max(highest, score), 0),
    completedDoubles: bobs27Targets(bobsConfig).slice(0, scores.length),
  };
}

function computeCheckout121Stats(events: readonly GameEvent[], playerId: PlayerId): Checkout121Stats {
  const modeState = finalModeState(events, playerId);
  let successfulTargets: readonly number[] = [];
  let failedTargets: readonly number[] = [];

  if (modeState && isCheckout121ModeState(modeState)) {
    successfulTargets = modeState.successfulTargets;
    failedTargets = modeState.failedTargets;
  } else {
    const successes: number[] = [];
    const failures: number[] = [];

    for (const event of events) {
      if (event.playerId !== playerId) {
        continue;
      }

      if (event.type === "turn_complete" && event.remainingScore === 0 && event.score > 0) {
        successes.push(event.score);
      }

      if (event.type === "player_bust") {
        failures.push(event.scoreBeforeTurn);
      }
    }

    successfulTargets = successes;
    failedTargets = failures;
  }

  const highestClearedTarget = successfulTargets.reduce(
    (highest, target) => Math.max(highest, target),
    0,
  );

  return {
    mode: "checkout-121",
    highestClearedTarget,
    successfulTargets,
    failedTargets,
    checkoutRate: percentage(successfulTargets.length, successfulTargets.length + failedTargets.length),
  };
}

function shanghaiRoundForTurn(turn: Turn): NumberSegment | undefined {
  for (const segment of NUMBER_SEGMENTS) {
    let hasSingle = false;
    let hasDouble = false;
    let hasTriple = false;

    for (const dart of turn) {
      if ("miss" in dart || dart.segment !== segment) {
        continue;
      }

      hasSingle ||= dart.multiplier === 1;
      hasDouble ||= dart.multiplier === 2;
      hasTriple ||= dart.multiplier === 3;
    }

    if (hasSingle && hasDouble && hasTriple) {
      return segment;
    }
  }

  return undefined;
}

function computeShanghaiStats(events: readonly GameEvent[], playerId: PlayerId): ShanghaiStats {
  const modeState = finalModeState(events, playerId);
  const shanghaiRounds: NumberSegment[] = [];
  let totalScore = 0;
  let bestRoundScore = 0;

  for (const event of events) {
    if (event.type !== "turn_complete" || event.playerId !== playerId) {
      continue;
    }

    totalScore += event.score;
    bestRoundScore = Math.max(bestRoundScore, event.score);

    const shanghaiRound = shanghaiRoundForTurn(event.turn);

    if (shanghaiRound !== undefined) {
      shanghaiRounds.push(shanghaiRound);
    }
  }

  return {
    mode: "shanghai",
    totalScore: modeState && isShanghaiModeState(modeState) ? modeState.score : totalScore,
    shanghaiRounds,
    bestRoundScore,
  };
}

function computeKillerStats(events: readonly GameEvent[], playerId: PlayerId): KillerStats {
  const config = configFromEvents(events);
  const killerConfig = isKillerConfig(config) ? config : undefined;
  const startingLives = killerConfig?.startingLives ?? 0;
  const modeState = finalModeState(events, playerId);
  const status = finalStatus(events, playerId);

  if (modeState && isKillerModeState(modeState)) {
    return {
      mode: "killer",
      kills: modeState.kills,
      livesRemaining: modeState.lives,
      livesLost: Math.max(0, startingLives - modeState.lives),
      assignedNumber: modeState.assignedNumber,
      eliminated: status === "eliminated" || modeState.lives === 0,
    };
  }

  return {
    mode: "killer",
    kills: 0,
    livesRemaining: startingLives,
    livesLost: 0,
    assignedNumber: killerConfig?.assignment === "manual" ? killerConfig.assignments?.[playerId] : undefined,
    eliminated: false,
  };
}

export function computeTrainingStats(
  events: readonly GameEvent[],
  playerId: PlayerId,
  mode: GameMode,
): PlayerModeStats {
  switch (mode) {
    case "x01":
      return computeX01Stats(events, playerId);
    case "cricket":
      return computeCricketStats(events, playerId);
    case "around-the-clock":
      return computeAroundTheClockStats(events, playerId);
    case "bobs-27":
      return computeBobs27Stats(events, playerId);
    case "checkout-121":
      return computeCheckout121Stats(events, playerId);
    case "shanghai":
      return computeShanghaiStats(events, playerId);
    case "training":
      return computeTrainingModeStats(events, playerId);
    case "killer":
      return computeKillerStats(events, playerId);
  }
}

function modeStatsFor(events: readonly GameEvent[], playerId: PlayerId, mode: GameMode): PlayerModeStats {
  if (mode === "x01") {
    return computeX01Stats(events, playerId);
  }

  if (mode === "cricket") {
    return computeCricketStats(events, playerId);
  }

  return computeTrainingStats(events, playerId, mode);
}

function completedAt(events: readonly GameEvent[], result: GameResult | undefined): string | undefined {
  if (result) {
    return result.completedAt;
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event.type === "match_won") {
      return event.occurredAt;
    }
  }

  return undefined;
}

function durationMs(startedAt: string, completedAtValue: string | undefined): number | undefined {
  if (!completedAtValue) {
    return undefined;
  }

  const startedTime = Date.parse(startedAt);
  const completedTime = Date.parse(completedAtValue);

  return Number.isFinite(startedTime) && Number.isFinite(completedTime)
    ? Math.max(0, completedTime - startedTime)
    : undefined;
}

function summaryId(events: readonly GameEvent[], mode: GameMode): string {
  const startedEvent = firstGameStartedEvent(events);

  if (startedEvent) {
    return startedEvent.id;
  }

  const firstEvent = events[0];

  return firstEvent ? `summary-${mode}-${firstEvent.id}` : `summary-${mode}-empty`;
}

function orderedPlayerIds(events: readonly GameEvent[], allPlayerIds: readonly PlayerId[]): readonly PlayerId[] {
  const playerIds: PlayerId[] = [];

  for (const playerId of allPlayerIds) {
    addUniquePlayerId(playerIds, playerId);
  }

  for (const playerId of collectPlayerIds(events)) {
    addUniquePlayerId(playerIds, playerId);
  }

  return playerIds;
}

export function computeMatchSummary(
  events: readonly GameEvent[],
  allPlayerIds: readonly PlayerId[],
  mode: GameMode,
): MatchSummary {
  const result = latestMatchResult(events);
  const startedEvent = firstGameStartedEvent(events);
  const startedAt = startedEvent?.occurredAt ?? events[0]?.occurredAt ?? DEFAULT_TIMESTAMP;
  const completedAtValue = completedAt(events, result);
  const playerStats: PlayerMatchStats[] = orderedPlayerIds(events, allPlayerIds).map((playerId) => {
    const basicStats = basicPlayerStats(events, playerId);
    const modeStats = modeStatsFor(events, playerId, mode);
    const average3Dart = modeStats.mode === "x01" ? modeStats.average3Dart : basicStats.average3Dart;

    return {
      playerId,
      playerName: playerName(events, playerId),
      mode,
      turnsPlayed: basicStats.turnsPlayed,
      dartsThrown: basicStats.dartsThrown,
      totalScore: modeStats.mode === "cricket" ? modeStats.points : basicStats.totalScore,
      average3Dart,
      highestTurn: basicStats.highestTurn,
      scoreBuckets: basicStats.scoreBuckets,
      modeStats,
    };
  });

  return {
    id: summaryId(events, mode),
    mode,
    startedAt,
    completedAt: completedAtValue,
    durationMs: durationMs(startedAt, completedAtValue),
    winnerId: result?.winnerId,
    playerStats,
    result,
  };
}
