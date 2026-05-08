import type {
  DartThrownEvent,
  GameConfig,
  GameEvent,
  GameResult,
  GameState,
  Multiplier,
  NumberSegment,
  PlayerDef,
  PlayerId,
  PlayerModeState,
  PlayerState,
  GameWinReason,
  ShanghaiConfig,
  ShanghaiPlayerModeState,
  Turn,
} from "@/types";

import { createGameState, processEvent } from "./core";
import { dartScore } from "./utils";
import { isNumberSegment, isValidDart } from "./validation";

const DEFAULT_ROUNDS = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly NumberSegment[];

function isShanghaiConfig(config: GameConfig): config is ShanghaiConfig {
  return config.mode === "shanghai";
}

function isShanghaiModeState(modeState: PlayerModeState): modeState is ShanghaiPlayerModeState {
  return modeState.mode === "shanghai";
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
    mode: "shanghai",
    completedAt,
    finalPlayers: state.players,
    legsWonByPlayer: scoreMapFor(state.players, (player) => player.legsWon),
    setsWonByPlayer: scoreMapFor(state.players, (player) => player.setsWon),
  };
}

function shanghaiRounds(config: ShanghaiConfig): NumberSegment[] {
  const configuredRounds = config.rounds ?? DEFAULT_ROUNDS;
  const rounds: NumberSegment[] = [];

  for (const round of configuredRounds) {
    if (isNumberSegment(round) && !rounds.includes(round)) {
      rounds.push(round);
    }
  }

  return rounds.length > 0 ? rounds : [...DEFAULT_ROUNDS];
}

function nextRoundAfter(config: ShanghaiConfig, round: NumberSegment): NumberSegment | undefined {
  const rounds = shanghaiRounds(config);
  const index = rounds.indexOf(round);

  return index === -1 ? rounds[0] : rounds[index + 1];
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

function currentTurnMultipliers(
  state: GameState,
  playerId: PlayerId,
  round: NumberSegment,
): Set<Multiplier> {
  const multipliers = new Set<Multiplier>();

  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index];

    if (isTurnBoundaryEvent(event)) {
      break;
    }

    if (
      event.type === "dart_thrown" &&
      event.playerId === playerId &&
      !("miss" in event.dart) &&
      event.dart.segment === round
    ) {
      multipliers.add(event.dart.multiplier);
    }
  }

  return multipliers;
}

function isShanghaiHit(event: DartThrownEvent, round: NumberSegment): boolean {
  return !("miss" in event.dart) && event.dart.segment === round;
}

function updateShanghaiModeState(
  state: GameState,
  playerId: PlayerId,
  update: (modeState: ShanghaiPlayerModeState) => ShanghaiPlayerModeState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id !== playerId || !isShanghaiModeState(player.modeState)) {
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

function shanghaiScore(player: PlayerState): number {
  return isShanghaiModeState(player.modeState) ? player.modeState.score : Number.NEGATIVE_INFINITY;
}

function winnerByScore(state: GameState): PlayerState | undefined {
  return state.players.reduce<PlayerState | undefined>((winner, player) => {
    if (!winner) {
      return player;
    }

    return shanghaiScore(player) > shanghaiScore(winner) ? player : winner;
  }, undefined);
}

function completedAllRounds(player: PlayerState, config: ShanghaiConfig): boolean {
  return (
    isShanghaiModeState(player.modeState) &&
    player.modeState.completedRounds.length >= shanghaiRounds(config).length
  );
}

function allPlayersDone(state: GameState, config: ShanghaiConfig): boolean {
  return state.players.every((player) => completedAllRounds(player, config));
}

function completeGame(
  state: GameState,
  winnerId: PlayerId,
  parentEvent: DartThrownEvent,
  finishingTurn?: Turn,
  reason?: GameWinReason,
): GameState {
  const legWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "leg-won"),
    type: "leg_won",
    occurredAt: parentEvent.occurredAt,
    playerId: winnerId,
    leg: state.currentLeg,
    finishingTurn,
    reason,
  };
  const stateAfterLeg = processEvent(state, legWonEvent);
  const result = createMatchResult(stateAfterLeg, winnerId, parentEvent.occurredAt);
  const matchWonEvent: GameEvent = {
    id: generatedEventId(parentEvent, "match-won"),
    type: "match_won",
    occurredAt: parentEvent.occurredAt,
    playerId: winnerId,
    result,
    reason,
  };

  return processEvent(stateAfterLeg, matchWonEvent);
}

function applyCompletedRound(
  state: GameState,
  event: DartThrownEvent,
  config: ShanghaiConfig,
  modeState: ShanghaiPlayerModeState,
  turnScore: number,
): GameState {
  const round = modeState.round;
  const nextRound = nextRoundAfter(config, round);
  const stateWithRound = updateShanghaiModeState(state, event.playerId, (currentModeState) => ({
    ...currentModeState,
    round: nextRound ?? round,
    hitsByMultiplier: {},
    completedRounds: [...currentModeState.completedRounds, round],
  }));
  const stateAfterTurn = completeTurn(stateWithRound, event, turnScore);

  if (!allPlayersDone(stateAfterTurn, config)) {
    return stateAfterTurn;
  }

  const winner = winnerByScore(stateAfterTurn);

  return winner ? completeGame(stateAfterTurn, winner.id, event) : stateAfterTurn;
}

function applyDartThrown(
  state: GameState,
  event: DartThrownEvent,
  config: ShanghaiConfig,
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

  if (!player || player.status !== "active" || !isShanghaiModeState(player.modeState)) {
    return state;
  }

  const hit = isShanghaiHit(event, player.modeState.round);
  const dartValue = hit ? dartScore(event.dart) : 0;
  const multipliers = currentTurnMultipliers(state, event.playerId, player.modeState.round);

  if (hit && !("miss" in event.dart)) {
    multipliers.add(event.dart.multiplier);
  }

  const achievedShanghai =
    config.instantShanghaiWin && multipliers.has(1) && multipliers.has(2) && multipliers.has(3);
  const scoredEvent: DartThrownEvent = {
    ...event,
    score: dartValue,
  };
  const stateWithDart = processEvent(state, scoredEvent);

  if (stateWithDart === state) {
    return state;
  }

  const stateWithScore = updateShanghaiModeState(
    stateWithDart,
    event.playerId,
    (modeState) => ({
      ...modeState,
      score: modeState.score + dartValue,
      hitsByMultiplier: hit && !("miss" in event.dart)
        ? {
            ...modeState.hitsByMultiplier,
            [event.dart.multiplier]: (modeState.hitsByMultiplier[event.dart.multiplier] ?? 0) + 1,
          }
        : modeState.hitsByMultiplier,
      achievedShanghai: modeState.achievedShanghai || achievedShanghai,
    }),
  );
  const turnScore = currentTurnScore(state, event.playerId) + dartValue;

  if (achievedShanghai) {
    const stateAfterTurn = completeTurn(stateWithScore, event, turnScore);

    return completeGame(stateAfterTurn, event.playerId, event, stateWithScore.currentTurn, "shanghai");
  }

  if (stateWithScore.currentTurn.length === 3) {
    return applyCompletedRound(stateWithScore, event, config, player.modeState, turnScore);
  }

  return stateWithScore;
}

export function getShanghaiRounds(config: ShanghaiConfig): NumberSegment[] {
  return shanghaiRounds(config);
}

export function createShanghaiState(
  config: ShanghaiConfig,
  players: readonly PlayerDef[] = config.players,
): GameState {
  return createGameState(config, players);
}

export function shanghaiReducer(state: GameState, event: GameEvent): GameState {
  if (state.mode !== "shanghai" || !isShanghaiConfig(state.config)) {
    return state;
  }

  if (event.type !== "dart_thrown") {
    return processEvent(state, event);
  }

  return applyDartThrown(state, event, state.config);
}
