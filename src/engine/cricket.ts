import type {
  CricketConfig,
  CricketPlayerModeState,
  CricketTarget,
  Dart,
  DartThrownEvent,
  GameConfig,
  GameEvent,
  GameEventType,
  GameResult,
  GameState,
  PlayerDef,
  PlayerId,
  PlayerModeState,
  PlayerState,
  Turn,
} from "@/types";

import { createGameState, processEvent } from "./core";
import { isValidDart } from "./validation";

const DEFAULT_CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const satisfies readonly CricketTarget[];
const CLOSED_MARKS = 3;
const DEFAULT_LEGS_TO_WIN = 1;
const DEFAULT_SETS_TO_WIN = 1;
const GAME_EVENT_TYPES = new Set<string>([
  "game_started",
  "dart_thrown",
  "turn_total_submitted",
  "turn_complete",
  "player_bust",
  "leg_won",
  "set_won",
  "round_advanced",
  "match_won",
  "match_continued",
  "undo",
]);

type CricketHit = {
  target: CricketTarget;
  marks: number;
};

type DartResolution = {
  hitterModeState?: CricketPlayerModeState;
  pointDeltas: ReadonlyMap<PlayerId, number>;
  totalPoints: number;
};

export function getCricketTargets(): CricketTarget[] {
  return [...DEFAULT_CRICKET_TARGETS];
}

function isCricketConfig(config: GameConfig): config is CricketConfig {
  return config.mode === "cricket";
}

function isCricketModeState(modeState: PlayerModeState): modeState is CricketPlayerModeState {
  return modeState.mode === "cricket";
}

function isDartIndex(value: number): value is 0 | 1 | 2 {
  return Number.isInteger(value) && value >= 0 && value <= 2;
}

function isKnownGameEventType(type: string): type is GameEventType {
  return GAME_EVENT_TYPES.has(type);
}

function isCricketTarget(segment: number): segment is CricketTarget {
  return (
    segment === 20 ||
    segment === 19 ||
    segment === 18 ||
    segment === 17 ||
    segment === 16 ||
    segment === 15 ||
    segment === 25
  );
}

function positiveIntegerOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function nonNegativeFiniteOrUndefined(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, value);
}

function generatedEventId(event: GameEvent, suffix: string): string {
  return `${event.id}:${suffix}`;
}

function targetsForConfig(config: CricketConfig): CricketTarget[] {
  const configuredTargets = config.targets ?? DEFAULT_CRICKET_TARGETS;
  const targets: CricketTarget[] = [];

  for (const target of configuredTargets) {
    if (!targets.includes(target)) {
      targets.push(target);
    }
  }

  return targets.length > 0 ? targets : getCricketTargets();
}

function scorePointsEnabled(config: CricketConfig): boolean {
  return config.variant !== "no-score";
}

function targetScore(target: CricketTarget): number {
  return target;
}

function getPlayer(state: GameState, playerId: PlayerId): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

function cricketMarks(modeState: CricketPlayerModeState, target: CricketTarget): number {
  return modeState.marks[target] ?? 0;
}

function hasClosedMarks(marks: number): boolean {
  return marks >= CLOSED_MARKS;
}

function hasClosedTarget(player: PlayerState, target: CricketTarget): boolean {
  return (
    isCricketModeState(player.modeState) &&
    (hasClosedMarks(cricketMarks(player.modeState, target)) ||
      player.modeState.closedTargets.includes(target))
  );
}

function nonEliminatedPlayers(state: GameState): readonly PlayerState[] {
  return state.players.filter((player) => player.status !== "eliminated");
}

function nonEliminatedOpponents(state: GameState, playerId: PlayerId): readonly PlayerState[] {
  return nonEliminatedPlayers(state).filter((player) => player.id !== playerId);
}

function isTargetDead(state: GameState, target: CricketTarget): boolean {
  const players = nonEliminatedPlayers(state);

  return players.length > 0 && players.every((player) => hasClosedTarget(player, target));
}

function closeTargetIfNeeded(
  closedTargets: readonly CricketTarget[],
  target: CricketTarget,
  marks: number,
): readonly CricketTarget[] {
  if (!hasClosedMarks(marks) || closedTargets.includes(target)) {
    return closedTargets;
  }

  return [...closedTargets, target];
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

  if (isCricketTarget(dart.segment)) {
    return { target: dart.segment, marks: dart.multiplier };
  }

  return undefined;
}

function scoringMarks(previousMarks: number, hitMarks: number): number {
  const previousScoringMarks = Math.max(0, previousMarks - CLOSED_MARKS);
  const nextScoringMarks = Math.max(0, previousMarks + hitMarks - CLOSED_MARKS);

  return nextScoringMarks - previousScoringMarks;
}

function playerCricketPoints(player: PlayerState): number {
  return isCricketModeState(player.modeState) ? player.modeState.points : 0;
}

function resolveDart(
  state: GameState,
  playerId: PlayerId,
  dart: Dart,
  config: CricketConfig,
): DartResolution {
  const hit = cricketHitFor(dart);
  const emptyResolution: DartResolution = {
    pointDeltas: new Map<PlayerId, number>(),
    totalPoints: 0,
  };

  if (!hit || !targetsForConfig(config).includes(hit.target) || isTargetDead(state, hit.target)) {
    return emptyResolution;
  }

  const hitter = getPlayer(state, playerId);

  if (!hitter || !isCricketModeState(hitter.modeState)) {
    return emptyResolution;
  }

  const previousMarks = cricketMarks(hitter.modeState, hit.target);
  const nextMarks = previousMarks + hit.marks;
  const pointDeltas = new Map<PlayerId, number>();
  const opponentsNotClosed = nonEliminatedOpponents(state, playerId).filter(
    (opponent) => !hasClosedTarget(opponent, hit.target),
  );

  if (scorePointsEnabled(config) && opponentsNotClosed.length > 0) {
    const points = targetScore(hit.target) * scoringMarks(previousMarks, hit.marks);

    if (points > 0) {
      if (config.variant === "standard") {
        pointDeltas.set(playerId, points);
      } else if (config.variant === "cut-throat") {
        for (const opponent of opponentsNotClosed) {
          pointDeltas.set(opponent.id, points);
        }
      }
    }
  }

  const hitterModeState: CricketPlayerModeState = {
    ...hitter.modeState,
    marks: {
      ...hitter.modeState.marks,
      [hit.target]: nextMarks,
    },
    closedTargets: closeTargetIfNeeded(hitter.modeState.closedTargets, hit.target, nextMarks),
  };
  const totalPoints = Array.from(pointDeltas.values()).reduce((total, points) => total + points, 0);

  return {
    hitterModeState,
    pointDeltas,
    totalPoints,
  };
}

function applyResolvedDart(
  state: GameState,
  playerId: PlayerId,
  resolution: DartResolution,
): GameState {
  if (!resolution.hitterModeState && resolution.pointDeltas.size === 0) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) => {
      if (!isCricketModeState(player.modeState)) {
        return player;
      }

      const pointsDelta = resolution.pointDeltas.get(player.id) ?? 0;

      if (player.id === playerId && resolution.hitterModeState) {
        return {
          ...player,
          modeState: {
            ...resolution.hitterModeState,
            points: resolution.hitterModeState.points + pointsDelta,
          },
        };
      }

      if (pointsDelta === 0) {
        return player;
      }

      return {
        ...player,
        modeState: {
          ...player.modeState,
          points: player.modeState.points + pointsDelta,
        },
      };
    }),
  };
}

function isTurnBoundaryEvent(event: GameEvent): boolean {
  switch (event.type) {
    case "turn_complete":
    case "player_bust":
    case "leg_won":
    case "set_won":
    case "match_won":
    case "match_continued":
      return true;
    case "game_started":
    case "dart_thrown":
    case "turn_total_submitted":
    case "round_advanced":
    case "undo":
      return false;
  }
}

function currentTurnCricketPoints(state: GameState, playerId: PlayerId): number {
  let total = 0;

  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index];

    if (isTurnBoundaryEvent(event)) {
      break;
    }

    if (event.type === "dart_thrown" && event.playerId === playerId) {
      total += event.score ?? 0;
    }
  }

  return total;
}

function completeTurn(
  state: GameState,
  parentEvent: DartThrownEvent,
  score: number,
): GameState {
  const event: GameEvent = {
    id: generatedEventId(parentEvent, "turn-complete"),
    type: "turn_complete",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    turn: state.currentTurn,
    score,
  };

  return processEvent(state, event);
}

function resetCricketLegState(modeState: CricketPlayerModeState): CricketPlayerModeState {
  return {
    ...modeState,
    marks: {},
    points: 0,
    closedTargets: [],
  };
}

function nextLegStarterAfterWinner(state: GameState, winnerId: PlayerId): PlayerId {
  const winnerIndex = state.playerOrder.indexOf(winnerId);

  if (winnerIndex === -1 || state.playerOrder.length <= 1) {
    return winnerId;
  }

  for (let offset = 1; offset < state.playerOrder.length; offset += 1) {
    const candidate = state.playerOrder[(winnerIndex + offset) % state.playerOrder.length];

    if (candidate !== winnerId) {
      return candidate;
    }
  }

  return winnerId;
}

function beginNextLeg(
  state: GameState,
  starterId: PlayerId,
  resetLegsForNewSet: boolean,
): GameState {
  return {
    ...state,
    activePlayerId: starterId,
    currentLeg: resetLegsForNewSet ? 1 : state.currentLeg + 1,
    currentRound: 1,
    currentSet: resetLegsForNewSet ? state.currentSet + 1 : state.currentSet,
    currentTurn: [],
    phase: "playing",
    players: state.players.map((player) => ({
      ...player,
      currentTurn: [],
      legsWon: resetLegsForNewSet ? 0 : player.legsWon,
      modeState: isCricketModeState(player.modeState)
        ? resetCricketLegState(player.modeState)
        : player.modeState,
      status: player.id === starterId ? "active" : "waiting",
    })),
  };
}

function scoreMapFor(
  players: readonly PlayerState[],
  selectScore: (player: PlayerState) => number,
): Readonly<Record<PlayerId, number>> {
  const scores: Record<PlayerId, number> = {};

  for (const player of players) {
    scores[player.id] = selectScore(player);
  }

  return scores;
}

function createMatchResult(
  state: GameState,
  winnerId: PlayerId,
  completedAt: string,
): GameResult {
  return {
    winnerId,
    mode: "cricket",
    completedAt,
    finalPlayers: state.players,
    legsWonByPlayer: scoreMapFor(state.players, (player) => player.legsWon),
    setsWonByPlayer: scoreMapFor(state.players, (player) => player.setsWon),
  };
}

function playerDefsFromState(state: GameState): readonly PlayerDef[] {
  if (state.config.players.length > 0) {
    return state.config.players;
  }

  return state.players.map((player) => ({
    id: player.id,
    name: player.name,
    isBot: player.isBot,
    botLevel: player.botLevel,
  }));
}

function createReplayBase(state: GameState): GameState {
  if (!isCricketConfig(state.config)) {
    return state;
  }

  return {
    ...createCricketState(state.config, playerDefsFromState(state)),
    id: state.id,
    createdAt: state.createdAt,
    updatedAt: state.createdAt,
  };
}

function hasWonLegTarget(
  state: GameState,
  winner: PlayerState,
  config: CricketConfig,
): boolean {
  const legsToWin = positiveIntegerOr(
    config.matchFormat?.legsToWin,
    DEFAULT_LEGS_TO_WIN,
  );

  if (winner.legsWon < legsToWin) {
    return false;
  }

  if (config.matchFormat?.winByTwoLegs !== true) {
    return true;
  }

  const nextHighestLegs = state.players.reduce((highest, player) => {
    if (player.id === winner.id) {
      return highest;
    }

    return Math.max(highest, player.legsWon);
  }, 0);

  return winner.legsWon - nextHighestLegs >= 2;
}

function hasClosedAllTargets(player: PlayerState, config: CricketConfig): boolean {
  return targetsForConfig(config).every((target) => hasClosedTarget(player, target));
}

function hasReachedPointsRequirement(player: PlayerState, config: CricketConfig): boolean {
  const pointsRequired = nonNegativeFiniteOrUndefined(config.pointsRequiredToWin);

  return pointsRequired === undefined || playerCricketPoints(player) >= pointsRequired;
}

function hasWinningPoints(state: GameState, player: PlayerState, config: CricketConfig): boolean {
  if (!scorePointsEnabled(config)) {
    return true;
  }

  const playerPoints = playerCricketPoints(player);
  const opponents = nonEliminatedOpponents(state, player.id);

  if (config.variant === "standard") {
    return (
      hasReachedPointsRequirement(player, config) &&
      opponents.every((opponent) => playerPoints >= playerCricketPoints(opponent))
    );
  }

  if (config.variant === "cut-throat") {
    return opponents.every((opponent) => playerPoints <= playerCricketPoints(opponent));
  }

  return true;
}

function hasWonCricket(state: GameState, player: PlayerState, config: CricketConfig): boolean {
  return hasClosedAllTargets(player, config) && hasWinningPoints(state, player, config);
}

function completeCricketLeg(
  state: GameState,
  parentEvent: DartThrownEvent,
  config: CricketConfig,
  turnScore: number,
): GameState {
  const finishingTurn: Turn = state.currentTurn;
  const stateAfterTurn = completeTurn(state, parentEvent, turnScore);
  const legWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "leg-won"),
    type: "leg_won",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    leg: state.currentLeg,
    finishingTurn,
  };

  const stateAfterLeg = processEvent(stateAfterTurn, legWonEvent);
  const winnerAfterLeg = getPlayer(stateAfterLeg, parentEvent.playerId);

  if (!winnerAfterLeg || !hasWonLegTarget(stateAfterLeg, winnerAfterLeg, config)) {
    return beginNextLeg(
      stateAfterLeg,
      nextLegStarterAfterWinner(stateAfterLeg, parentEvent.playerId),
      false,
    );
  }

  const setWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "set-won"),
    type: "set_won",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    set: state.currentSet,
    legsWon: winnerAfterLeg.legsWon,
  };
  const stateAfterSet = processEvent(stateAfterLeg, setWonEvent);
  const winnerAfterSet = getPlayer(stateAfterSet, parentEvent.playerId);
  const setsToWin = positiveIntegerOr(
    config.matchFormat?.setsToWin,
    DEFAULT_SETS_TO_WIN,
  );

  if (!winnerAfterSet || winnerAfterSet.setsWon < setsToWin) {
    return beginNextLeg(
      stateAfterSet,
      nextLegStarterAfterWinner(stateAfterSet, parentEvent.playerId),
      true,
    );
  }

  const result = createMatchResult(
    stateAfterSet,
    parentEvent.playerId,
    parentEvent.occurredAt,
  );
  const matchWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "match-won"),
    type: "match_won",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    result,
  };

  return processEvent(stateAfterSet, matchWonEvent);
}

function applyStoredDartThrown(
  state: GameState,
  event: DartThrownEvent,
  config: CricketConfig,
): GameState {
  const resolution = resolveDart(state, event.playerId, event.dart, config);
  const stateWithDart = processEvent(state, event);

  if (stateWithDart === state) {
    return state;
  }

  return applyResolvedDart(stateWithDart, event.playerId, resolution);
}

function applyStoredLegWon(
  state: GameState,
  event: GameEvent & { type: "leg_won" },
  nextEvent: GameEvent | undefined,
): GameState {
  const stateAfterLeg = processEvent(state, event);

  if (!nextEvent || nextEvent.type === "set_won" || nextEvent.type === "match_won") {
    return stateAfterLeg;
  }

  return beginNextLeg(
    stateAfterLeg,
    nextLegStarterAfterWinner(stateAfterLeg, event.playerId),
    false,
  );
}

function applyStoredSetWon(
  state: GameState,
  event: GameEvent & { type: "set_won" },
  nextEvent: GameEvent | undefined,
): GameState {
  const stateAfterSet = processEvent(state, event);

  if (!nextEvent || nextEvent.type === "match_won") {
    return stateAfterSet;
  }

  return beginNextLeg(
    stateAfterSet,
    nextLegStarterAfterWinner(stateAfterSet, event.playerId),
    true,
  );
}

function replayCricketEvents(baseState: GameState, events: readonly GameEvent[]): GameState {
  if (!isCricketConfig(baseState.config)) {
    return baseState;
  }

  let nextState = baseState;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const nextEvent = events[index + 1];

    switch (event.type) {
      case "dart_thrown":
        nextState = applyStoredDartThrown(nextState, event, baseState.config);
        break;
      case "leg_won":
        nextState = applyStoredLegWon(nextState, event, nextEvent);
        break;
      case "set_won":
        nextState = applyStoredSetWon(nextState, event, nextEvent);
        break;
      case "game_started":
      case "turn_total_submitted":
      case "turn_complete":
      case "player_bust":
      case "round_advanced":
      case "match_won":
      case "match_continued":
      case "undo":
        nextState = processEvent(nextState, event);
        break;
    }
  }

  return nextState;
}

function lastDartEventIndex(eventLog: readonly GameEvent[]): number {
  for (let index = eventLog.length - 1; index >= 0; index -= 1) {
    if (eventLog[index].type === "dart_thrown") {
      return index;
    }
  }

  return -1;
}

function applyDartThrown(state: GameState, event: DartThrownEvent, config: CricketConfig): GameState {
  if (
    state.phase !== "playing" ||
    state.activePlayerId !== event.playerId ||
    !isDartIndex(event.dartIndex) ||
    event.dartIndex !== state.currentTurn.length ||
    state.currentTurn.length >= 3 ||
    !isValidDart(event.dart)
  ) {
    return state;
  }

  const player = getPlayer(state, event.playerId);

  if (!player || player.status !== "active" || !isCricketModeState(player.modeState)) {
    return state;
  }

  const resolution = resolveDart(state, event.playerId, event.dart, config);
  const scoredEvent: DartThrownEvent = {
    ...event,
    score: resolution.totalPoints,
  };
  const stateWithDart = processEvent(state, scoredEvent);

  if (stateWithDart === state) {
    return state;
  }

  const stateWithScore = applyResolvedDart(stateWithDart, event.playerId, resolution);
  const turnScore = currentTurnCricketPoints(state, event.playerId) + resolution.totalPoints;
  const scoredPlayer = getPlayer(stateWithScore, event.playerId);

  if (scoredPlayer && hasWonCricket(stateWithScore, scoredPlayer, config)) {
    return completeCricketLeg(stateWithScore, event, config, turnScore);
  }

  if (stateWithScore.currentTurn.length === 3) {
    return completeTurn(stateWithScore, event, turnScore);
  }

  return stateWithScore;
}

export function createCricketState(
  config: CricketConfig,
  players: readonly PlayerDef[] = config.players,
): GameState {
  return createGameState(config, players);
}

export function cricketReducer(state: GameState, event: GameEvent): GameState {
  if (state.mode !== "cricket" || !isCricketConfig(state.config)) {
    return state;
  }

  if (!isKnownGameEventType(event.type)) {
    return state;
  }

  if (event.type !== "dart_thrown") {
    return processEvent(state, event);
  }

  return applyDartThrown(state, event, state.config);
}

export function undoLastCricketDart(
  state: GameState,
  eventLog: readonly GameEvent[],
): { state: GameState; eventLog: GameEvent[] } {
  const dartEventIndex = lastDartEventIndex(eventLog);

  if (dartEventIndex === -1) {
    return { state, eventLog: [...eventLog] };
  }

  const retainedEvents = eventLog.slice(0, dartEventIndex);

  return {
    state: replayCricketEvents(createReplayBase(state), retainedEvents),
    eventLog: retainedEvents,
  };
}
