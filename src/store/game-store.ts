"use client";

import { create } from "zustand";

import {
  clearActiveGame,
  loadActiveGame,
  saveActiveGame,
} from "@/db/active-game-store";
import {
  aroundTheClockReducer,
  bobs27Reducer,
  checkout121Reducer,
  createAroundTheClockState,
  createBobs27State,
  createCheckout121State,
  createCricketState,
  createKillerState,
  createShanghaiState,
  createTrainingState,
  createX01State,
  cricketReducer,
  dartScore,
  getCheckoutSuggestions,
  killerReducer,
  shanghaiReducer,
  trainingReducer,
  undoLastCricketDart,
  undoLastX01Dart,
  x01Reducer,
} from "@/engine";
import { onGameComplete } from "@/services/history-service";

import type {
  Dart,
  DartIndex,
  GameConfig,
  GameEvent,
  GameMode,
  GameState,
  Multiplier,
  NumberSegment,
  PlayerDef,
  PlayerId,
  Turn,
  X01Config,
} from "@/types";

export type GameInputMode = "dart-by-dart" | "turn-total";

type ActiveGameSnapshot = {
  gameState: GameState | null;
  eventLog: GameEvent[];
  mode: GameMode | null;
  config: GameConfig | null;
};

type UndoResult = {
  state: GameState;
  eventLog: GameEvent[];
};

export type GameStoreState = ActiveGameSnapshot & {
  inputMode: GameInputMode;
  newGame: (config: GameConfig, players: readonly PlayerDef[]) => Promise<void>;
  throwDart: (dart: Dart) => Promise<void>;
  switchInputMode: () => void;
  submitTurnTotal: (total: number) => Promise<void>;
  undo: () => Promise<void>;
  nextTurn: () => Promise<void>;
  resumeActiveGame: () => Promise<GameState | null>;
  finishGame: () => Promise<string | null>;
};

const DEFAULT_INPUT_MODE: GameInputMode = "dart-by-dart";
const NUMBER_SEGMENTS_DESC = [
  20, 19, 18, 17, 16, 15, 14, 13, 12, 11,
  10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
] as const satisfies readonly NumberSegment[];
const MISS_DART: Dart = { miss: true };

function numberDart(segment: NumberSegment, multiplier: Multiplier): Dart {
  return { segment, multiplier };
}

const TURN_TOTAL_DART_OPTIONS = [
  MISS_DART,
  ...NUMBER_SEGMENTS_DESC.map((segment) => numberDart(segment, 3)),
  { segment: 50, multiplier: 1 },
  ...NUMBER_SEGMENTS_DESC.map((segment) => numberDart(segment, 2)),
  { segment: 25, multiplier: 1 },
  ...NUMBER_SEGMENTS_DESC.map((segment) => numberDart(segment, 1)),
] as const satisfies readonly Dart[];

function emptySnapshot(): ActiveGameSnapshot {
  return {
    gameState: null,
    eventLog: [],
    mode: null,
    config: null,
  };
}

function snapshotFromState(gameState: GameState): ActiveGameSnapshot {
  return {
    gameState,
    eventLog: [...gameState.events],
    mode: gameState.mode,
    config: gameState.config,
  };
}

function cloneDart(dart: Dart): Dart {
  if ("miss" in dart) {
    return { miss: true };
  }

  if (dart.segment === 25) {
    return { segment: 25, multiplier: 1 };
  }

  if (dart.segment === 50) {
    return { segment: 50, multiplier: 1 };
  }

  return { segment: dart.segment, multiplier: dart.multiplier };
}

function isDoubleDart(dart: Dart): boolean {
  if ("miss" in dart) {
    return false;
  }

  return dart.segment === 50 || dart.multiplier === 2;
}

function routeStartsWithDouble(route: readonly Dart[]): boolean {
  const firstScoringDart = route.find((dart) => dartScore(dart) > 0);

  return firstScoringDart !== undefined && isDoubleDart(firstScoringDart);
}

function isX01StateWithConfig(
  state: GameState,
): state is GameState & { config: X01Config } {
  return state.mode === "x01" && state.config.mode === "x01";
}

function activeX01RemainingScore(state: GameState): number | null {
  const player = state.players.find((candidate) => candidate.id === state.activePlayerId);

  if (!player || player.modeState.mode !== "x01") {
    return null;
  }

  return player.modeState.remainingScore;
}

function routeScore(route: readonly Dart[]): number {
  return route.reduce((total, dart) => total + dartScore(dart), 0);
}

function cloneRoute(route: readonly Dart[]): Dart[] {
  return route.map(cloneDart);
}

function synthesizeTurnTotalDarts(state: GameState & { config: X01Config }, total: number): Dart[] | null {
  const remainingScore = activeX01RemainingScore(state);

  if (remainingScore === null) {
    return null;
  }

  if (total === remainingScore && (state.config.doubleOut || state.config.masterOut === true)) {
    const [checkoutRoute] = getCheckoutSuggestions(remainingScore);

    return checkoutRoute ? cloneRoute(checkoutRoute) : null;
  }

  const requiresOpeningDouble =
    state.config.doubleIn === true &&
    remainingScore === state.config.startingScore &&
    total > 0;

  for (const firstDart of TURN_TOTAL_DART_OPTIONS) {
    for (const secondDart of TURN_TOTAL_DART_OPTIONS) {
      for (const thirdDart of TURN_TOTAL_DART_OPTIONS) {
        const route = [firstDart, secondDart, thirdDart];

        if (routeScore(route) !== total) {
          continue;
        }

        if (requiresOpeningDouble && !routeStartsWithDouble(route)) {
          continue;
        }

        return cloneRoute(route);
      }
    }
  }

  return null;
}

function createStateForConfig(
  config: GameConfig,
  players: readonly PlayerDef[],
): GameState {
  switch (config.mode) {
    case "x01":
      return createX01State(config, players);
    case "cricket":
      return createCricketState(config, players);
    case "around-the-clock":
      return createAroundTheClockState(config, players);
    case "bobs-27":
      return createBobs27State(config, players);
    case "checkout-121":
      return createCheckout121State(config, players);
    case "shanghai":
      return createShanghaiState(config, players);
    case "training":
      return createTrainingState(config, players);
    case "killer":
      return createKillerState(config, players);
  }
}

function reduceForMode(state: GameState, event: GameEvent): GameState {
  switch (state.mode) {
    case "x01":
      return x01Reducer(state, event);
    case "cricket":
      return cricketReducer(state, event);
    case "around-the-clock":
      return aroundTheClockReducer(state, event);
    case "bobs-27":
      return bobs27Reducer(state, event);
    case "checkout-121":
      return checkout121Reducer(state, event);
    case "shanghai":
      return shanghaiReducer(state, event);
    case "training":
      return trainingReducer(state, event);
    case "killer":
      return killerReducer(state, event);
  }
}

function lastDartEventIndex(eventLog: readonly GameEvent[]): number {
  for (let index = eventLog.length - 1; index >= 0; index -= 1) {
    if (eventLog[index].type === "dart_thrown") {
      return index;
    }
  }

  return -1;
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
  return {
    ...createStateForConfig(state.config, playerDefsFromState(state)),
    id: state.id,
    createdAt: state.createdAt,
    updatedAt: state.createdAt,
  };
}

function replayEventsForMode(baseState: GameState, events: readonly GameEvent[]): GameState {
  return events.reduce((nextState, event) => reduceForMode(nextState, event), baseState);
}

function undoLastModeAwareDart(
  state: GameState,
  eventLog: readonly GameEvent[],
): UndoResult {
  const dartEventIndex = lastDartEventIndex(eventLog);

  if (dartEventIndex === -1) {
    return { state, eventLog: [...eventLog] };
  }

  const retainedEvents = eventLog.slice(0, dartEventIndex);

  return {
    state: replayEventsForMode(createReplayBase(state), retainedEvents),
    eventLog: retainedEvents,
  };
}

function undoForMode(state: GameState, eventLog: readonly GameEvent[]): UndoResult {
  switch (state.mode) {
    case "x01":
      return undoLastX01Dart(state, eventLog);
    case "cricket":
      return undoLastCricketDart(state, eventLog);
    case "around-the-clock":
    case "bobs-27":
    case "checkout-121":
    case "shanghai":
    case "training":
    case "killer":
      return undoLastModeAwareDart(state, eventLog);
  }
}

function occurredAtNow(): string {
  return new Date().toISOString();
}

function eventIdFor(
  state: GameState,
  eventType: GameEvent["type"],
  eventLog: readonly GameEvent[],
  occurredAt: string,
): string {
  const timestampKey = occurredAt.replace(/[^0-9A-Za-z]+/g, "");

  return `${state.id}:${eventType}:${eventLog.length}:${timestampKey}`;
}

function dartIndexFor(turnLength: number): DartIndex | null {
  if (turnLength === 0 || turnLength === 1 || turnLength === 2) {
    return turnLength;
  }

  return null;
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

function currentTurnScoreFromLog(
  eventLog: readonly GameEvent[],
  playerId: PlayerId,
): number {
  let score = 0;

  for (let index = eventLog.length - 1; index >= 0; index -= 1) {
    const event = eventLog[index];

    if (isTurnBoundaryEvent(event)) {
      break;
    }

    if (event.type === "dart_thrown" && event.playerId === playerId) {
      score += event.score ?? 0;
    }
  }

  return score;
}

function currentTurnFor(state: GameState): Turn {
  return state.currentTurn;
}

async function saveSnapshot(gameState: GameState): Promise<ActiveGameSnapshot> {
  const snapshot = snapshotFromState(gameState);

  await saveActiveGame(gameState, snapshot.eventLog);

  return snapshot;
}

export const useGameStore = create<GameStoreState>()((set, get) => ({
  ...emptySnapshot(),
  inputMode: DEFAULT_INPUT_MODE,

  async newGame(config, players) {
    const occurredAt = occurredAtNow();
    const createdState = createStateForConfig(config, players);
    const initialState: GameState = {
      ...createdState,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    const startEvent: GameEvent = {
      id: eventIdFor(initialState, "game_started", [], occurredAt),
      type: "game_started",
      occurredAt,
      config: initialState.config,
      playerOrder: initialState.playerOrder,
    };
    const nextState = reduceForMode(initialState, startEvent);
    const snapshot = await saveSnapshot(nextState);

    set({
      ...snapshot,
      inputMode: DEFAULT_INPUT_MODE,
    });
  },

  async throwDart(dart) {
    const { gameState, eventLog } = get();
    const playerId = gameState?.activePlayerId;

    if (!gameState || !playerId) {
      return;
    }

    const dartIndex = dartIndexFor(gameState.currentTurn.length);

    if (dartIndex === null) {
      return;
    }

    const occurredAt = occurredAtNow();
    const event: GameEvent = {
      id: eventIdFor(gameState, "dart_thrown", eventLog, occurredAt),
      type: "dart_thrown",
      occurredAt,
      playerId,
      dart,
      dartIndex,
    };
    const nextState = reduceForMode(gameState, event);

    if (nextState === gameState) {
      return;
    }

    set(await saveSnapshot(nextState));
  },

  switchInputMode() {
    set(({ inputMode }) => ({
      inputMode: inputMode === "dart-by-dart" ? "turn-total" : "dart-by-dart",
    }));
  },

  async submitTurnTotal(total) {
    const { gameState, eventLog } = get();
    const playerId = gameState?.activePlayerId;

    if (
      !gameState ||
      !playerId ||
      !Number.isInteger(total) ||
      total < 0 ||
      total > 180 ||
      gameState.currentTurn.length > 0 ||
      !isX01StateWithConfig(gameState)
    ) {
      return;
    }

    const synthesizedDarts = synthesizeTurnTotalDarts(gameState, total);

    if (!synthesizedDarts) {
      return;
    }

    const occurredAt = occurredAtNow();
    const event: GameEvent = {
      id: eventIdFor(gameState, "turn_total_submitted", eventLog, occurredAt),
      type: "turn_total_submitted",
      occurredAt,
      playerId,
      total,
      darts: synthesizedDarts,
    };
    let nextState = reduceForMode(gameState, event);
    let nextEventLog = [...nextState.events];

    if (nextState === gameState) {
      return;
    }

    for (const dart of synthesizedDarts) {
      const nextPlayerId = nextState.activePlayerId;
      const dartIndex = dartIndexFor(nextState.currentTurn.length);

      if (nextState.phase !== "playing" || !nextPlayerId || dartIndex === null) {
        break;
      }

      const dartOccurredAt = occurredAtNow();
      const dartEvent: GameEvent = {
        id: eventIdFor(nextState, "dart_thrown", nextEventLog, dartOccurredAt),
        type: "dart_thrown",
        occurredAt: dartOccurredAt,
        playerId: nextPlayerId,
        dart,
        dartIndex,
      };
      const stateAfterDart = reduceForMode(nextState, dartEvent);

      if (stateAfterDart === nextState) {
        break;
      }

      nextState = stateAfterDart;
      nextEventLog = [...nextState.events];
    }

    set(await saveSnapshot(nextState));
  },

  async undo() {
    const { gameState, eventLog } = get();

    if (!gameState) {
      return;
    }

    const undoResult = undoForMode(gameState, eventLog);
    const nextState: GameState = {
      ...undoResult.state,
      events: undoResult.eventLog,
    };
    const snapshot = await saveSnapshot(nextState);

    set(snapshot);
  },

  async nextTurn() {
    const { gameState, eventLog } = get();
    const playerId = gameState?.activePlayerId;

    if (!gameState || !playerId) {
      return;
    }

    const occurredAt = occurredAtNow();
    const event: GameEvent = {
      id: eventIdFor(gameState, "turn_complete", eventLog, occurredAt),
      type: "turn_complete",
      occurredAt,
      playerId,
      turn: currentTurnFor(gameState),
      score: currentTurnScoreFromLog(eventLog, playerId),
    };
    const nextState = reduceForMode(gameState, event);

    if (nextState === gameState) {
      return;
    }

    set(await saveSnapshot(nextState));
  },

  async resumeActiveGame() {
    const activeGame = await loadActiveGame();

    if (activeGame === null) {
      set({
        ...emptySnapshot(),
        inputMode: DEFAULT_INPUT_MODE,
      });

      return null;
    }

    const snapshot: ActiveGameSnapshot = {
      gameState: activeGame.gameState,
      eventLog: [...activeGame.eventLog],
      mode: activeGame.gameState.mode,
      config: activeGame.gameState.config,
    };

    set({
      ...snapshot,
      inputMode: DEFAULT_INPUT_MODE,
    });

    return activeGame.gameState;
  },

  async finishGame() {
    const { gameState, eventLog } = get();

    if (!gameState) {
      return null;
    }

    const savedGameId = await onGameComplete(gameState, eventLog);

    await clearActiveGame();
    set({
      ...emptySnapshot(),
      inputMode: DEFAULT_INPUT_MODE,
    });

    return savedGameId;
  },
}));
