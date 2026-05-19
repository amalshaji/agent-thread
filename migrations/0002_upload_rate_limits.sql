CREATE TABLE IF NOT EXISTS upload_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS upload_rate_limits_reset_at_idx ON upload_rate_limits (reset_at);
