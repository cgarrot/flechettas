import { NextResponse } from "next/server";

export const DEFAULT_JSON_BODY_LIMIT_BYTES = 256 * 1024;

export class HttpResponseError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpResponseError";
    this.status = status;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contentLengthFor(request: Request): number | null {
  const value = request.headers.get("content-length");

  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function concatBytes(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const bytes = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

async function readRequestTextWithLimit(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = contentLengthFor(request);

  if (declaredLength !== null && declaredLength > maxBytes) {
    throw new HttpResponseError(413, "Request body is too large.");
  }

  if (request.body === null) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalLength += value.byteLength;

    if (totalLength > maxBytes) {
      await reader.cancel();
      throw new HttpResponseError(413, "Request body is too large.");
    }

    chunks.push(value);
  }

  return new TextDecoder().decode(concatBytes(chunks, totalLength));
}

export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export async function readOptionalJsonObject(
  request: Request,
  maxBytes = DEFAULT_JSON_BODY_LIMIT_BYTES,
): Promise<Record<string, unknown> | null> {
  const text = await readRequestTextWithLimit(request, maxBytes);

  if (text.trim().length === 0) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

export function badRequest(message: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(error: unknown): NextResponse<{ error: string }> {
  if (error instanceof HttpResponseError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
