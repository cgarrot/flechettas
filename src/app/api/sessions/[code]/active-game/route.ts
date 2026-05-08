import { NextResponse } from "next/server";

import { assertRateLimit } from "@/server/rate-limit";
import { getSharedActiveGame, isValidSessionCode, normalizeSessionCode, saveSharedActiveGame } from "@/server/sqlite";
import { badRequest, HttpResponseError, isRecord, jsonByteLength, readOptionalJsonObject, serverError } from "@/server/route-utils";

import type { PlayerId, SharedActiveGameSnapshot } from "@/types";

export const runtime = "nodejs";
const ACTIVE_GAME_BODY_LIMIT_BYTES = 512 * 1024;
const ACTIVE_GAME_SNAPSHOT_LIMIT_BYTES = 384 * 1024;
const MAX_ACTOR_ID_LENGTH = 160;

type RouteContext = {
  params: Promise<{ code: string }>;
};

function isSnapshot(value: unknown): value is SharedActiveGameSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const gameState = value.gameState;
  const eventLog = value.eventLog;
  const mode = value.mode;
  const config = value.config;

  return (gameState === null || isRecord(gameState)) &&
    Array.isArray(eventLog) &&
    (mode === null || typeof mode === "string") &&
    (config === null || isRecord(config));
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return typeof value === "string" ? value : undefined;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = normalizeSessionCode(rawCode);

    if (!isValidSessionCode(code)) {
      return badRequest("Invalid shared session code.");
    }

    return NextResponse.json({ activeGame: getSharedActiveGame(code) });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = normalizeSessionCode(rawCode);

    if (!isValidSessionCode(code)) {
      return badRequest("Invalid shared session code.");
    }

    assertRateLimit(request, "sessions:active-game", { limit: 180, windowMs: 60_000, discriminator: code });

    const body = await readOptionalJsonObject(request, ACTIVE_GAME_BODY_LIMIT_BYTES);

    if (body === null) {
      return badRequest("Expected a JSON object body.");
    }

    if (!isSnapshot(body.snapshot)) {
      return badRequest("Active game snapshot is required.");
    }

    if (jsonByteLength(body.snapshot) > ACTIVE_GAME_SNAPSHOT_LIMIT_BYTES) {
      throw new HttpResponseError(413, "Active game snapshot is too large.");
    }

    const expectedRevision = body.expectedRevision;

    if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return badRequest("expectedRevision is required.");
    }

    const updatedByPlayerId = nullableString(body.updatedByPlayerId);
    const updatedByDeviceId = nullableString(body.updatedByDeviceId);

    if (updatedByPlayerId === undefined || updatedByDeviceId === undefined) {
      return badRequest("Updated-by fields must be strings or null.");
    }

    if ((updatedByPlayerId?.length ?? 0) > MAX_ACTOR_ID_LENGTH || (updatedByDeviceId?.length ?? 0) > MAX_ACTOR_ID_LENGTH) {
      return badRequest("Updated-by fields are too long.");
    }

    const result = saveSharedActiveGame({
      sessionCode: code,
      snapshot: body.snapshot,
      expectedRevision,
      updatedByPlayerId: updatedByPlayerId as PlayerId | null,
      updatedByDeviceId,
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

    return NextResponse.json({ activeGame: result.activeGame });
  } catch (error) {
    return serverError(error);
  }
}
