import { NextResponse } from "next/server";

import { assertRateLimit } from "@/server/rate-limit";
import { ensureSharedSession, getSharedSession, isValidSessionCode, normalizeSessionCode } from "@/server/sqlite";
import { badRequest, notFound, serverError } from "@/server/route-utils";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = normalizeSessionCode(rawCode);

    if (!isValidSessionCode(code)) {
      return badRequest("Invalid shared session code.");
    }

    const session = getSharedSession(code);

    if (session === null) {
      return notFound("Shared session was not found.");
    }

    return NextResponse.json({ session });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { code: rawCode } = await context.params;
    const code = normalizeSessionCode(rawCode);

    if (!isValidSessionCode(code)) {
      return badRequest("Invalid shared session code.");
    }

    assertRateLimit(_request, "sessions:ensure", { limit: 60, windowMs: 60_000, discriminator: code });

    const session = ensureSharedSession(code);

    return NextResponse.json({ session });
  } catch (error) {
    return serverError(error);
  }
}
