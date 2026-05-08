import type {
  Dart,
  DartThrownEvent,
  GameConfig,
  GameEvent,
  GameState,
  NumberSegment,
  PlayerDef,
  PlayerId,
  PlayerModeState,
  PlayerState,
  Turn,
} from "@/types";

import { isNumberSegment, isValidDart, isValidTurn } from "./validation";

const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function firstNumberSegment(
  segments: readonly NumberSegment[] | undefined,
  fallback: NumberSegment,
): NumberSegment {
  return segments?.find(isNumberSegment) ?? fallback;
}

function firstBobs27Target(
  segments: readonly (NumberSegment | 25)[] | undefined,
  fallback: NumberSegment | 25,
): NumberSegment | 25 {
  return segments?.find((segment) => isNumberSegment(segment) || segment === 25) ?? fallback;
}

function createModeState(config: GameConfig): PlayerModeState {
  switch (config.mode) {
    case "x01":
      return {
        mode: "x01",
        startingScore: config.startingScore,
        remainingScore: config.startingScore,
        dartsThrownInLeg: 0,
        busts: 0,
        checkoutAttempts: 0,
        checkoutHits: 0,
      };
    case "cricket":
      return {
        mode: "cricket",
        marks: {},
        points: 0,
        closedTargets: [],
      };
    case "around-the-clock":
      return {
        mode: "around-the-clock",
        currentTarget: isNumberSegment(config.startSegment) ? config.startSegment : 1,
        completedTargets: [],
        hits: 0,
      };
    case "bobs-27":
      return {
        mode: "bobs-27",
        score: config.startingScore,
        currentDouble: firstBobs27Target(config.rounds, 1),
        completedRounds: [],
      };
    case "checkout-121":
      return {
        mode: "checkout-121",
        currentTargetScore: config.startingTarget,
        remainingTargetScore: config.startingTarget,
        dartsThrownAtCurrentTarget: 0,
        successfulTargets: [],
        failedTargets: [],
      };
    case "shanghai":
      return {
        mode: "shanghai",
        round: firstNumberSegment(config.rounds, 1),
        score: 0,
        hitsByMultiplier: {},
        achievedShanghai: false,
        completedRounds: [],
      };
    case "training":
      return {
        mode: "training",
        focus: config.focus,
        attempts: 0,
        hits: 0,
        score: 0,
        currentTargetHits: 0,
        targetHistory: [],
      };
    case "killer":
      return {
        mode: "killer",
        lives: config.startingLives,
        killerHits: 0,
        isKiller: false,
        kills: 0,
      };
  }
}

function withPlayers(config: GameConfig, players: readonly PlayerDef[]): GameConfig {
  switch (config.mode) {
    case "x01":
      return { ...config, players };
    case "cricket":
      return { ...config, players };
    case "around-the-clock":
      return { ...config, players };
    case "bobs-27":
      return { ...config, players };
    case "checkout-121":
      return { ...config, players };
    case "shanghai":
      return { ...config, players };
    case "training":
      return { ...config, players };
    case "killer":
      return { ...config, players };
  }
}

function createPlayerState(
  player: PlayerDef,
  config: GameConfig,
  activePlayerId: PlayerId,
): PlayerState {
  return {
    id: player.id,
    name: player.name,
    isBot: player.isBot,
    botLevel: player.botLevel,
    status: player.id === activePlayerId ? "active" : "waiting",
    legsWon: 0,
    setsWon: 0,
    turnsPlayed: 0,
    dartsThrown: 0,
    currentTurn: [],
    modeState: createModeState(config),
  };
}

function assertValidPlayers(players: readonly PlayerDef[]): void {
  if (players.length === 0) {
    throw new Error("Cannot create a game without at least one player.");
  }

  const playerIds = new Set<PlayerId>();

  for (const player of players) {
    if (player.id.length === 0) {
      throw new Error("Player id cannot be empty.");
    }

    if (playerIds.has(player.id)) {
      throw new Error(`Duplicate player id: ${player.id}`);
    }

    playerIds.add(player.id);
  }
}

function gameIdFor(mode: GameConfig["mode"], playerOrder: readonly PlayerId[]): string {
  const players = playerOrder
    .map((playerId) => playerId.replace(/[^a-zA-Z0-9_-]+/g, "-"))
    .join("-");

  return `game-${mode}-${players || "players"}`;
}

export function createGameState(
  config: GameConfig,
  players: readonly PlayerDef[] = config.players,
): GameState {
  assertValidPlayers(players);

  const normalizedConfig = withPlayers(config, players);
  const playerOrder = players.map((player) => player.id);
  const activePlayerId = normalizedConfig.startingPlayerId ?? playerOrder[0];

  if (!activePlayerId || !playerOrder.includes(activePlayerId)) {
    throw new Error(`Starting player does not exist: ${normalizedConfig.startingPlayerId ?? "<none>"}`);
  }

  return {
    id: gameIdFor(normalizedConfig.mode, playerOrder),
    mode: normalizedConfig.mode,
    config: normalizedConfig,
    phase: "playing",
    players: players.map((player) => createPlayerState(player, normalizedConfig, activePlayerId)),
    playerOrder,
    activePlayerId,
    currentLeg: 1,
    currentSet: 1,
    currentRound: 1,
    currentTurn: [],
    events: [],
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  };
}

function isEventMetadataValid(event: GameEvent): boolean {
  return event.id.length > 0 && event.type.length > 0 && event.occurredAt.length > 0;
}

function hasDuplicateEventId(state: GameState, event: GameEvent): boolean {
  return state.events.some((existingEvent) => existingEvent.id === event.id);
}

function playerExists(state: GameState, playerId: PlayerId): boolean {
  return state.players.some((player) => player.id === playerId);
}

function isActivePlayerEvent(state: GameState, playerId: PlayerId): boolean {
  return state.activePlayerId === playerId && playerExists(state, playerId);
}

function playerStatus(state: GameState, playerId: PlayerId): PlayerState["status"] | undefined {
  return state.players.find((player) => player.id === playerId)?.status;
}

function isNonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isDartIndex(value: number): value is 0 | 1 | 2 {
  return Number.isInteger(value) && value >= 0 && value <= 2;
}

function dartsEqual(left: Dart, right: Dart): boolean {
  if ("miss" in left || "miss" in right) {
    return "miss" in left && "miss" in right;
  }

  return left.segment === right.segment && left.multiplier === right.multiplier;
}

function turnsEqual(left: Turn, right: Turn): boolean {
  return left.length === right.length && left.every((dart, index) => dartsEqual(dart, right[index]));
}

function appendEvent(
  state: GameState,
  event: GameEvent,
  updates: Omit<Partial<GameState>, "events" | "updatedAt">,
): GameState {
  return {
    ...state,
    ...updates,
    events: [...state.events, event],
    updatedAt: event.occurredAt,
  };
}

function nextPlayerAfter(
  state: GameState,
  playerId: PlayerId,
): { playerId?: PlayerId; roundAdvanced: boolean } {
  const startIndex = state.playerOrder.indexOf(playerId);

  if (startIndex === -1) {
    return { roundAdvanced: false };
  }

  for (let offset = 1; offset <= state.playerOrder.length; offset += 1) {
    const candidateIndex = (startIndex + offset) % state.playerOrder.length;
    const candidateId = state.playerOrder[candidateIndex];
    const candidate = state.players.find((player) => player.id === candidateId);

    if (candidate && candidate.status !== "eliminated" && candidate.status !== "winner") {
      return {
        playerId: candidateId,
        roundAdvanced: candidateIndex <= startIndex,
      };
    }
  }

  return { roundAdvanced: false };
}

function applyDartThrown(state: GameState, event: DartThrownEvent): GameState {
  if (
    state.phase !== "playing" ||
    !isActivePlayerEvent(state, event.playerId) ||
    playerStatus(state, event.playerId) !== "active" ||
    !isDartIndex(event.dartIndex) ||
    event.dartIndex !== state.currentTurn.length ||
    state.currentTurn.length >= 3 ||
    !isValidDart(event.dart)
  ) {
    return state;
  }

  const currentTurn: Turn = [...state.currentTurn, event.dart];
  const players = state.players.map((player) => {
    if (player.id !== event.playerId) {
      return player;
    }

    return {
      ...player,
      status: "active" as const,
      dartsThrown: player.dartsThrown + 1,
      currentTurn,
    };
  });

  return appendEvent(state, event, { currentTurn, players });
}

function applyTurnComplete(state: GameState, event: GameEvent & { type: "turn_complete" }): GameState {
  const status = playerStatus(state, event.playerId);

  if (
    state.phase !== "playing" ||
    !isActivePlayerEvent(state, event.playerId) ||
    (status !== "active" && status !== "bust") ||
    !isValidTurn(event.turn) ||
    !turnsEqual(state.currentTurn, event.turn) ||
    !isNonNegativeNumber(event.score)
  ) {
    return state;
  }

  const nextPlayer = nextPlayerAfter(state, event.playerId);
  const players = state.players.map((player) => {
    if (player.id === event.playerId) {
      return {
        ...player,
        status: player.id === nextPlayer.playerId ? ("active" as const) : ("waiting" as const),
        turnsPlayed: player.turnsPlayed + 1,
        currentTurn: [],
      };
    }

    if (player.id === nextPlayer.playerId) {
      return {
        ...player,
        status: "active" as const,
      };
    }

    return player.status === "active" || player.status === "bust"
      ? { ...player, status: "waiting" as const }
      : player;
  });

  return appendEvent(state, event, {
    activePlayerId: nextPlayer.playerId,
    currentRound: nextPlayer.roundAdvanced ? state.currentRound + 1 : state.currentRound,
    currentTurn: [],
    players,
  });
}

function applyPlayerBust(state: GameState, event: GameEvent & { type: "player_bust" }): GameState {
  if (
    state.phase !== "playing" ||
    !isActivePlayerEvent(state, event.playerId) ||
    playerStatus(state, event.playerId) !== "active" ||
    !isNonNegativeNumber(event.scoreBeforeTurn) ||
    !isNonNegativeNumber(event.attemptedScore)
  ) {
    return state;
  }

  const players = state.players.map((player) =>
    player.id === event.playerId ? { ...player, status: "bust" as const } : player,
  );

  return appendEvent(state, event, { players });
}

function applyLegWon(state: GameState, event: GameEvent & { type: "leg_won" }): GameState {
  if (
    state.phase !== "playing" ||
    !playerExists(state, event.playerId) ||
    !isPositiveInteger(event.leg) ||
    (event.finishingTurn !== undefined && !isValidTurn(event.finishingTurn))
  ) {
    return state;
  }

  const players = state.players.map((player) => {
    if (player.id === event.playerId) {
      return {
        ...player,
        status: "winner" as const,
        legsWon: player.legsWon + 1,
        currentTurn: [],
      };
    }

    return {
      ...player,
      status: player.status === "eliminated" ? player.status : ("waiting" as const),
      currentTurn: [],
    };
  });

  return appendEvent(state, event, {
    activePlayerId: event.playerId,
    currentLeg: event.leg,
    currentTurn: [],
    phase: "leg-complete",
    players,
  });
}

function applySetWon(state: GameState, event: GameEvent & { type: "set_won" }): GameState {
  if (
    (state.phase !== "playing" && state.phase !== "leg-complete") ||
    !playerExists(state, event.playerId) ||
    !isPositiveInteger(event.set) ||
    !isNonNegativeNumber(event.legsWon)
  ) {
    return state;
  }

  const players = state.players.map((player) =>
    player.id === event.playerId
      ? { ...player, status: "winner" as const, setsWon: player.setsWon + 1 }
      : player,
  );

  return appendEvent(state, event, {
    activePlayerId: event.playerId,
    currentSet: event.set,
    phase: "set-complete",
    players,
  });
}

function applyMatchWon(state: GameState, event: GameEvent & { type: "match_won" }): GameState {
  if (
    state.phase === "match-complete" ||
    state.phase === "abandoned" ||
    !playerExists(state, event.playerId) ||
    event.result.mode !== state.mode ||
    (event.result.winnerId !== undefined && event.result.winnerId !== event.playerId) ||
    event.result.completedAt.length === 0
  ) {
    return state;
  }

  const players = state.players.map((player) => {
    if (player.id === event.playerId) {
      return { ...player, status: "winner" as const, currentTurn: [] };
    }

    return {
      ...player,
      status: player.status === "eliminated" ? player.status : ("waiting" as const),
      currentTurn: [],
    };
  });

  return appendEvent(state, event, {
    activePlayerId: undefined,
    currentTurn: [],
    phase: "match-complete",
    players,
    result: event.result,
  });
}

function applyRoundAdvanced(state: GameState, event: GameEvent & { type: "round_advanced" }): GameState {
  if (
    state.phase !== "playing" ||
    !isPositiveInteger(event.fromRound) ||
    !isPositiveInteger(event.toRound) ||
    event.fromRound !== state.currentRound ||
    event.toRound <= event.fromRound
  ) {
    return state;
  }

  return appendEvent(state, event, { currentRound: event.toRound });
}

function applyGameStarted(state: GameState, event: GameEvent & { type: "game_started" }): GameState {
  const sameOrder =
    event.playerOrder.length === state.playerOrder.length &&
    event.playerOrder.every((playerId, index) => playerId === state.playerOrder[index]);

  if (state.events.length > 0 || event.config.mode !== state.mode || !sameOrder) {
    return state;
  }

  return appendEvent(state, event, { phase: "playing" });
}

function applyTurnTotalSubmitted(
  state: GameState,
  event: GameEvent & { type: "turn_total_submitted" },
): GameState {
  if (
    state.phase !== "playing" ||
    !isActivePlayerEvent(state, event.playerId) ||
    !isNonNegativeNumber(event.total) ||
    (event.darts !== undefined && !isValidTurn(event.darts))
  ) {
    return state;
  }

  return appendEvent(state, event, {});
}

/**
 * Shared reducer boundary: this applies only generic event ordering and lifecycle changes.
 * Mode-specific scoring remains in future engines, so unsupported or invalid events return
 * the original state unchanged rather than mutating or guessing semantics.
 */
export function processEvent(state: GameState, event: GameEvent): GameState {
  if (!isEventMetadataValid(event) || hasDuplicateEventId(state, event)) {
    return state;
  }

  switch (event.type) {
    case "game_started":
      return applyGameStarted(state, event);
    case "dart_thrown":
      return applyDartThrown(state, event);
    case "turn_total_submitted":
      return applyTurnTotalSubmitted(state, event);
    case "turn_complete":
      return applyTurnComplete(state, event);
    case "player_bust":
      return applyPlayerBust(state, event);
    case "leg_won":
      return applyLegWon(state, event);
    case "set_won":
      return applySetWon(state, event);
    case "round_advanced":
      return applyRoundAdvanced(state, event);
    case "match_won":
      return applyMatchWon(state, event);
    case "undo":
      return state;
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

function replayEvents(baseState: GameState, events: readonly GameEvent[]): GameState {
  return events.reduce((nextState, event) => processEvent(nextState, event), baseState);
}

export function canUndo(eventLog: readonly GameEvent[]): boolean {
  return lastDartEventIndex(eventLog) !== -1;
}

export function undoLastDart(
  state: GameState,
  eventLog: readonly GameEvent[],
): { state: GameState; eventLog: GameEvent[] } {
  const dartEventIndex = lastDartEventIndex(eventLog);

  if (dartEventIndex === -1) {
    return { state, eventLog: [...eventLog] };
  }

  const retainedEvents = eventLog.slice(0, dartEventIndex);
  const replayBase = {
    ...createGameState(state.config, playerDefsFromState(state)),
    id: state.id,
    createdAt: state.createdAt,
    updatedAt: state.createdAt,
  };

  return {
    state: replayEvents(replayBase, retainedEvents),
    eventLog: retainedEvents,
  };
}
