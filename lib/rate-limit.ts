export const UPLOAD_RATE_LIMIT = {
  maxRequests: 20,
  windowSeconds: 10 * 60,
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type RateLimitRow = {
  count: number;
  reset_at: number;
};

const textEncoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientAddress(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip") ?? forwardedFor ?? "unknown";
}

export async function getUploadRateLimitKey(request: Request): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(`upload:${getClientAddress(request)}`));
  return toHex(digest);
}

export async function checkUploadRateLimit(
  db: D1Database,
  key: string,
  now = Date.now(),
): Promise<RateLimitResult> {
  const row = await db
    .prepare("SELECT count, reset_at FROM upload_rate_limits WHERE key = ? LIMIT 1")
    .bind(key)
    .first<RateLimitRow>();

  if (row && row.reset_at > now && row.count >= UPLOAD_RATE_LIMIT.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((row.reset_at - now) / 1000)),
    };
  }

  const resetAt = now + UPLOAD_RATE_LIMIT.windowSeconds * 1000;
  if (!row || row.reset_at <= now) {
    await db
      .prepare(
        `
          INSERT INTO upload_rate_limits (key, count, reset_at)
          VALUES (?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at
        `,
      )
      .bind(key, resetAt)
      .run();
    return { allowed: true };
  }

  await db.prepare("UPDATE upload_rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return { allowed: true };
}
