import { NextResponse } from "next/server";

import { assertRateLimit } from "@/server/rate-limit";
import { isValidSessionCode, normalizeSessionCode, saveSharedCompletedGame } from "@/server/sqlite";
import { badRequest, HttpResponseError, isRecord, jsonByteLength, readOptionalJsonObject, serverError } from "@/server/route-utils";

import type { GameEvent, PlayerId, SharedActiveGameSnapshot } from "@/types";

export const runtime = "nodejs";
const COMPLETED_GAME_BODY_LIMIT_BYTES = 1024 * 1024;
const COMPLETED_GAME_PAYLOAD_LIMIT_BYTES = 768 * 1024;
const MAX_GAME_ID_LENGTH = 512;
const MAX_IDEMPOTENCY_KEY_LENGTH = 640;
const MAX_TIMESTAMP_LENGTH = 80;
const MAX_ACTOR_ID_LENGTH = 160;

type RouteContext = {
  params: Promise<{ code: string }>;
};

function isSnapshot(value: unknown): value is SharedActiveGameSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (value.gameState === null || isRecord(value.gameState)) &&
    Array.isArray(value.eventLog) &&
    (value.mode === null || typeof value.mode === "string") &&
    (value.config === null || isRecord(value.config));
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return typeof value === "string" ? value : undefined;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = normalizeSessionCode(rawCode);

    if (!isValidSessionCode(code)) {
      return badRequest("Invalid shared session code.");
    }

    assertRateLimit(request, "sessions:completed-games", { limit: 60, windowMs: 60_000, discriminator: code });

    const body = await readOptionalJsonObject(request, COMPLETED_GAME_BODY_LIMIT_BYTES);

    if (body === null) {
      return badRequest("Expected a JSON object body.");
    }

    if (typeof body.gameId !== "string" || body.gameId.length === 0) {
      return badRequest("gameId is required.");
    }

    if (body.gameId.length > MAX_GAME_ID_LENGTH) {
      return badRequest("gameId is too long.");
    }

    if (typeof body.completedAt !== "string" || body.completedAt.length === 0) {
      return badRequest("completedAt is required.");
    }

    if (body.completedAt.length > MAX_TIMESTAMP_LENGTH) {
      return badRequest("completedAt is too long.");
    }

    if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length === 0) {
      return badRequest("idempotencyKey is required.");
    }

    if (body.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      return badRequest("idempotencyKey is too long.");
    }

    if (!isSnapshot(body.snapshot)) {
      return badRequest("Completed game snapshot is required.");
    }

    if (!Array.isArray(body.eventLog)) {
      return badRequest("eventLog is required.");
    }

    if (jsonByteLength({ snapshot: body.snapshot, eventLog: body.eventLog }) > COMPLETED_GAME_PAYLOAD_LIMIT_BYTES) {
      throw new HttpResponseError(413, "Completed game payload is too large.");
    }

    const expectedRevision = body.expectedRevision;

    if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return badRequest("expectedRevision is required.");
    }

    const savedByPlayerId = nullableString(body.savedByPlayerId);
    const savedByDeviceId = nullableString(body.savedByDeviceId);

    if (savedByPlayerId === undefined || savedByDeviceId === undefined) {
      return badRequest("Saved-by fields must be strings or null.");
    }

    if ((savedByPlayerId?.length ?? 0) > MAX_ACTOR_ID_LENGTH || (savedByDeviceId?.length ?? 0) > MAX_ACTOR_ID_LENGTH) {
      return badRequest("Saved-by fields are too long.");
    }

    const result = saveSharedCompletedGame({
      sessionCode: code,
      gameId: body.gameId,
      completedAt: body.completedAt,
      snapshot: body.snapshot,
      eventLog: body.eventLog as GameEvent[],
      idempotencyKey: body.idempotencyKey,
      expectedRevision,
      savedByPlayerId: savedByPlayerId as PlayerId | null,
      savedByDeviceId,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "revision_conflict",
          activeGame: result.latest,
          revision: result.revision,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ completedGame: result.completedGame });
  } catch (error) {
    return serverError(error);
  }
}
