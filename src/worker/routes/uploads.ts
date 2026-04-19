import type { UploadResponse } from "../../shared/contracts";
import { createPublicId, getPublicBaseUrl, insertUploadRow, putNormalizedSession, putRawFiles } from "../storage";
import type { WorkerApp } from "../types";
import { isUploadRequest } from "../validation";

export function registerUploadRoutes(app: WorkerApp): void {
  app.post("/api/uploads", async (c) => {
    const body = await c.req.json().catch(() => null);

    if (!isUploadRequest(body)) {
      return c.json({ error: "Invalid upload payload." }, 400);
    }

    const uploadId = crypto.randomUUID();
    const publicId = createPublicId();
    const rawPrefix = await putRawFiles(c.env.SESSIONS_BUCKET, uploadId, body);
    const normalizedKey = await putNormalizedSession(c.env.SESSIONS_BUCKET, uploadId, body.normalized);
    const createdAt = new Date().toISOString();

    await insertUploadRow(c.env.DB, {
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

    const baseUrl = getPublicBaseUrl(c.req.url, c.env.PUBLIC_BASE_URL);
    const response: UploadResponse = {
      publicId,
      url: `${baseUrl}/t/${publicId}`,
    };

    return c.json(response, 201);
  });
}
