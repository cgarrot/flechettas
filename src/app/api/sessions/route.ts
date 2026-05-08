import { NextResponse } from "next/server";

import { assertRateLimit } from "@/server/rate-limit";
import { badRequest, readOptionalJsonObject, serverError } from "@/server/route-utils";
import { ensureSharedSession, isValidSessionCode, normalizeSessionCode } from "@/server/sqlite";

export const runtime = "nodejs";
const SESSION_CREATE_BODY_LIMIT_BYTES = 2 * 1024;

export async function POST(request: Request) {
  try {
    assertRateLimit(request, "sessions:create", { limit: 30, windowMs: 60_000 });

    const body = await readOptionalJsonObject(request, SESSION_CREATE_BODY_LIMIT_BYTES);

    if (body === null) {
      return badRequest("Expected a JSON object body.");
    }

    const codeValue = body.code;

    if (codeValue !== undefined && typeof codeValue !== "string") {
      return badRequest("Session code must be a string.");
    }

    const code = codeValue === undefined ? undefined : normalizeSessionCode(codeValue);

    if (code !== undefined && !isValidSessionCode(code)) {
      return badRequest("Invalid shared session code.");
    }

    const session = ensureSharedSession(code);

    return NextResponse.json({ session });
  } catch (error) {
    return serverError(error);
  }
}
