import type {
  Dart,
  DartTarget,
  GameConfig,
  GameEvent,
  GameResult,
  GameState,
  NumberSegment,
  PlayerDef,
  PlayerId,
  PlayerModeState,
  PlayerState,
  TrainingConfig,
  TrainingPlayerModeState,
} from "@/types";

import { createGameState, processEvent } from "./core";
import { dartScore } from "./utils";
import { isNumberSegment, isValidDart } from "./validation";

const ASCENDING_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const satisfies readonly NumberSegment[];
const DESCENDING_NUMBERS = [
  20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
] as const satisfies readonly NumberSegment[];
const DOUBLES_DOWN_NUMBERS = [20, 18, 16, 14, 12, 10, 8, 6, 4, 2] as const satisfies readonly NumberSegment[];
const TRAINING_CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;

function isTrainingConfig(config: GameConfig): config is TrainingConfig {
  return config.mode === "training";
}

function isTrainingModeState(modeState: PlayerModeState): modeState is TrainingPlayerModeState {
  return modeState.mode === "training";
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

function createMatchResult(state: GameState, winnerId: PlayerId, completedAt: string): GameResult {
  return {
    winnerId,
    mode: "training",
    completedAt,
    finalPlayers: state.players,
    legsWonByPlayer: scoreMapFor(state.players, (player) => player.legsWon),
    setsWonByPlayer: scoreMapFor(state.players, (player) => player.setsWon),
  };
}

function positiveIntegerOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function singlesTargets(): DartTarget[] {
  return ASCENDING_NUMBERS.map((segment) => ({ segment, multiplier: 1 }));
}

function doublesTargets(): DartTarget[] {
  return DESCENDING_NUMBERS.map((segment) => ({ segment, multiplier: 2 }));
}

export function getDoublesDownTargets(): DartTarget[] {
  return DOUBLES_DOWN_NUMBERS.map((segment) => ({ segment, multiplier: 2 }));
}

function defaultTargetsForConfig(config: TrainingConfig): DartTarget[] {
  switch (config.focus) {
    case "singles":
      return singlesTargets();
    case "doubles":
      return doublesTargets();
    case "checkout":
      return [{ segment: 20, multiplier: 2 }];
    case "cricket":
      return TRAINING_CRICKET_TARGETS.map((segment) => ({ segment }));
    case "scoring":
      return [{ segment: 20, multiplier: 3 }];
    case "custom":
      return [{ segment: 20 }];
  }
}

function isValidTarget(target: DartTarget): boolean {
  if (target.segment === 50) {
    return target.multiplier === undefined || target.multiplier === 1;
  }

  if (target.segment === 25) {
    return target.multiplier === undefined || target.multiplier === 1;
  }

  return isNumberSegment(target.segment);
}

function trainingTargets(config: TrainingConfig): DartTarget[] {
  const configuredTargets = config.targets?.filter(isValidTarget) ?? [];

  return configuredTargets.length > 0 ? configuredTargets : defaultTargetsForConfig(config);
}

function totalTargetVisits(config: TrainingConfig, targets: readonly DartTarget[]): number {
  const cycles = positiveIntegerOr(config.rounds, 1);

  return targets.length * cycles;
}

function hitsRequiredToAdvance(config: TrainingConfig): number {
  return positiveIntegerOr(config.hitsRequiredToAdvance, 1);
}

function currentTarget(modeState: TrainingPlayerModeState, config: TrainingConfig): DartTarget {
  const targets = trainingTargets(config);
  const index = modeState.targetHistory.length % targets.length;

  return targets[index];
}

function advancesOnHit(config: TrainingConfig): boolean {
  return config.focus !== "singles";
}

function advancesAfterTurn(config: TrainingConfig): boolean {
  return config.focus === "singles";
}

function targetMatches(dart: Dart, target: DartTarget): boolean {
  if ("miss" in dart) {
    return false;
  }

  if (target.segment === 25) {
    return (dart.segment === 25 || (target.multiplier === undefined && dart.segment === 50)) &&
      (target.multiplier === undefined || dart.multiplier === target.multiplier);
  }

  if (target.segment === 50) {
    return dart.segment === 50;
  }

  return (
    dart.segment === target.segment &&
    (target.multiplier === undefined || dart.multiplier === target.multiplier)
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

function currentTurnScore(state: GameState, playerId: PlayerId): number {
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

function updateTrainingModeState(
  state: GameState,
  playerId: PlayerId,
  update: (modeState: TrainingPlayerModeState) => TrainingPlayerModeState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId || !isTrainingModeState(player.modeState)) {
        return player;
      }

      return {
        ...player,
        modeState: update(player.modeState),
      };
    }),
  };
}

function completedTargetVisits(modeState: TrainingPlayerModeState, config: TrainingConfig): boolean {
  return modeState.targetHistory.length >= totalTargetVisits(config, trainingTargets(config));
}

function completeTurn(
  state: GameState,
  parentEvent: GameEvent & { type: "dart_thrown" },
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
  parentEvent: GameEvent & { type: "dart_thrown" },
): GameState {
  const legWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "leg-won"),
    type: "leg_won",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    leg: state.currentLeg,
  };
  const stateAfterLeg = processEvent(state, legWonEvent);
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

function maxTurnsReached(state: GameState, playerId: PlayerId, config: TrainingConfig): boolean {
  const maxTurns = positiveIntegerOr(config.maxTurns, 0);
  const player = getPlayer(state, playerId);

  return maxTurns > 0 && !!player && player.turnsPlayed >= maxTurns;
}

function maybeCompleteAfterTurn(
  state: GameState,
  parentEvent: GameEvent & { type: "dart_thrown" },
  config: TrainingConfig,
): GameState {
  const player = getPlayer(state, parentEvent.playerId);

  if (
    player &&
    isTrainingModeState(player.modeState) &&
    (completedTargetVisits(player.modeState, config) || maxTurnsReached(state, player.id, config))
  ) {
    return completeGame(state, parentEvent);
  }

  return state;
}

function applyDartThrown(
  state: GameState,
  event: GameEvent & { type: "dart_thrown" },
  config: TrainingConfig,
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

  if (!player || player.status !== "active" || !isTrainingModeState(player.modeState)) {
    return state;
  }

  const target = currentTarget(player.modeState, config);
  const hit = targetMatches(event.dart, target);
  const dartValue = hit ? dartScore(event.dart) : 0;
  const scoredEvent = {
    ...event,
    score: dartValue,
  };
  const stateWithDart = processEvent(state, scoredEvent);

  if (stateWithDart === state) {
    return state;
  }

  const stateWithAttempt = updateTrainingModeState(
    stateWithDart,
    event.playerId,
    (modeState) => ({
      ...modeState,
      attempts: modeState.attempts + 1,
      hits: modeState.hits + (hit ? 1 : 0),
      score: modeState.score + dartValue,
      currentTargetHits: hit && advancesOnHit(config)
        ? (modeState.currentTargetHits + 1 >= hitsRequiredToAdvance(config)
            ? 0
            : modeState.currentTargetHits + 1)
        : modeState.currentTargetHits,
      targetHistory: hit && advancesOnHit(config) &&
        modeState.currentTargetHits + 1 >= hitsRequiredToAdvance(config)
        ? [...modeState.targetHistory, target]
        : modeState.targetHistory,
    }),
  );
  const turnScore = currentTurnScore(state, event.playerId) + dartValue;
  const updatedPlayer = getPlayer(stateWithAttempt, event.playerId);

  if (
    updatedPlayer &&
    isTrainingModeState(updatedPlayer.modeState) &&
    completedTargetVisits(updatedPlayer.modeState, config)
  ) {
    return completeGame(completeTurn(stateWithAttempt, event, turnScore), event);
  }

  if (stateWithAttempt.currentTurn.length === 3) {
    const stateWithRound = advancesAfterTurn(config)
      ? updateTrainingModeState(stateWithAttempt, event.playerId, (modeState) => ({
          ...modeState,
          currentTargetHits: 0,
          targetHistory: [...modeState.targetHistory, target],
        }))
      : stateWithAttempt;
    const stateAfterTurn = completeTurn(stateWithRound, event, turnScore);

    return maybeCompleteAfterTurn(stateAfterTurn, event, config);
  }

  return stateWithAttempt;
}

export function getTrainingTargets(config: TrainingConfig): DartTarget[] {
  return trainingTargets(config);
}

export function createTrainingState(
  config: TrainingConfig,
  players: readonly PlayerDef[] = config.players,
): GameState {
  return createGameState(config, players);
}

export function trainingReducer(state: GameState, event: GameEvent): GameState {
  if (state.mode !== "training" || !isTrainingConfig(state.config)) {
    return state;
  }

  if (event.type !== "dart_thrown") {
    return processEvent(state, event);
  }

  return applyDartThrown(state, event, state.config);
}
