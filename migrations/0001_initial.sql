CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  session_id TEXT NOT NULL,
  project_key TEXT NOT NULL,
  title TEXT,
  project_path TEXT,
  raw_prefix TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  thread_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS uploads_public_id_idx ON uploads (public_id);
CREATE INDEX IF NOT EXISTS uploads_session_id_idx ON uploads (session_id);
