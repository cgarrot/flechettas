import type {
  Dart,
  DartIndex,
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
  X01Config,
  X01PlayerModeState,
} from "@/types";

import { getCheckouts } from "../data/checkouts";
import { createGameState, processEvent } from "./core";
import { dartScore, turnScore } from "./utils";
import { isValidDart } from "./validation";

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

type X01OutConfig = Pick<X01Config, "doubleOut" | "masterOut">;

function isX01Config(config: GameConfig): config is X01Config {
  return config.mode === "x01";
}

function isX01ModeState(modeState: PlayerModeState): modeState is X01PlayerModeState {
  return modeState.mode === "x01";
}

function isDartIndex(value: number): value is DartIndex {
  return Number.isInteger(value) && value >= 0 && value <= 2;
}

function isKnownGameEventType(type: string): type is GameEventType {
  return GAME_EVENT_TYPES.has(type);
}

function positiveIntegerOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function isDoubleDart(dart: Dart): boolean {
  if ("miss" in dart) {
    return false;
  }

  return dart.segment === 50 || dart.multiplier === 2;
}

function requiresOutDart(config: X01OutConfig): boolean {
  return config.doubleOut || config.masterOut === true;
}

function isValidOutDart(dart: Dart | undefined, config: X01OutConfig): boolean {
  if (!dart || "miss" in dart) {
    return false;
  }

  if (config.masterOut === true) {
    return dart.segment === 50 || dart.multiplier === 2 || dart.multiplier === 3;
  }

  if (config.doubleOut) {
    return isDoubleDart(dart);
  }

  return true;
}

function generatedEventId(event: GameEvent, suffix: string): string {
  return `${event.id}:${suffix}`;
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

function currentTurnAppliedScore(state: GameState, playerId: PlayerId): number {
  let total = 0;

  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index];

    if (isTurnBoundaryEvent(event)) {
      break;
    }

    if (event.type === "dart_thrown" && event.playerId === playerId) {
      total += event.score ?? dartScore(event.dart);
    }
  }

  return total;
}

function currentTurnScoringDarts(state: GameState, playerId: PlayerId): Dart[] {
  const darts: Dart[] = [];

  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index];

    if (isTurnBoundaryEvent(event)) {
      break;
    }

    if (event.type === "dart_thrown" && event.playerId === playerId) {
      const score = event.score ?? dartScore(event.dart);

      if (score > 0) {
        darts.unshift(event.dart);
      }
    }
  }

  return darts;
}

function getPlayer(state: GameState, playerId: PlayerId): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

function updateX01ModeState(
  state: GameState,
  playerId: PlayerId,
  update: (modeState: X01PlayerModeState) => X01PlayerModeState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId || !isX01ModeState(player.modeState)) {
        return player;
      }

      return {
        ...player,
        modeState: update(player.modeState),
      };
    }),
  };
}

function resetX01LegState(modeState: X01PlayerModeState): X01PlayerModeState {
  return {
    ...modeState,
    remainingScore: modeState.startingScore,
    dartsThrownInLeg: 0,
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
    players: state.players.map((player) => {
      const preserveSpectator =
        player.status === "winner" || player.status === "eliminated";

      return {
        ...player,
        currentTurn: [],
        legsWon: preserveSpectator
          ? player.legsWon
          : resetLegsForNewSet
            ? 0
            : player.legsWon,
        modeState:
          preserveSpectator || !isX01ModeState(player.modeState)
            ? player.modeState
            : resetX01LegState(player.modeState),
        status: preserveSpectator
          ? player.status
          : player.id === starterId
            ? "active"
            : "waiting",
      };
    }),
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
    mode: "x01",
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
  if (!isX01Config(state.config)) {
    return state;
  }

  return {
    ...createX01State(state.config, playerDefsFromState(state)),
    id: state.id,
    createdAt: state.createdAt,
    updatedAt: state.createdAt,
  };
}

function applyStoredDartThrown(state: GameState, event: DartThrownEvent): GameState {
  const player = getPlayer(state, event.playerId);

  if (!player || !isX01ModeState(player.modeState)) {
    return state;
  }

  const scoreBeforeTurn = player.modeState.remainingScore + currentTurnAppliedScore(state, event.playerId);
  const checkoutAttempt = state.currentTurn.length === 0 && isCheckoutOpportunity(scoreBeforeTurn);
  const stateWithDart = processEvent(state, event);

  if (stateWithDart === state) {
    return state;
  }

  return updateX01ModeState(stateWithDart, event.playerId, (modeState) => ({
    ...modeState,
    checkoutAttempts: modeState.checkoutAttempts + (checkoutAttempt ? 1 : 0),
    dartsThrownInLeg: modeState.dartsThrownInLeg + 1,
    remainingScore: modeState.remainingScore - (event.score ?? dartScore(event.dart)),
  }));
}

function applyStoredPlayerBust(
  state: GameState,
  event: GameEvent & { type: "player_bust" },
): GameState {
  const stateWithBust = processEvent(state, event);

  if (stateWithBust === state) {
    return state;
  }

  return updateX01ModeState(stateWithBust, event.playerId, (modeState) => ({
    ...modeState,
    busts: modeState.busts + 1,
    remainingScore: event.scoreBeforeTurn,
  }));
}

function applyStoredLegWon(
  state: GameState,
  event: GameEvent & { type: "leg_won" },
  nextEvent: GameEvent | undefined,
): GameState {
  const stateAfterLeg = processEvent(state, event);
  const stateWithCheckoutHit = updateX01ModeState(
    stateAfterLeg,
    event.playerId,
    (modeState) => ({
      ...modeState,
      checkoutHits: modeState.checkoutHits + 1,
      remainingScore: 0,
    }),
  );

  if (!nextEvent || nextEvent.type === "set_won" || nextEvent.type === "match_won") {
    return stateWithCheckoutHit;
  }

  return beginNextLeg(
    stateWithCheckoutHit,
    nextLegStarterAfterWinner(stateWithCheckoutHit, event.playerId),
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

function replayX01Events(baseState: GameState, events: readonly GameEvent[]): GameState {
  let nextState = baseState;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const nextEvent = events[index + 1];

    switch (event.type) {
      case "dart_thrown":
        nextState = applyStoredDartThrown(nextState, event);
        break;
      case "player_bust":
        nextState = applyStoredPlayerBust(nextState, event);
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

  return completeTurn(stateWithBust, parentEvent, 0, scoreBeforeTurn);
}

function hasWonLegTarget(
  state: GameState,
  winner: PlayerState,
  config: X01Config,
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

function completeLeg(
  state: GameState,
  parentEvent: DartThrownEvent,
  config: X01Config,
  scoreBeforeTurn: number,
): GameState {
  const finishingTurn = state.currentTurn;
  const stateAfterTurn = completeTurn(state, parentEvent, scoreBeforeTurn, 0);
  const legWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "leg-won"),
    type: "leg_won",
    occurredAt: parentEvent.occurredAt,
    playerId: parentEvent.playerId,
    leg: state.currentLeg,
    checkoutScore: scoreBeforeTurn,
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

function isCheckoutOpportunity(score: number): boolean {
  return getCheckoutSuggestions(score).length > 0;
}

function applyDartThrown(state: GameState, event: DartThrownEvent, config: X01Config): GameState {
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

  if (!player || player.status !== "active" || !isX01ModeState(player.modeState)) {
    return state;
  }

  const appliedInTurn = currentTurnAppliedScore(state, event.playerId);
  const scoreBeforeTurn = player.modeState.remainingScore + appliedInTurn;
  const alreadyOpened = !config.doubleIn || scoreBeforeTurn < player.modeState.startingScore;
  const openedDuringTurn = appliedInTurn > 0;
  const dartCounts = alreadyOpened || openedDuringTurn || isDoubleDart(event.dart);
  const dartValue = dartCounts ? dartScore(event.dart) : 0;
  const candidateRemaining = player.modeState.remainingScore - dartValue;
  const scoringDarts = currentTurnScoringDarts(state, event.playerId);

  if (dartValue > 0) {
    scoringDarts.push(event.dart);
  }

  const bust = dartValue > 0 && isBust(scoreBeforeTurn, scoringDarts, config);
  const checkoutAttempt = state.currentTurn.length === 0 && isCheckoutOpportunity(scoreBeforeTurn);
  const checkoutHit = !bust && candidateRemaining === 0;
  const scoredEvent: DartThrownEvent = {
    ...event,
    score: dartValue,
  };
  const stateWithDart = processEvent(state, scoredEvent);

  if (stateWithDart === state) {
    return state;
  }

  const stateWithScore = updateX01ModeState(
    stateWithDart,
    event.playerId,
    (modeState) => ({
      ...modeState,
      busts: modeState.busts + (bust ? 1 : 0),
      checkoutAttempts: modeState.checkoutAttempts + (checkoutAttempt ? 1 : 0),
      checkoutHits: modeState.checkoutHits + (checkoutHit ? 1 : 0),
      dartsThrownInLeg: modeState.dartsThrownInLeg + 1,
      remainingScore: bust ? scoreBeforeTurn : candidateRemaining,
    }),
  );

  if (bust) {
    return completeBustTurn(
      stateWithScore,
      event,
      scoreBeforeTurn,
      appliedInTurn + dartValue,
    );
  }

  if (candidateRemaining === 0) {
    return completeLeg(stateWithScore, event, config, scoreBeforeTurn);
  }

  if (stateWithScore.currentTurn.length === 3) {
    return completeTurn(
      stateWithScore,
      event,
      appliedInTurn + dartValue,
      candidateRemaining,
    );
  }

  return stateWithScore;
}

export function createX01State(
  config: X01Config,
  players: readonly PlayerDef[] = config.players,
): GameState {
  return createGameState(config, players);
}

export function getCheckoutSuggestions(remaining: number): Dart[][] {
  if (!Number.isInteger(remaining)) {
    return [];
  }

  return getCheckouts(remaining);
}

export function isBust(
  currentScore: number,
  dartsInTurn: Turn,
  config: X01OutConfig,
): boolean {
  const remaining = currentScore - turnScore(dartsInTurn);

  if (remaining < 0) {
    return true;
  }

  if (requiresOutDart(config) && remaining === 1) {
    return true;
  }

  if (remaining === 0 && !isValidOutDart(dartsInTurn[dartsInTurn.length - 1], config)) {
    return true;
  }

  return false;
}

export function x01Reducer(state: GameState, event: GameEvent): GameState {
  if (state.mode !== "x01" || !isX01Config(state.config)) {
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

export function undoLastX01Dart(
  state: GameState,
  eventLog: readonly GameEvent[],
): { state: GameState; eventLog: GameEvent[] } {
  const dartEventIndex = lastDartEventIndex(eventLog);

  if (dartEventIndex === -1) {
    return { state, eventLog: [...eventLog] };
  }

  const retainedEvents = eventLog.slice(0, dartEventIndex);

  return {
    state: replayX01Events(createReplayBase(state), retainedEvents),
    eventLog: retainedEvents,
  };
}
