import type {
  Checkout121Config,
  Checkout121PlayerModeState,
  Dart,
  DartThrownEvent,
  GameConfig,
  GameEvent,
  GameResult,
  GameState,
  PlayerDef,
  PlayerId,
  PlayerModeState,
  PlayerState,
  Turn,
} from "@/types";

import { createGameState, processEvent } from "./core";
import { dartScore } from "./utils";
import { isValidDart } from "./validation";

function isCheckout121Config(config: GameConfig): config is Checkout121Config {
  return config.mode === "checkout-121";
}

function isCheckout121ModeState(
  modeState: PlayerModeState,
): modeState is Checkout121PlayerModeState {
  return modeState.mode === "checkout-121";
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
    mode: "checkout-121",
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

function minimumTarget(config: Checkout121Config): number {
  return positiveIntegerOr(config.minimumTarget, config.startingTarget);
}

function maximumTarget(config: Checkout121Config): number | undefined {
  if (
    typeof config.maximumTarget !== "number" ||
    !Number.isInteger(config.maximumTarget) ||
    config.maximumTarget < minimumTarget(config)
  ) {
    return undefined;
  }

  return config.maximumTarget;
}

function nextSuccessTarget(config: Checkout121Config, currentTarget: number): number {
  const maximum = maximumTarget(config);
  const nextTarget = currentTarget + positiveIntegerOr(config.successStep, 1);

  return maximum === undefined ? nextTarget : Math.min(maximum, nextTarget);
}

function nextFailureTarget(config: Checkout121Config, currentTarget: number): number {
  return Math.max(
    minimumTarget(config),
    currentTarget - positiveIntegerOr(config.failureStep, 1),
  );
}

function completedMaximum(config: Checkout121Config, currentTarget: number): boolean {
  const maximum = maximumTarget(config);

  return maximum !== undefined && currentTarget >= maximum;
}

function isDoubleDart(dart: Dart): boolean {
  if ("miss" in dart) {
    return false;
  }

  return dart.segment === 50 || dart.multiplier === 2;
}

function isCheckoutBust(remainingAfterDart: number, dart: Dart): boolean {
  if (remainingAfterDart < 0 || remainingAfterDart === 1) {
    return true;
  }

  return remainingAfterDart === 0 && !isDoubleDart(dart);
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

function currentTurnAppliedScore(state: GameState, playerId: PlayerId): number {
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

function updateCheckout121ModeState(
  state: GameState,
  playerId: PlayerId,
  update: (modeState: Checkout121PlayerModeState) => Checkout121PlayerModeState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId || !isCheckout121ModeState(player.modeState)) {
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
  remainingScore: number,
): GameState {
  const event: GameEvent = {
    id: generatedEventId(parentEvent, "turn-complete"),
    type: "turn_complete",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    turn: state.currentTurn,
    score,
    remainingScore,
  };

  return processEvent(state, event);
}

function completeBustTurn(
  state: GameState,
  parentEvent: DartThrownEvent,
  scoreBeforeTurn: number,
  attemptedScore: number,
  targetExhausted: boolean,
  config: Checkout121Config,
): GameState {
  const bustEvent: GameEvent = {
    id: generatedEventId(parentEvent, "player-bust"),
    type: "player_bust",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    scoreBeforeTurn,
    attemptedScore,
  };
  const stateWithBust = processEvent(state, bustEvent);
  const stateAfterFailure = targetExhausted
    ? applyTargetFailure(stateWithBust, parentEvent.playerId, config)
    : stateWithBust;

  return completeTurn(stateAfterFailure, parentEvent, 0, scoreBeforeTurn);
}

function completeGame(state: GameState, parentEvent: DartThrownEvent, finishingTurn: Turn): GameState {
  const legWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "leg-won"),
    type: "leg_won",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    leg: state.currentLeg,
    finishingTurn,
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

function applyTargetSuccess(
  state: GameState,
  playerId: PlayerId,
  config: Checkout121Config,
): GameState {
  return updateCheckout121ModeState(state, playerId, (modeState) => {
    const nextTarget = nextSuccessTarget(config, modeState.currentTargetScore);

    return {
      ...modeState,
      currentTargetScore: nextTarget,
      remainingTargetScore: nextTarget,
      dartsThrownAtCurrentTarget: 0,
      successfulTargets: [...modeState.successfulTargets, modeState.currentTargetScore],
    };
  });
}

function applyTargetFailure(
  state: GameState,
  playerId: PlayerId,
  config: Checkout121Config,
): GameState {
  return updateCheckout121ModeState(state, playerId, (modeState) => {
    const nextTarget = nextFailureTarget(config, modeState.currentTargetScore);

    return {
      ...modeState,
      currentTargetScore: nextTarget,
      remainingTargetScore: nextTarget,
      dartsThrownAtCurrentTarget: 0,
      failedTargets: [...modeState.failedTargets, modeState.currentTargetScore],
    };
  });
}

function applyDartThrown(
  state: GameState,
  event: DartThrownEvent,
  config: Checkout121Config,
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

  if (!player || player.status !== "active" || !isCheckout121ModeState(player.modeState)) {
    return state;
  }

  const appliedInTurn = currentTurnAppliedScore(state, event.playerId);
  const remainingBeforeDart = player.modeState.remainingTargetScore;
  const scoreBeforeTurn = remainingBeforeDart + appliedInTurn;
  const dartValue = dartScore(event.dart);
  const remainingAfterDart = remainingBeforeDart - dartValue;
  const bust = dartValue > 0 && isCheckoutBust(remainingAfterDart, event.dart);
  const targetCompleted = !bust && remainingAfterDart === 0;
  const dartsUsedAfter = player.modeState.dartsThrownAtCurrentTarget + 1;
  const targetExhausted = dartsUsedAfter >= config.dartsPerTarget;
  const scoredEvent: DartThrownEvent = {
    ...event,
    score: dartValue,
  };
  const stateWithDart = processEvent(state, scoredEvent);

  if (stateWithDart === state) {
    return state;
  }

  const stateWithProgress = updateCheckout121ModeState(
    stateWithDart,
    event.playerId,
    (modeState) => ({
      ...modeState,
      remainingTargetScore: bust ? scoreBeforeTurn : remainingAfterDart,
      dartsThrownAtCurrentTarget: dartsUsedAfter,
    }),
  );
  const turnScore = appliedInTurn + (bust ? 0 : dartValue);

  if (bust) {
    return completeBustTurn(
      stateWithProgress,
      event,
      scoreBeforeTurn,
      appliedInTurn + dartValue,
      targetExhausted,
      config,
    );
  }

  if (targetCompleted) {
    const finishingTurn = stateWithProgress.currentTurn;
    const stateAfterSuccess = applyTargetSuccess(stateWithProgress, event.playerId, config);
    const stateAfterTurn = completeTurn(stateAfterSuccess, event, turnScore, 0);

    return completedMaximum(config, player.modeState.currentTargetScore)
      ? completeGame(stateAfterTurn, event, finishingTurn)
      : stateAfterTurn;
  }

  if (targetExhausted) {
    const stateAfterFailure = applyTargetFailure(stateWithProgress, event.playerId, config);
    const playerAfterFailure = getPlayer(stateAfterFailure, event.playerId);
    const remainingAfterFailure =
      playerAfterFailure && isCheckout121ModeState(playerAfterFailure.modeState)
        ? playerAfterFailure.modeState.remainingTargetScore
        : remainingAfterDart;

    return completeTurn(stateAfterFailure, event, turnScore, remainingAfterFailure);
  }

  if (stateWithProgress.currentTurn.length === 3) {
    return completeTurn(stateWithProgress, event, turnScore, remainingAfterDart);
  }

  return stateWithProgress;
}

export function createCheckout121State(
  config: Checkout121Config,
  players: readonly PlayerDef[] = config.players,
): GameState {
  return createGameState(config, players);
}

export function checkout121Reducer(state: GameState, event: GameEvent): GameState {
  if (state.mode !== "checkout-121" || !isCheckout121Config(state.config)) {
    return state;
  }

  if (event.type !== "dart_thrown") {
    return processEvent(state, event);
  }

  return applyDartThrown(state, event, state.config);
}
