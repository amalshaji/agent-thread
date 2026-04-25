import { NextResponse } from "next/server";

import { getAgentThreadEnv } from "@/lib/cloudflare";
import { createPublicId, getPublicBaseUrl, insertUploadRow, putNormalizedSession, putRawFiles } from "@/lib/storage";
import { isUploadRequest } from "@/lib/validation";
import type { UploadResponse } from "@/src/shared/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isUploadRequest(body)) {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const env = getAgentThreadEnv();
  const uploadId = crypto.randomUUID();
  const publicId = createPublicId();
  const rawPrefix = await putRawFiles(env.SESSIONS_BUCKET, uploadId, body);
  const normalizedKey = await putNormalizedSession(env.SESSIONS_BUCKET, uploadId, body.normalized);
  const createdAt = new Date().toISOString();

  await insertUploadRow(env.DB, {
    id: uploadId,
    public_id: publicId,
    source: body.source,
    session_id: body.sessionId,
    project_key: body.projectKey,
    title: body.title,
    project_path: body.projectPath,
    raw_prefix: rawPrefix,
    normalized_key: normalizedKey,
    event_count: body.normalized.stats.eventCount,
    thread_count: body.normalized.stats.threadCount,
    created_at: createdAt,
  });

  const baseUrl = getPublicBaseUrl(request.url, env.PUBLIC_BASE_URL);
  const response: UploadResponse = {
    publicId,
    url: `${baseUrl}/t/${publicId}`,
  };

  return NextResponse.json(response, { status: 201 });
}
