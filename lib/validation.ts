import type { UploadRequest } from "@/src/shared/contracts";

export function isUploadRequest(value: unknown): value is UploadRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<UploadRequest>;
  return (
    candidate.schemaVersion === 1 &&
    candidate.source === "claude-code" &&
    typeof candidate.sessionId === "string" &&
    Array.isArray(candidate.rawFiles) &&
    candidate.normalized !== undefined
  );
}
