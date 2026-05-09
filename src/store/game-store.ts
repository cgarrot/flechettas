"use client";

import { create } from "zustand";

import {
  clearActiveGame,
  clearSharedActiveGameCache,
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
  killerReducer,
  shanghaiReducer,
  trainingReducer,
  undoLastCricketDart,
  undoLastX01Dart,
  x01Reducer,
} from "@/engine";
import {
  fetchSharedActiveGame,
  saveSharedActiveGame,
  saveSharedCompletedGame,
} from "@/lib/shared-session-api";
import { onGameComplete } from "@/services/history-service";

import type {
  Dart,
  DartIndex,
  GameConfig,
  GameEvent,
  GameMode,
  GameState,
  PlayerDef,
  PlayerId,
  SharedActiveGame,
  SharedSessionPlayer,
  Turn,
} from "@/types";

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
  sharedSessionCode: string | null;
  sharedSessionPlayerId: PlayerId | null;
  sharedSessionDeviceId: string | null;
  sharedSessionPlayers: SharedSessionPlayer[];
  sharedRevision: number;
  sharedSyncError: string | null;
  newGame: (config: GameConfig, players: readonly PlayerDef[]) => Promise<void>;
  throwDart: (dart: Dart) => Promise<void>;
  replaceCurrentTurnDart: (dartIndex: DartIndex, dart: Dart) => Promise<void>;
  undo: () => Promise<void>;
  nextTurn: () => Promise<void>;
  continueAfterWinner: () => Promise<void>;
  resumeActiveGame: (gameId?: string) => Promise<GameState | null>;
  resumeSharedActiveGame: () => Promise<GameState | null>;
  setSharedSessionContext: (context: {
    code: string | null;
    playerId: PlayerId | null;
    deviceId: string | null;
    players: SharedSessionPlayer[];
  }) => void;
  hydrateSharedActiveGame: (activeGame: SharedActiveGame | null) => Promise<GameState | null>;
  refreshSharedActiveGame: () => Promise<GameState | null>;
  finishGame: () => Promise<string | null>;
};

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

function snapshotWithEventLog(gameState: GameState, eventLog: readonly GameEvent[]): ActiveGameSnapshot {
  return {
    gameState: { ...gameState, events: eventLog },
    eventLog: [...eventLog],
    mode: gameState.mode,
    config: gameState.config,
  };
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

function currentTurnDartEventIndex(
  eventLog: readonly GameEvent[],
  playerId: PlayerId,
  dartIndex: DartIndex,
): number {
  let boundaryIndex = -1;

  for (let index = eventLog.length - 1; index >= 0; index -= 1) {
    if (isTurnBoundaryEvent(eventLog[index])) {
      boundaryIndex = index;
      break;
    }
  }

  const currentTurnDartIndexes: number[] = [];

  for (let index = boundaryIndex + 1; index < eventLog.length; index += 1) {
    const event = eventLog[index];

    if (event.type === "dart_thrown" && event.playerId === playerId) {
      currentTurnDartIndexes.push(index);
    }
  }

  return currentTurnDartIndexes[dartIndex] ?? -1;
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

function uniqueSegment(): string {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/[^0-9A-Za-z]+/g, "")
    .slice(0, 12);
}

function gameInstanceIdFor(baseGameId: string, occurredAt: string): string {
  const timestampSegment = occurredAt.replace(/[^0-9A-Za-z]+/g, "");

  return `${baseGameId}-${timestampSegment}-${uniqueSegment()}`;
}

async function saveSnapshot(
  gameState: GameState,
  options: Readonly<{ sharedSessionCode?: string }> = {},
): Promise<ActiveGameSnapshot> {
  const snapshot = snapshotFromState(gameState);

  await saveActiveGame(gameState, snapshot.eventLog, options.sharedSessionCode
    ? { source: "shared", sharedSessionCode: options.sharedSessionCode }
    : { source: "local" });

  return snapshot;
}

function completedAtFor(state: GameState, eventLog: readonly GameEvent[]): string {
  return state.result?.completedAt ?? eventLog[eventLog.length - 1]?.occurredAt ?? state.updatedAt;
}

function latestWinnerId(eventLog: readonly GameEvent[]): PlayerId | undefined {
  for (let index = eventLog.length - 1; index >= 0; index -= 1) {
    const event = eventLog[index];

    if (event.type === "match_won") {
      return event.playerId;
    }
  }

  return undefined;
}

function winnerIdsFromLog(eventLog: readonly GameEvent[]): Set<PlayerId> {
  const winnerIds = new Set<PlayerId>();

  for (const event of eventLog) {
    if (event.type === "match_won") {
      winnerIds.add(event.playerId);
    }
  }

  return winnerIds;
}

function nextContinuingPlayerId(state: GameState, eventLog: readonly GameEvent[]): PlayerId | undefined {
  const latestWinner = latestWinnerId(eventLog) ?? state.playerOrder[state.playerOrder.length - 1];
  const startIndex = Math.max(0, state.playerOrder.indexOf(latestWinner));
  const winnerIds = winnerIdsFromLog(eventLog);

  for (let offset = 1; offset <= state.playerOrder.length; offset += 1) {
    const candidateId = state.playerOrder[(startIndex + offset) % state.playerOrder.length];
    const candidate = state.players.find((player) => player.id === candidateId);

    if (!candidate || candidate.status === "eliminated" || winnerIds.has(candidate.id)) {
      continue;
    }

    return candidate.id;
  }

  return undefined;
}

function continueStateAfterWinner(state: GameState, eventLog: readonly GameEvent[]): GameState | null {
  if (state.phase !== "match-complete") {
    return null;
  }

  const nextPlayerId = nextContinuingPlayerId(state, eventLog);

  if (nextPlayerId === undefined) {
    return null;
  }

  const updatedAt = occurredAtNow();
  const continueEvent: GameEvent = {
    id: eventIdFor(state, "match_continued", eventLog, updatedAt),
    type: "match_continued",
    occurredAt: updatedAt,
    playerId: nextPlayerId,
  };
  const continuedState = reduceForMode(state, continueEvent);

  return continuedState === state ? null : continuedState;
}

function shouldRetrySharedSaveAfterConflict(
  localSnapshot: ActiveGameSnapshot,
  remoteActiveGame: SharedActiveGame,
): boolean {
  const localGameId = localSnapshot.gameState?.id;
  const remoteGameId = remoteActiveGame.snapshot.gameState?.id;

  return localGameId !== undefined &&
    localGameId === remoteGameId &&
    localSnapshot.eventLog.length > remoteActiveGame.snapshot.eventLog.length;
}

async function saveSharedSnapshotIfNeeded(
  storeState: GameStoreState,
  snapshot: ActiveGameSnapshot,
): Promise<{ snapshot: ActiveGameSnapshot; revision: number; conflict: boolean } | null> {
  if (!storeState.sharedSessionCode) {
    return null;
  }

  let result = await saveSharedActiveGame({
    code: storeState.sharedSessionCode,
    snapshot,
    expectedRevision: storeState.sharedRevision,
    updatedByPlayerId: storeState.sharedSessionPlayerId,
    updatedByDeviceId: storeState.sharedSessionDeviceId,
  });

  if (!result.ok && result.activeGame && shouldRetrySharedSaveAfterConflict(snapshot, result.activeGame)) {
    result = await saveSharedActiveGame({
      code: storeState.sharedSessionCode,
      snapshot,
      expectedRevision: result.revision,
      updatedByPlayerId: storeState.sharedSessionPlayerId,
      updatedByDeviceId: storeState.sharedSessionDeviceId,
    });
  }

  if (result.ok) {
    return {
      snapshot: result.activeGame.snapshot,
      revision: result.activeGame.revision,
      conflict: false,
    };
  }

  if (result.activeGame) {
    return {
      snapshot: result.activeGame.snapshot,
      revision: result.activeGame.revision,
      conflict: true,
    };
  }

  return {
    snapshot,
    revision: result.revision,
    conflict: true,
  };
}

async function saveSnapshotEverywhere(
  gameState: GameState,
  getState: () => GameStoreState,
): Promise<ActiveGameSnapshot & { sharedRevision?: number; sharedSyncError?: string | null }> {
  const storeState = getState();
  const localSnapshot = await saveSnapshot(gameState, { sharedSessionCode: storeState.sharedSessionCode ?? undefined });

  try {
    const sharedResult = await saveSharedSnapshotIfNeeded(storeState, localSnapshot);

    if (sharedResult === null) {
      return localSnapshot;
    }

    if (sharedResult.snapshot.gameState && storeState.sharedSessionCode) {
      await saveActiveGame(sharedResult.snapshot.gameState, sharedResult.snapshot.eventLog, {
        source: "shared",
        sharedSessionCode: storeState.sharedSessionCode,
      });
    }

    return {
      ...sharedResult.snapshot,
      sharedRevision: sharedResult.revision,
      sharedSyncError: sharedResult.conflict ? "revision_conflict" : null,
    };
  } catch (error) {
    console.error(error);

    return {
      ...localSnapshot,
      sharedSyncError: "save_failed",
    };
  }
}

export const useGameStore = create<GameStoreState>()((set, get) => ({
  ...emptySnapshot(),
  sharedSessionCode: null,
  sharedSessionPlayerId: null,
  sharedSessionDeviceId: null,
  sharedSessionPlayers: [],
  sharedRevision: 0,
  sharedSyncError: null,

  async newGame(config, players) {
    const occurredAt = occurredAtNow();
    const createdState = createStateForConfig(config, players);
    const initialState: GameState = {
      ...createdState,
      id: gameInstanceIdFor(createdState.id, occurredAt),
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
    const snapshot = await saveSnapshotEverywhere(nextState, get);

    set({
      ...snapshot,
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

    set(await saveSnapshotEverywhere(nextState, get));
  },

  async replaceCurrentTurnDart(dartIndex, dart) {
    const { gameState, eventLog } = get();
    const playerId = gameState?.activePlayerId;

    if (!gameState || !playerId || gameState.phase !== "playing" || dartIndex >= gameState.currentTurn.length) {
      return;
    }

    const eventIndex = currentTurnDartEventIndex(eventLog, playerId, dartIndex);

    if (eventIndex === -1) {
      return;
    }

    const retainedEvents = eventLog.slice(0, eventIndex);
    const replayedState = replayEventsForMode(createReplayBase(gameState), retainedEvents);
    const replacementIndex = dartIndexFor(replayedState.currentTurn.length);

    if (replacementIndex !== dartIndex) {
      return;
    }

    const occurredAt = occurredAtNow();
    const event: GameEvent = {
      id: eventIdFor(replayedState, "dart_thrown", retainedEvents, occurredAt),
      type: "dart_thrown",
      occurredAt,
      playerId,
      dart,
      dartIndex: replacementIndex,
    };
    const nextState = reduceForMode(replayedState, event);

    if (nextState === replayedState) {
      return;
    }

    set(await saveSnapshotEverywhere(nextState, get));
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
    const snapshot = await saveSnapshotEverywhere(nextState, get);

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

    set(await saveSnapshotEverywhere(nextState, get));
  },

  async continueAfterWinner() {
    const { gameState, eventLog } = get();

    if (!gameState) {
      return;
    }

    const nextState = continueStateAfterWinner(gameState, eventLog);

    if (nextState === null) {
      return;
    }

    set(await saveSnapshotEverywhere(nextState, get));
  },

  async resumeActiveGame(gameId) {
    const { sharedSessionCode } = get();

    if (sharedSessionCode && gameId === undefined) {
      return get().resumeSharedActiveGame();
    }

    const activeGame = await loadActiveGame(gameId);

    if (activeGame === null) {
      set({
        ...emptySnapshot(),
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
    });

    return activeGame.gameState;
  },

  async resumeSharedActiveGame() {
    const { sharedSessionCode } = get();

    if (!sharedSessionCode) {
      return null;
    }

    try {
      const activeGame = await fetchSharedActiveGame(sharedSessionCode);

      if (get().sharedSessionCode !== sharedSessionCode) {
        return get().gameState;
      }

      if (activeGame === null) {
        await clearSharedActiveGameCache(sharedSessionCode);

        if (get().sharedSessionCode !== sharedSessionCode) {
          return get().gameState;
        }

        set({
          ...emptySnapshot(),
          sharedRevision: 0,
          sharedSyncError: null,
        });

        return null;
      }

      return get().hydrateSharedActiveGame(activeGame);
    } catch (error) {
      console.error(error);
      set({ sharedSyncError: "poll_failed" });

      return null;
    }
  },

  setSharedSessionContext(context) {
    const currentState = get();
    const previousCode = currentState.sharedSessionCode;
    const isSessionSwitch = context.code !== previousCode;

    set({
      ...(isSessionSwitch ? emptySnapshot() : {}),
      sharedSessionCode: context.code,
      sharedSessionPlayerId: context.playerId,
      sharedSessionDeviceId: context.deviceId,
      sharedSessionPlayers: context.players,
      sharedRevision: context.code && context.code === previousCode ? currentState.sharedRevision : 0,
      sharedSyncError: null,
    });
  },

  async hydrateSharedActiveGame(activeGame) {
    if (activeGame === null) {
      const clearedSessionCode = get().sharedSessionCode;

      if (clearedSessionCode) {
        await clearSharedActiveGameCache(clearedSessionCode);
      }

      if (get().sharedSessionCode !== clearedSessionCode) {
        return get().gameState;
      }

      set({
        ...emptySnapshot(),
        sharedRevision: 0,
        sharedSyncError: null,
      });

      return null;
    }

    const activeGameSessionCode = activeGame.sessionCode;

    if (get().sharedSessionCode !== activeGameSessionCode) {
      return get().gameState;
    }

    const snapshot = activeGame.snapshot;

    if (snapshot.gameState) {
      await saveActiveGame(snapshot.gameState, snapshot.eventLog, {
        source: "shared",
        sharedSessionCode: activeGameSessionCode,
      });
    } else {
      await clearSharedActiveGameCache(activeGameSessionCode);
    }

    if (get().sharedSessionCode !== activeGameSessionCode) {
      return get().gameState;
    }

    set({
      ...snapshot,
      sharedRevision: activeGame.revision,
      sharedSyncError: null,
    });

    return snapshot.gameState;
  },

  async refreshSharedActiveGame() {
    const { sharedSessionCode, sharedRevision } = get();

    if (!sharedSessionCode) {
      return null;
    }

    try {
      const activeGame = await fetchSharedActiveGame(sharedSessionCode);

      if (get().sharedSessionCode !== sharedSessionCode) {
        return get().gameState;
      }

      if (activeGame === null) {
        await clearSharedActiveGameCache(sharedSessionCode);

        if (get().sharedSessionCode !== sharedSessionCode) {
          return get().gameState;
        }

        set({
          ...emptySnapshot(),
          sharedRevision: 0,
          sharedSyncError: null,
        });

        return null;
      }

      if (activeGame.revision <= sharedRevision) {
        return get().gameState;
      }

      return get().hydrateSharedActiveGame(activeGame);
    } catch (error) {
      console.error(error);
      set({ sharedSyncError: "poll_failed" });

      return get().gameState;
    }
  },

  async finishGame() {
    const { gameState, eventLog } = get();

    if (!gameState) {
      return null;
    }

    const savedGameId = await onGameComplete(gameState, eventLog, { clearActive: false });

    const { sharedRevision, sharedSessionCode, sharedSessionPlayerId, sharedSessionDeviceId } = get();

    if (sharedSessionCode) {
      const snapshot = snapshotWithEventLog(gameState, eventLog);
      const completedAt = completedAtFor(gameState, eventLog);
      const completedResult = await (async () => {
        try {
          return await saveSharedCompletedGame({
            code: sharedSessionCode,
            gameId: gameState.id,
            completedAt,
            snapshot,
            eventLog,
            idempotencyKey: `${gameState.id}:${completedAt}`,
            expectedRevision: sharedRevision,
            savedByPlayerId: sharedSessionPlayerId,
            savedByDeviceId: sharedSessionDeviceId,
          });
        } catch (error) {
          console.error(error);
          set({ sharedSyncError: "completed_save_failed" });
          throw error;
        }
      })();

      if (!completedResult.ok) {
        if (completedResult.activeGame) {
          await get().hydrateSharedActiveGame(completedResult.activeGame);
        } else {
          set({
            sharedRevision: completedResult.revision,
            sharedSyncError: "revision_conflict",
          });
        }

        throw new Error("Shared completed game save conflicted with the latest session state.");
      }
    }

    await clearActiveGame(gameState.id);
    set({
      ...emptySnapshot(),
      sharedRevision: sharedSessionCode ? 0 : get().sharedRevision,
    });

    return savedGameId;
  },
}));
