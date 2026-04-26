interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface R2ObjectBody {
  key?: string;
  customMetadata?: Record<string, string>;
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
}

interface R2ListedObject {
  key: string;
  customMetadata?: Record<string, string>;
}

interface R2ListOptions {
  cursor?: string;
  prefix?: string;
}

interface R2ListResult {
  objects: R2ListedObject[];
  truncated: boolean;
  cursor?: string;
}

interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
  };
  customMetadata?: Record<string, string>;
}

interface R2Bucket {
  put(
    key: string,
    value: string | Blob | ArrayBuffer | ArrayBufferView | ReadableStream | null,
    options?: R2PutOptions,
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  list(options?: R2ListOptions): Promise<R2ListResult>;
}

interface CloudflareEnv {
  DB: D1Database;
  SESSIONS_BUCKET: R2Bucket;
  PUBLIC_BASE_URL?: string;
  AGENT_THREAD_SERVER_URL?: string;
}
