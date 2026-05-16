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

type RawUploadObject = {
  key: string;
  metadata?: Record<string, string>;
};

type RawUploadFileInfo = Omit<RawUploadFile, "content">;

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

function rawFileInfoFromObject(key: string, rawPrefix: string, metadata?: Record<string, string>): RawUploadFileInfo {
  const relativeObjectPath = key.slice(rawPrefix.length + 1);
  const fileName = relativeObjectPath.split("/").pop() ?? relativeObjectPath;

  return {
    threadId: metadata?.threadId ?? fileName.replace(/\.jsonl$/, ""),
    kind: metadata?.kind === "sidechain" ? "sidechain" : "main",
    fileName,
    relativePath: metadata?.relativePath ?? relativeObjectPath,
  };
}

function rawFileFromObject(key: string, rawPrefix: string, content: string, metadata?: Record<string, string>): RawUploadFile {
  return {
    ...rawFileInfoFromObject(key, rawPrefix, metadata),
    content,
  };
}

function compareRawFileInfo(left: RawUploadFileInfo, right: RawUploadFileInfo): number {
  if (left.kind !== right.kind) {
    return left.kind === "main" ? -1 : 1;
  }

  return left.relativePath.localeCompare(right.relativePath);
}

export async function listRawUploadObjects(bucket: R2Bucket, rawPrefix: string): Promise<RawUploadObject[]> {
  const objects: RawUploadObject[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ prefix: `${rawPrefix}/`, cursor });

    for (const listed of page.objects) {
      objects.push({ key: listed.key, metadata: listed.customMetadata });
    }

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return objects.sort((left, right) => {
    const leftInfo = rawFileInfoFromObject(left.key, rawPrefix, left.metadata);
    const rightInfo = rawFileInfoFromObject(right.key, rawPrefix, right.metadata);
    return compareRawFileInfo(leftInfo, rightInfo);
  });
}

export async function loadRawFiles(bucket: R2Bucket, rawPrefix: string): Promise<RawUploadFile[]> {
  const rawFiles: RawUploadFile[] = [];
  const objects = await listRawUploadObjects(bucket, rawPrefix);

  for (const listed of objects) {
    const object = await bucket.get(listed.key);

    if (!object) {
      continue;
    }

    rawFiles.push(rawFileFromObject(listed.key, rawPrefix, await object.text(), object.customMetadata ?? listed.metadata));
  }

  return rawFiles.sort(compareRawFileInfo);
}

function enqueueText(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, value: string): void {
  controller.enqueue(encoder.encode(value));
}

function escapeJsonStringContent(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

async function streamJsonStringContent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  object: R2ObjectBody,
): Promise<void> {
  if (!object.body) {
    enqueueText(controller, encoder, escapeJsonStringContent(await object.text()));
    return;
  }

  const reader = object.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    enqueueText(controller, encoder, escapeJsonStringContent(decoder.decode(value, { stream: true })));
  }

  const tail = decoder.decode();
  if (tail) {
    enqueueText(controller, encoder, escapeJsonStringContent(tail));
  }
}

function rawFileInfoJson(file: RawUploadFileInfo): string {
  return [
    `{"threadId":${JSON.stringify(file.threadId)}`,
    `"kind":${JSON.stringify(file.kind)}`,
    `"fileName":${JSON.stringify(file.fileName)}`,
    `"relativePath":${JSON.stringify(file.relativePath)}`,
    `"content":"`,
  ].join(",");
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

export async function createSessionExportResponse(
  env: { DB: D1Database; SESSIONS_BUCKET: R2Bucket },
  publicId: string,
): Promise<Response | null> {
  const result = await loadSessionByPublicId(env, publicId);

  if (!result) {
    return null;
  }

  const rawObjects = await listRawUploadObjects(env.SESSIONS_BUCKET, result.upload.raw_prefix);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        enqueueText(
          controller,
          encoder,
          [
            `{"schemaVersion":1`,
            `"publicId":${JSON.stringify(publicId)}`,
            `"source":${JSON.stringify(result.session.source)}`,
            `"normalized":${JSON.stringify(result.session)}`,
            `"rawFiles":[`,
          ].join(","),
        );

        let written = 0;
        for (const listed of rawObjects) {
          const object = await env.SESSIONS_BUCKET.get(listed.key);

          if (!object) {
            continue;
          }

          const fileInfo = rawFileInfoFromObject(
            listed.key,
            result.upload.raw_prefix,
            object.customMetadata ?? listed.metadata,
          );

          if (written > 0) {
            enqueueText(controller, encoder, ",");
          }

          enqueueText(controller, encoder, rawFileInfoJson(fileInfo));
          await streamJsonStringContent(controller, encoder, object);
          enqueueText(controller, encoder, `"}`);
          written += 1;
        }

        enqueueText(controller, encoder, "]}");
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
