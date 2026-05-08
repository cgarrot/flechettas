import type {
  Bobs27Config,
  Bobs27PlayerModeState,
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
} from "@/types";

import { createGameState, processEvent } from "./core";
import { isNumberSegment, isValidDart } from "./validation";

const NUMBER_SEGMENTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const satisfies readonly NumberSegment[];

type Bobs27Target = NumberSegment | 25;

function isBobs27Config(config: GameConfig): config is Bobs27Config {
  return config.mode === "bobs-27";
}

function isBobs27ModeState(modeState: PlayerModeState): modeState is Bobs27PlayerModeState {
  return modeState.mode === "bobs-27";
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
    mode: "bobs-27",
    completedAt,
    finalPlayers: state.players,
    legsWonByPlayer: scoreMapFor(state.players, (player) => player.legsWon),
    setsWonByPlayer: scoreMapFor(state.players, (player) => player.setsWon),
  };
}

function bobs27Targets(config: Bobs27Config): Bobs27Target[] {
  const configuredTargets = config.rounds ?? [...NUMBER_SEGMENTS, 25];
  const targets: Bobs27Target[] = [];

  for (const target of configuredTargets) {
    if ((isNumberSegment(target) || target === 25) && !targets.includes(target)) {
      targets.push(target);
    }
  }

  return targets.length > 0 ? targets : [...NUMBER_SEGMENTS, 25];
}

function nextTargetAfter(config: Bobs27Config, target: Bobs27Target): Bobs27Target | undefined {
  const targets = bobs27Targets(config);
  const index = targets.indexOf(target);

  return index === -1 ? targets[0] : targets[index + 1];
}

function targetValue(target: Bobs27Target): number {
  return target === 25 ? 50 : target * 2;
}

function isTargetHit(dart: Dart, target: Bobs27Target): boolean {
  if ("miss" in dart) {
    return false;
  }

  if (target === 25) {
    return dart.segment === 50;
  }

  return dart.segment === target && dart.multiplier === 2;
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

function currentTurnBonus(state: GameState, playerId: PlayerId): number {
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

function updateBobs27ModeState(
  state: GameState,
  playerId: PlayerId,
  update: (modeState: Bobs27PlayerModeState) => Bobs27PlayerModeState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId || !isBobs27ModeState(player.modeState)) {
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

function withEliminatedPlayer(state: GameState, playerId: PlayerId): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, status: "eliminated" as const, currentTurn: [] }
        : player,
    ),
  };
}

function hasCompletedAllRounds(player: PlayerState, config: Bobs27Config): boolean {
  return (
    isBobs27ModeState(player.modeState) &&
    player.modeState.completedRounds.length >= bobs27Targets(config).length
  );
}

function activePlayers(state: GameState): readonly PlayerState[] {
  return state.players.filter((player) => player.status !== "eliminated");
}

function allPlayersDone(state: GameState, config: Bobs27Config): boolean {
  return state.players.every(
    (player) => player.status === "eliminated" || hasCompletedAllRounds(player, config),
  );
}

function bobs27Score(player: PlayerState): number {
  return isBobs27ModeState(player.modeState) ? player.modeState.score : Number.NEGATIVE_INFINITY;
}

function winnerByScore(state: GameState): PlayerState | undefined {
  return state.players.reduce<PlayerState | undefined>((winner, player) => {
    if (!winner) {
      return player;
    }

    return bobs27Score(player) > bobs27Score(winner) ? player : winner;
  }, undefined);
}

function completeGame(state: GameState, winner: PlayerState, parentEvent: DartThrownEvent): GameState {
  const legWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "leg-won"),
    type: "leg_won",
    occurredAt: parentEvent.occurredAt,
    playerId: winner.id,
    leg: state.currentLeg,
  };
  const stateAfterLeg = processEvent(state, legWonEvent);
  const result = createMatchResult(stateAfterLeg, winner.id, parentEvent.occurredAt);
  const matchWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "match-won"),
    type: "match_won",
    occurredAt: parentEvent.occurredAt,
    playerId: winner.id,
    result,
  };

  return processEvent(stateAfterLeg, matchWonEvent);
}

function maybeCompleteGame(
  state: GameState,
  parentEvent: DartThrownEvent,
  config: Bobs27Config,
): GameState {
  const remainingPlayers = activePlayers(state);

  if (state.players.length > 1 && remainingPlayers.length === 1) {
    return completeGame(state, remainingPlayers[0], parentEvent);
  }

  if (!allPlayersDone(state, config)) {
    return state;
  }

  const winner = winnerByScore(state);

  return winner ? completeGame(state, winner, parentEvent) : state;
}

function applyCompletedRound(
  state: GameState,
  event: DartThrownEvent,
  config: Bobs27Config,
  modeState: Bobs27PlayerModeState,
  turnBonus: number,
): GameState {
  const roundTarget = modeState.currentDouble;
  const roundValue = targetValue(roundTarget);
  const delta = turnBonus > 0 ? turnBonus : -roundValue;
  const nextScore = modeState.score + delta;
  const nextTarget = nextTargetAfter(config, roundTarget);
  const stateWithRound = updateBobs27ModeState(state, event.playerId, (currentModeState) => ({
    ...currentModeState,
    score: nextScore,
    currentDouble: nextTarget ?? roundTarget,
    completedRounds: [...currentModeState.completedRounds, roundTarget],
  }));
  const stateAfterTurn = completeTurn(stateWithRound, event, Math.max(0, turnBonus));
  const stateAfterElimination =
    config.allowNegativeScore === true || nextScore > 0
      ? stateAfterTurn
      : withEliminatedPlayer(stateAfterTurn, event.playerId);

  return maybeCompleteGame(stateAfterElimination, event, config);
}

function applyDartThrown(
  state: GameState,
  event: DartThrownEvent,
  config: Bobs27Config,
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

  if (!player || player.status !== "active" || !isBobs27ModeState(player.modeState)) {
    return state;
  }

  const dartBonus = isTargetHit(event.dart, player.modeState.currentDouble)
    ? targetValue(player.modeState.currentDouble)
    : 0;
  const scoredEvent: DartThrownEvent = {
    ...event,
    score: dartBonus,
  };
  const stateWithDart = processEvent(state, scoredEvent);

  if (stateWithDart === state) {
    return state;
  }

  const turnBonus = currentTurnBonus(state, event.playerId) + dartBonus;

  if (stateWithDart.currentTurn.length === 3) {
    return applyCompletedRound(stateWithDart, event, config, player.modeState, turnBonus);
  }

  return stateWithDart;
}

export function getBobs27Targets(config: Bobs27Config): Bobs27Target[] {
  return bobs27Targets(config);
}

export function createBobs27State(
  config: Bobs27Config,
  players: readonly PlayerDef[] = config.players,
): GameState {
  return createGameState(config, players);
}

export function bobs27Reducer(state: GameState, event: GameEvent): GameState {
  if (state.mode !== "bobs-27" || !isBobs27Config(state.config)) {
    return state;
  }

  if (event.type !== "dart_thrown") {
    return processEvent(state, event);
  }

  return applyDartThrown(state, event, state.config);
}
