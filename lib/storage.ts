import type { NormalizedSession, UploadRequest } from "@/src/shared/contracts";

export type UploadRow = {
  id: string;
  public_id: string;
  source: string;
  session_id: string;
  project_key: string;
  title: string | null;
  project_path: string | null;
  raw_prefix: string;
  normalized_key: string;
  event_count: number;
  thread_count: number;
  created_at: string;
};

export type SessionLookup =
  | {
      upload: UploadRow;
      session: NormalizedSession;
    }
  | null;

export function createPublicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

export function getPublicBaseUrl(requestUrl: string, explicitBaseUrl?: string): string {
  return explicitBaseUrl && explicitBaseUrl.length > 0 ? explicitBaseUrl : new URL(requestUrl).origin;
}

export async function putRawFiles(bucket: R2Bucket, uploadId: string, request: UploadRequest): Promise<string> {
  const rawPrefix = `raw/${request.source}/${uploadId}`;

  await Promise.all(
    request.rawFiles.map((file) =>
      bucket.put(`${rawPrefix}/${file.fileName}`, file.content, {
        httpMetadata: {
          contentType: "application/x-ndjson; charset=utf-8",
        },
        customMetadata: {
          threadId: file.threadId,
          kind: file.kind,
          relativePath: file.relativePath,
        },
      }),
    ),
  );

  return rawPrefix;
}

export async function putNormalizedSession(
  bucket: R2Bucket,
  uploadId: string,
  normalized: NormalizedSession,
): Promise<string> {
  const normalizedKey = `normalized/${uploadId}.json`;
  await bucket.put(normalizedKey, JSON.stringify(normalized), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
  });

  return normalizedKey;
}

export async function insertUploadRow(
  db: D1Database,
  row: Omit<UploadRow, "created_at"> & { created_at: string },
): Promise<void> {
  await db
    .prepare(
      `
        INSERT INTO uploads (
          id,
          public_id,
          source,
          session_id,
          project_key,
          title,
          project_path,
          raw_prefix,
          normalized_key,
          event_count,
          thread_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      row.id,
      row.public_id,
      row.source,
      row.session_id,
      row.project_key,
      row.title,
      row.project_path,
      row.raw_prefix,
      row.normalized_key,
      row.event_count,
      row.thread_count,
      row.created_at,
    )
    .run();
}

export async function findUploadByPublicId(db: D1Database, publicId: string): Promise<UploadRow | null> {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          public_id,
          source,
          session_id,
          project_key,
          title,
          project_path,
          raw_prefix,
          normalized_key,
          event_count,
          thread_count,
          created_at
        FROM uploads
        WHERE public_id = ?
        LIMIT 1
      `,
    )
    .bind(publicId)
    .first<UploadRow>();

  return result ?? null;
}

export async function loadNormalizedSession(bucket: R2Bucket, key: string): Promise<NormalizedSession | null> {
  const object = await bucket.get(key);

  if (!object) {
    return null;
  }

  return object.json<NormalizedSession>();
}

export async function loadSessionByPublicId(
  env: { DB: D1Database; SESSIONS_BUCKET: R2Bucket },
  publicId: string,
): Promise<SessionLookup> {
  const upload = await findUploadByPublicId(env.DB, publicId);

  if (!upload) {
    return null;
  }

  const session = await loadNormalizedSession(env.SESSIONS_BUCKET, upload.normalized_key);

  if (!session) {
    return null;
  }

  return { upload, session };
}
