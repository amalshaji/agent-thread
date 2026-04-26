import type { UploadRequest } from "@/src/shared/contracts";

const VALID_UPLOAD_SOURCES = new Set(["claude-code", "codex"]);

export function isUploadRequest(value: unknown): value is UploadRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<UploadRequest>;
  const normalized =
    candidate.normalized && typeof candidate.normalized === "object"
      ? (candidate.normalized as Partial<UploadRequest["normalized"]>)
      : null;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.source === "string" &&
    VALID_UPLOAD_SOURCES.has(candidate.source) &&
    typeof candidate.sessionId === "string" &&
    Array.isArray(candidate.rawFiles) &&
    normalized !== null &&
    normalized.source === candidate.source
  );
}
