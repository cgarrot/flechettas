import type {
  Dart,
  DartThrownEvent,
  GameConfig,
  GameEvent,
  GameResult,
  GameState,
  KillerConfig,
  KillerPlayerModeState,
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

type LifeChange = {
  playerId: PlayerId;
  livesLost: number;
};

type KillerResolution = {
  assignedNumber?: NumberSegment;
  ownKillerHit: boolean;
  ownPenalty: boolean;
  lifeChanges: readonly LifeChange[];
  score: number;
};

function isKillerConfig(config: GameConfig): config is KillerConfig {
  return config.mode === "killer";
}

function isKillerModeState(modeState: PlayerModeState): modeState is KillerPlayerModeState {
  return modeState.mode === "killer";
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
    mode: "killer",
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

function hashPlayerId(playerId: PlayerId): number {
  let hash = 0;

  for (let index = 0; index < playerId.length; index += 1) {
    hash = (hash * 31 + playerId.charCodeAt(index)) % 9973;
  }

  return hash;
}

function deterministicRandomAssignments(players: readonly PlayerState[]): ReadonlyMap<PlayerId, NumberSegment> {
  const available = [...NUMBER_SEGMENTS];
  const assignments = new Map<PlayerId, NumberSegment>();

  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];
    const selectedIndex = (hashPlayerId(player.id) + index) % available.length;
    const assignedNumber = available.splice(selectedIndex, 1)[0];

    assignments.set(player.id, assignedNumber);
  }

  return assignments;
}

function sequentialAssignments(players: readonly PlayerState[]): ReadonlyMap<PlayerId, NumberSegment> {
  const assignments = new Map<PlayerId, NumberSegment>();

  for (let index = 0; index < players.length; index += 1) {
    assignments.set(players[index].id, NUMBER_SEGMENTS[index % NUMBER_SEGMENTS.length]);
  }

  return assignments;
}

function assignedNumbers(state: GameState, exceptPlayerId?: PlayerId): Set<NumberSegment> {
  const numbers = new Set<NumberSegment>();

  for (const player of state.players) {
    if (player.id === exceptPlayerId || !isKillerModeState(player.modeState)) {
      continue;
    }

    if (player.modeState.assignedNumber !== undefined) {
      numbers.add(player.modeState.assignedNumber);
    }
  }

  return numbers;
}

function canAssignNumber(
  state: GameState,
  playerId: PlayerId,
  assignedNumber: NumberSegment,
  config: KillerConfig,
): boolean {
  return config.allowSharedNumbers === true || !assignedNumbers(state, playerId).has(assignedNumber);
}

function withAssignments(
  state: GameState,
  assignments: ReadonlyMap<PlayerId, NumberSegment>,
  config: KillerConfig,
): GameState {
  const usedNumbers = new Set<NumberSegment>();

  return {
    ...state,
    players: state.players.map((player) => {
      const assignedNumber = assignments.get(player.id);

      if (!assignedNumber || !isKillerModeState(player.modeState)) {
        return player;
      }

      if (config.allowSharedNumbers !== true && usedNumbers.has(assignedNumber)) {
        return player;
      }

      usedNumbers.add(assignedNumber);

      return {
        ...player,
        modeState: {
          ...player.modeState,
          assignedNumber,
        },
      };
    }),
  };
}

function initialKillerAssignments(state: GameState, config: KillerConfig): GameState {
  if (config.assignment === "random") {
    return withAssignments(state, deterministicRandomAssignments(state.players), config);
  }

  if (config.assignment === "sequential") {
    return withAssignments(state, sequentialAssignments(state.players), config);
  }

  if (config.assignment !== "manual" || !config.assignments) {
    return state;
  }

  const assignments = new Map<PlayerId, NumberSegment>();

  for (const player of state.players) {
    const assignedNumber = config.assignments[player.id];

    if (isNumberSegment(assignedNumber)) {
      assignments.set(player.id, assignedNumber);
    }
  }

  return withAssignments(state, assignments, config);
}

function dartNumber(dart: Dart): NumberSegment | undefined {
  if ("miss" in dart || !isNumberSegment(dart.segment)) {
    return undefined;
  }

  return dart.segment;
}

function isOwnDouble(dart: Dart, modeState: KillerPlayerModeState): boolean {
  return (
    !("miss" in dart) &&
    modeState.assignedNumber !== undefined &&
    dart.segment === modeState.assignedNumber &&
    dart.multiplier === 2
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

function resolveKillerDart(
  state: GameState,
  player: PlayerState,
  dart: Dart,
  config: KillerConfig,
): KillerResolution {
  if (!isKillerModeState(player.modeState)) {
    return { ownKillerHit: false, ownPenalty: false, lifeChanges: [], score: 0 };
  }

  const numberHit = dartNumber(dart);
  const assignedNumber =
    config.assignment === "first-hit" &&
    player.modeState.assignedNumber === undefined &&
    numberHit !== undefined &&
    canAssignNumber(state, player.id, numberHit, config)
      ? numberHit
      : undefined;
  const activeModeState: KillerPlayerModeState = assignedNumber
    ? { ...player.modeState, assignedNumber }
    : player.modeState;
  const ownKillerHit = isOwnDouble(dart, activeModeState);
  const ownPenalty = player.modeState.isKiller && ownKillerHit;
  const lifeChanges: LifeChange[] = [];

  if (player.modeState.isKiller && !("miss" in dart)) {
    for (const opponent of state.players) {
      if (
        opponent.id !== player.id &&
        opponent.status !== "eliminated" &&
        isKillerModeState(opponent.modeState) &&
        opponent.modeState.assignedNumber === dart.segment
      ) {
        lifeChanges.push({ playerId: opponent.id, livesLost: dart.multiplier });
      }
    }
  }

  if (ownPenalty) {
    lifeChanges.push({ playerId: player.id, livesLost: 1 });
  }

  return {
    assignedNumber,
    ownKillerHit,
    ownPenalty,
    lifeChanges,
    score: lifeChanges
      .filter((change) => change.playerId !== player.id)
      .reduce((score, change) => score + change.livesLost, 0),
  };
}

function applyKillerResolution(
  state: GameState,
  playerId: PlayerId,
  resolution: KillerResolution,
  config: KillerConfig,
  deferPlayerElimination: boolean,
): GameState {
  const requiredHits = positiveIntegerOr(config.requiredHitsToBecomeKiller, 1);
  const lifeLossByPlayer = new Map<PlayerId, number>();

  for (const change of resolution.lifeChanges) {
    lifeLossByPlayer.set(change.playerId, (lifeLossByPlayer.get(change.playerId) ?? 0) + change.livesLost);
  }

  const eliminatedByDart = new Set<PlayerId>();
  const playersAfterLives = state.players.map((player) => {
    if (!isKillerModeState(player.modeState)) {
      return player;
    }

    const livesLost = lifeLossByPlayer.get(player.id) ?? 0;
    const previousLives = player.modeState.lives;
    const nextLives = Math.max(0, previousLives - livesLost);
    const killerHits =
      player.id === playerId && resolution.ownKillerHit && !player.modeState.isKiller
        ? player.modeState.killerHits + 1
        : player.modeState.killerHits;
    const becameKiller = player.modeState.isKiller || killerHits >= requiredHits;

    if (previousLives > 0 && nextLives === 0) {
      eliminatedByDart.add(player.id);
    }

    const shouldDeferElimination = deferPlayerElimination && player.id === playerId && nextLives === 0;

    return {
      ...player,
      status: nextLives === 0 && !shouldDeferElimination ? ("eliminated" as const) : player.status,
      modeState: {
        ...player.modeState,
        assignedNumber: player.id === playerId && resolution.assignedNumber !== undefined
          ? resolution.assignedNumber
          : player.modeState.assignedNumber,
        killerHits,
        isKiller: becameKiller,
        lives: nextLives,
      },
    };
  });
  const kills = Array.from(eliminatedByDart).filter((eliminatedId) => eliminatedId !== playerId).length;

  if (kills === 0) {
    return { ...state, players: playersAfterLives };
  }

  return {
    ...state,
    players: playersAfterLives.map((player) => {
      if (player.id !== playerId || !isKillerModeState(player.modeState)) {
        return player;
      }

      return {
        ...player,
        modeState: {
          ...player.modeState,
          kills: player.modeState.kills + kills,
        },
      };
    }),
  };
}

function withZeroLifePlayersEliminated(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (!isKillerModeState(player.modeState) || player.modeState.lives > 0) {
        return player;
      }

      return {
        ...player,
        status: "eliminated" as const,
        currentTurn: [],
      };
    }),
  };
}

function nextLivingPlayerAfter(state: GameState, playerId: PlayerId): PlayerId | undefined {
  const startIndex = state.playerOrder.indexOf(playerId);

  if (startIndex === -1) {
    return undefined;
  }

  for (let offset = 1; offset <= state.playerOrder.length; offset += 1) {
    const candidateId = state.playerOrder[(startIndex + offset) % state.playerOrder.length];
    const candidate = state.players.find((player) => player.id === candidateId);

    if (
      candidate &&
      candidate.status !== "eliminated" &&
      isKillerModeState(candidate.modeState) &&
      candidate.modeState.lives > 0
    ) {
      return candidateId;
    }
  }

  return undefined;
}

function continueAfterSelfElimination(state: GameState, playerId: PlayerId): GameState {
  const nextPlayerId = nextLivingPlayerAfter(state, playerId);

  return {
    ...state,
    activePlayerId: nextPlayerId,
    players: state.players.map((player) => {
      if (player.id === nextPlayerId) {
        return { ...player, status: "active" as const };
      }

      return player;
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

function remainingPlayers(state: GameState): readonly PlayerState[] {
  return state.players.filter((player) => {
    if (player.status === "eliminated") {
      return false;
    }

    return !isKillerModeState(player.modeState) || player.modeState.lives > 0;
  });
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

function winningPlayer(state: GameState): PlayerState | undefined {
  const playersStillAlive = remainingPlayers(state);

  return state.players.length > 1 && playersStillAlive.length === 1 ? playersStillAlive[0] : undefined;
}

function applyDartThrown(
  state: GameState,
  event: DartThrownEvent,
  config: KillerConfig,
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

  if (!player || player.status !== "active" || !isKillerModeState(player.modeState)) {
    return state;
  }

  const resolution = resolveKillerDart(state, player, event.dart, config);
  const scoredEvent: DartThrownEvent = {
    ...event,
    score: resolution.score,
  };
  const stateWithDart = processEvent(state, scoredEvent);

  if (stateWithDart === state) {
    return state;
  }

  const stateWithResolution = applyKillerResolution(
    stateWithDart,
    event.playerId,
    resolution,
    config,
    true,
  );
  const turnScore = currentTurnScore(state, event.playerId) + resolution.score;
  const winner = winningPlayer(stateWithResolution);

  if (winner) {
    return completeGame(withZeroLifePlayersEliminated(completeTurn(stateWithResolution, event, turnScore)), winner, event);
  }

  const currentPlayerAfterResolution = getPlayer(stateWithResolution, event.playerId);

  if (
    currentPlayerAfterResolution &&
    isKillerModeState(currentPlayerAfterResolution.modeState) &&
    currentPlayerAfterResolution.modeState.lives === 0
  ) {
    return continueAfterSelfElimination(
      withZeroLifePlayersEliminated(completeTurn(stateWithResolution, event, turnScore)),
      event.playerId,
    );
  }

  if (stateWithResolution.currentTurn.length === 3) {
    return completeTurn(stateWithResolution, event, turnScore);
  }

  return stateWithResolution;
}

export function createKillerState(
  config: KillerConfig,
  players: readonly PlayerDef[] = config.players,
): GameState {
  return initialKillerAssignments(createGameState(config, players), config);
}

export function killerReducer(state: GameState, event: GameEvent): GameState {
  if (state.mode !== "killer" || !isKillerConfig(state.config)) {
    return state;
  }

  if (event.type !== "dart_thrown") {
    return processEvent(state, event);
  }

  return applyDartThrown(state, event, state.config);
}
