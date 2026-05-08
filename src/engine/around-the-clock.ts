import type {
  AroundTheClockConfig,
  AroundTheClockPlayerModeState,
  Dart,
  DartThrownEvent,
  GameConfig,
  GameEvent,
  GameResult,
  GameState,
  NumberSegment,
  PlayerDef,
  PlayerId,
  PlayerModeState,
  PlayerState,
  Turn,
} from "@/types";

import { createGameState, processEvent } from "./core";
import { isNumberSegment, isValidDart } from "./validation";

const NUMBER_SEGMENTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const satisfies readonly NumberSegment[];

type AroundTheClockTarget = NumberSegment | 25;

function isAroundTheClockConfig(config: GameConfig): config is AroundTheClockConfig {
  return config.mode === "around-the-clock";
}

function isAroundTheClockModeState(
  modeState: PlayerModeState,
): modeState is AroundTheClockPlayerModeState {
  return modeState.mode === "around-the-clock";
}

function isDartIndex(value: number): value is 0 | 1 | 2 {
  return Number.isInteger(value) && value >= 0 && value <= 2;
}

function generatedEventId(event: GameEvent, suffix: string): string {
  return `${event.id}:${suffix}`;
}

function getPlayer(state: GameState, playerId: PlayerId): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
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
    mode: "around-the-clock",
    completedAt,
    finalPlayers: state.players,
    legsWonByPlayer: scoreMapFor(state.players, (player) => player.legsWon),
    setsWonByPlayer: scoreMapFor(state.players, (player) => player.setsWon),
  };
}

function aroundTheClockTargets(config: AroundTheClockConfig): AroundTheClockTarget[] {
  const start = isNumberSegment(config.startSegment) ? config.startSegment : 1;
  const numericEnd = config.endSegment === 25 ? 20 : config.endSegment;
  const startIndex = NUMBER_SEGMENTS.indexOf(start);
  const endIndex = NUMBER_SEGMENTS.indexOf(numericEnd);
  const targets =
    startIndex <= endIndex
      ? NUMBER_SEGMENTS.slice(startIndex, endIndex + 1)
      : NUMBER_SEGMENTS.slice(endIndex, startIndex + 1).reverse();
  const withBull: AroundTheClockTarget[] = [...targets];

  if ((config.endSegment === 25 || config.includeBull === true) && !withBull.includes(25)) {
    withBull.push(25);
  }

  return withBull.length > 0 ? withBull : [1];
}

function nextTargetAfter(
  config: AroundTheClockConfig,
  target: AroundTheClockTarget,
): AroundTheClockTarget | undefined {
  const targets = aroundTheClockTargets(config);
  const index = targets.indexOf(target);

  return index === -1 ? targets[0] : targets[index + 1];
}

function isTargetHit(
  dart: Dart,
  target: AroundTheClockTarget,
  config: AroundTheClockConfig,
): boolean {
  if ("miss" in dart) {
    return false;
  }

  const requiredMultiplier = config.requiredMultiplier ?? "open";

  if (target === 25) {
    if (requiredMultiplier === 1) {
      return dart.segment === 25;
    }

    if (requiredMultiplier === 2) {
      return dart.segment === 50;
    }

    if (requiredMultiplier === 3) {
      return false;
    }

    return dart.segment === 25 || dart.segment === 50;
  }

  return (
    dart.segment === target &&
    (requiredMultiplier === "open" || dart.multiplier === requiredMultiplier)
  );
}

function isTurnBoundaryEvent(event: GameEvent): boolean {
  switch (event.type) {
    case "turn_complete":
    case "player_bust":
    case "leg_won":
    case "set_won":
    case "match_won":
      return true;
    case "game_started":
    case "dart_thrown":
    case "turn_total_submitted":
    case "round_advanced":
    case "undo":
      return false;
  }
}

function currentTurnHits(state: GameState, playerId: PlayerId): number {
  let hits = 0;

  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index];

    if (isTurnBoundaryEvent(event)) {
      break;
    }

    if (event.type === "dart_thrown" && event.playerId === playerId) {
      hits += event.score ?? 0;
    }
  }

  return hits;
}

function updateAroundTheClockModeState(
  state: GameState,
  playerId: PlayerId,
  update: (modeState: AroundTheClockPlayerModeState) => AroundTheClockPlayerModeState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId || !isAroundTheClockModeState(player.modeState)) {
        return player;
      }

      return {
        ...player,
        modeState: update(player.modeState),
      };
    }),
  };
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

function completeGame(
  state: GameState,
  parentEvent: DartThrownEvent,
  turnHits: number,
): GameState {
  const finishingTurn: Turn = state.currentTurn;
  const stateAfterTurn = completeTurn(state, parentEvent, turnHits);
  const legWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "leg-won"),
    type: "leg_won",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    leg: state.currentLeg,
    finishingTurn,
  };
  const stateAfterLeg = processEvent(stateAfterTurn, legWonEvent);
  const result = createMatchResult(stateAfterLeg, parentEvent.playerId, parentEvent.occurredAt);
  const matchWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "match-won"),
    type: "match_won",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    result,
  };

  return processEvent(stateAfterLeg, matchWonEvent);
}

function applyDartThrown(
  state: GameState,
  event: DartThrownEvent,
  config: AroundTheClockConfig,
): GameState {
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

  if (!player || player.status !== "active" || !isAroundTheClockModeState(player.modeState)) {
    return state;
  }

  const hit = isTargetHit(event.dart, player.modeState.currentTarget, config);
  const scoredEvent: DartThrownEvent = {
    ...event,
    score: hit ? 1 : 0,
  };
  const stateWithDart = processEvent(state, scoredEvent);

  if (stateWithDart === state) {
    return state;
  }

  const completedTarget = player.modeState.currentTarget;
  const nextTarget = hit ? nextTargetAfter(config, completedTarget) : completedTarget;
  const stateWithProgress = hit
    ? updateAroundTheClockModeState(stateWithDart, event.playerId, (modeState) => ({
        ...modeState,
        currentTarget: nextTarget ?? completedTarget,
        completedTargets: [...modeState.completedTargets, completedTarget],
        hits: modeState.hits + 1,
      }))
    : stateWithDart;
  const turnHits = currentTurnHits(state, event.playerId) + (hit ? 1 : 0);

  if (hit && !nextTarget) {
    return completeGame(stateWithProgress, event, turnHits);
  }

  if (stateWithProgress.currentTurn.length === 3) {
    return completeTurn(stateWithProgress, event, turnHits);
  }

  return stateWithProgress;
}

export function getAroundTheClockTargets(config: AroundTheClockConfig): AroundTheClockTarget[] {
  return aroundTheClockTargets(config);
}

export function createAroundTheClockState(
  config: AroundTheClockConfig,
  players: readonly PlayerDef[] = config.players,
): GameState {
  return createGameState(config, players);
}

export function aroundTheClockReducer(state: GameState, event: GameEvent): GameState {
  if (state.mode !== "around-the-clock" || !isAroundTheClockConfig(state.config)) {
    return state;
  }

  if (event.type !== "dart_thrown") {
    return processEvent(state, event);
  }

  return applyDartThrown(state, event, state.config);
}
