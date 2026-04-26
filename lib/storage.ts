import type { NormalizedSession, RawUploadFile, SessionExportBundle, UploadRequest } from "@/src/shared/contracts";

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

function rawFileFromObject(key: string, rawPrefix: string, content: string, metadata?: Record<string, string>): RawUploadFile {
  const relativeObjectPath = key.slice(rawPrefix.length + 1);
  const fileName = relativeObjectPath.split("/").pop() ?? relativeObjectPath;

  return {
    threadId: metadata?.threadId ?? fileName.replace(/\.jsonl$/, ""),
    kind: metadata?.kind === "sidechain" ? "sidechain" : "main",
    fileName,
    relativePath: metadata?.relativePath ?? relativeObjectPath,
    content,
  };
}

export async function loadRawFiles(bucket: R2Bucket, rawPrefix: string): Promise<RawUploadFile[]> {
  const rawFiles: RawUploadFile[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ prefix: `${rawPrefix}/`, cursor });

    for (const listed of page.objects) {
      const object = await bucket.get(listed.key);

      if (!object) {
        continue;
      }

      rawFiles.push(rawFileFromObject(listed.key, rawPrefix, await object.text(), object.customMetadata ?? listed.customMetadata));
    }

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return rawFiles.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "main" ? -1 : 1;
    }

    return left.relativePath.localeCompare(right.relativePath);
  });
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

export async function loadSessionExportByPublicId(
  env: { DB: D1Database; SESSIONS_BUCKET: R2Bucket },
  publicId: string,
): Promise<SessionExportBundle | null> {
  const result = await loadSessionByPublicId(env, publicId);

  if (!result) {
    return null;
  }

  return {
    schemaVersion: 1,
    publicId,
    source: result.session.source,
    normalized: result.session,
    rawFiles: await loadRawFiles(env.SESSIONS_BUCKET, result.upload.raw_prefix),
  };
}
