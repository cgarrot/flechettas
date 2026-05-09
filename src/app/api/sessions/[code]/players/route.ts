import { NextResponse } from "next/server";

import { assertRateLimit } from "@/server/rate-limit";
import { createSharedSessionPlayer, deleteSharedSessionPlayer, getSharedSession, isValidSessionCode, normalizeSessionCode } from "@/server/sqlite";
import { badRequest, notFound, readOptionalJsonObject, serverError } from "@/server/route-utils";

export const runtime = "nodejs";
const PLAYER_CREATE_BODY_LIMIT_BYTES = 4 * 1024;
const MAX_PLAYER_NAME_LENGTH = 64;
const MAX_PLAYER_ID_LENGTH = 160;

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = normalizeSessionCode(rawCode);

    if (!isValidSessionCode(code)) {
      return badRequest("Invalid shared session code.");
    }

    assertRateLimit(request, "sessions:players", { limit: 30, windowMs: 60_000, discriminator: code });

    const body = await readOptionalJsonObject(request, PLAYER_CREATE_BODY_LIMIT_BYTES);

    if (body === null) {
      return badRequest("Expected a JSON object body.");
    }

    const nameValue = body.name;

    if (typeof nameValue !== "string" || nameValue.trim().length === 0) {
      return badRequest("Player name is required.");
    }

    const playerName = nameValue.trim();

    if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
      return badRequest(`Player name must be ${MAX_PLAYER_NAME_LENGTH} characters or less.`);
    }

    const player = createSharedSessionPlayer(code, playerName);
    const session = getSharedSession(code);

    if (session === null) {
      return notFound("Shared session was not found.");
    }

    return NextResponse.json({ player, session });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = normalizeSessionCode(rawCode);

    if (!isValidSessionCode(code)) {
      return badRequest("Invalid shared session code.");
    }

    assertRateLimit(request, "sessions:players:delete", { limit: 30, windowMs: 60_000, discriminator: code });

    const body = await readOptionalJsonObject(request, PLAYER_CREATE_BODY_LIMIT_BYTES);

    if (body === null) {
      return badRequest("Expected a JSON object body.");
    }

    const playerIdValue = body.playerId;

    if (typeof playerIdValue !== "string" || playerIdValue.trim().length === 0) {
      return badRequest("Player id is required.");
    }

    const playerId = playerIdValue.trim();

    if (playerId.length > MAX_PLAYER_ID_LENGTH) {
      return badRequest(`Player id must be ${MAX_PLAYER_ID_LENGTH} characters or less.`);
    }

    const session = deleteSharedSessionPlayer(code, playerId);

    if (session === null) {
      return notFound("Shared session was not found.");
    }

    return NextResponse.json({ session });
  } catch (error) {
    return serverError(error);
  }
}
