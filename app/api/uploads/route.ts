import { NextResponse } from "next/server";

import { getAgentThreadEnv } from "@/lib/cloudflare";
import { checkUploadRateLimit, getUploadRateLimitKey } from "@/lib/rate-limit";
import { createPublicId, getPublicBaseUrl, insertUploadRow, putNormalizedSession, putRawFiles } from "@/lib/storage";
import { MAX_UPLOAD_BODY_BYTES, validateUploadRequest } from "@/lib/validation";
import type { UploadResponse } from "@/src/shared/contracts";

export const dynamic = "force-dynamic";

const textDecoder = new TextDecoder();

function contentLengthExceedsLimit(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    return false;
  }

  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > MAX_UPLOAD_BODY_BYTES;
}

async function readUploadJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string; status: number }> {
  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, error: "Invalid upload payload.", status: 400 };
  }

  const chunks: Uint8Array[] = [];
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    bytesRead += value.byteLength;
    if (bytesRead > MAX_UPLOAD_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, error: "Upload payload is too large.", status: 413 };
    }

    chunks.push(value);
  }

  try {
    const bodyBytes = new Uint8Array(bytesRead);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const body = textDecoder.decode(bodyBytes);
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false, error: "Invalid upload payload.", status: 400 };
  }
}

export async function POST(request: Request) {
  if (contentLengthExceedsLimit(request)) {
    return NextResponse.json({ error: "Upload payload is too large." }, { status: 413 });
  }

  const env = getAgentThreadEnv();
  const rateLimit = await checkUploadRateLimit(env.DB, await getUploadRateLimitKey(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many upload attempts. Try again later." },
      {
        status: 429,
        headers: {
          "retry-after": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const body = await readUploadJson(request).catch(() => ({
    ok: false as const,
    error: "Invalid upload payload.",
    status: 400,
  }));

  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const validation = validateUploadRequest(body.value);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const uploadId = crypto.randomUUID();
  const publicId = createPublicId();
  const rawPrefix = await putRawFiles(env.SESSIONS_BUCKET, uploadId, validation.value);
  const normalizedKey = await putNormalizedSession(env.SESSIONS_BUCKET, uploadId, validation.value.normalized);
  const createdAt = new Date().toISOString();

  await insertUploadRow(env.DB, {
    id: uploadId,
    public_id: publicId,
    source: validation.value.source,
    session_id: validation.value.sessionId,
    project_key: validation.value.projectKey,
    title: validation.value.title,
    project_path: validation.value.projectPath,
    raw_prefix: rawPrefix,
    normalized_key: normalizedKey,
    event_count: validation.value.normalized.stats.eventCount,
    thread_count: validation.value.normalized.stats.threadCount,
    created_at: createdAt,
  });

  const baseUrl = getPublicBaseUrl(request.url, env.PUBLIC_BASE_URL);
  const response: UploadResponse = {
    publicId,
    url: `${baseUrl}/t/${publicId}`,
  };

  return NextResponse.json(response, { status: 201 });
}
