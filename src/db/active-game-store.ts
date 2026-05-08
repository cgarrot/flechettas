import { ACTIVE_GAME_ID, getDb, type ActiveGameRecord } from "./schema";

import type { GameEvent, GameState } from "@/types";

export async function saveActiveGame(
  gameState: GameState,
  eventLog: readonly GameEvent[],
): Promise<void> {
  const record: ActiveGameRecord = {
    id: ACTIVE_GAME_ID,
    gameState,
    eventLog,
    updatedAt: new Date().toISOString(),
  };

  await getDb().activeGame.put(record);
}

export async function loadActiveGame(): Promise<{
  gameState: GameState;
  eventLog: readonly GameEvent[];
} | null> {
  const record = await getDb().activeGame.get(ACTIVE_GAME_ID);

  if (record === undefined) {
    return null;
  }

  return {
    gameState: record.gameState,
    eventLog: record.eventLog,
  };
}

export async function clearActiveGame(): Promise<void> {
  await getDb().activeGame.delete(ACTIVE_GAME_ID);
}
