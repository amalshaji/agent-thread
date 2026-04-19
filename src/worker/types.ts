import type { Hono } from "hono";

export type Bindings = {
  DB: D1Database;
  SESSIONS_BUCKET: R2Bucket;
  PUBLIC_BASE_URL?: string;
};

export type WorkerApp = Hono<{ Bindings: Bindings }>;

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
