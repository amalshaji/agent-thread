import type {
  ContentBlock,
  NormalizedEvent,
  NormalizedSession,
  NormalizedThread,
  RawUploadFile,
  UploadRequest,
  UploadSource,
} from "@/src/shared/contracts";

export const MAX_UPLOAD_BODY_BYTES = 25 * 1024 * 1024;
export const MAX_RAW_FILES = 128;
export const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_THREADS = 256;
export const MAX_EVENTS = 50_000;
export const MAX_BLOCKS_PER_EVENT = 64;
export const MAX_TEXT_BLOCK_BYTES = 1024 * 1024;

const VALID_UPLOAD_SOURCES = new Set<UploadSource>(["claude-code", "codex"]);
const VALID_THREAD_KINDS = new Set(["main", "sidechain"]);
const VALID_EVENT_ROLES = new Set(["user", "assistant", "system"]);
const VALID_DISPLAY_KINDS = new Set([
  "message",
  "thinking",
  "tool_use",
  "tool_result",
  "system",
  "snapshot",
  "meta",
]);

type ValidationResult =
  | { ok: true; value: UploadRequest }
  | { ok: false; error: string };

const textEncoder = new TextEncoder();

function byteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isNullableBoundedString(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function hasValidStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((entry) => typeof entry === "string" && entry.length > 0 && entry.length <= maxLength)
  );
}

function validateRawFile(value: unknown): value is RawUploadFile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBoundedString(value.threadId, 512) &&
    typeof value.kind === "string" &&
    VALID_THREAD_KINDS.has(value.kind) &&
    isBoundedString(value.fileName, 512) &&
    !value.fileName.includes("/") &&
    !value.fileName.includes("\\") &&
    isBoundedString(value.relativePath, 4096) &&
    typeof value.content === "string" &&
    byteLength(value.content) <= MAX_RAW_FILE_BYTES
  );
}

function validateContentBlock(value: unknown): value is ContentBlock {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  switch (value.kind) {
    case "text":
    case "thinking":
      return typeof value.text === "string" && byteLength(value.text) <= MAX_TEXT_BLOCK_BYTES;
    case "tool_use":
      return isBoundedString(value.id, 512) && isBoundedString(value.name, 256);
    case "tool_result":
      return value.toolUseId === undefined || isBoundedString(value.toolUseId, 512);
    case "raw":
      return "value" in value;
    default:
      return false;
  }
}

function validateEvent(value: unknown): value is NormalizedEvent {
  if (!isRecord(value) || !isRecord(value.flags) || !isRecord(value.refs) || !isRecord(value.meta)) {
    return false;
  }

  return (
    isBoundedString(value.id, 512) &&
    isNullableBoundedString(value.parentId, 512) &&
    isNonNegativeInteger(value.seq) &&
    isNullableBoundedString(value.timestamp, 128) &&
    isBoundedString(value.topLevelType, 256) &&
    (value.role === null || (typeof value.role === "string" && VALID_EVENT_ROLES.has(value.role))) &&
    typeof value.displayKind === "string" &&
    VALID_DISPLAY_KINDS.has(value.displayKind) &&
    Array.isArray(value.blocks) &&
    value.blocks.length <= MAX_BLOCKS_PER_EVENT &&
    value.blocks.every(validateContentBlock) &&
    isNullableBoundedString(value.textPreview, 1024) &&
    typeof value.flags.isMeta === "boolean" &&
    typeof value.flags.isSidechain === "boolean"
  );
}

function validateThread(value: unknown): value is NormalizedThread {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBoundedString(value.id, 512) &&
    typeof value.kind === "string" &&
    VALID_THREAD_KINDS.has(value.kind) &&
    isBoundedString(value.sessionId, 512) &&
    isNullableBoundedString(value.agentId, 512) &&
    isBoundedString(value.sourceFileName, 512) &&
    isBoundedString(value.sourceRelativePath, 4096) &&
    isNullableBoundedString(value.cwd, 4096) &&
    isNullableBoundedString(value.gitBranch, 512) &&
    isNullableBoundedString(value.startedAt, 128) &&
    hasValidStringArray(value.rootEventIds, MAX_EVENTS, 512) &&
    Array.isArray(value.events) &&
    value.events.every(validateEvent)
  );
}

function validateNormalizedSession(value: unknown, source: UploadSource, sessionId: string): value is NormalizedSession {
  if (!isRecord(value) || !isRecord(value.root) || !isRecord(value.stats)) {
    return false;
  }

  if (
    value.schemaVersion !== 1 ||
    value.source !== source ||
    !isBoundedString(value.importedAt, 128) ||
    !isBoundedString(value.root.sessionId, 512) ||
    value.root.sessionId !== sessionId ||
    !isBoundedString(value.root.projectKey, 1024) ||
    !isNullableBoundedString(value.root.projectPath, 4096) ||
    !isNullableBoundedString(value.root.title, 512) ||
    !isNullableBoundedString(value.root.cwd, 4096) ||
    !isNullableBoundedString(value.root.gitBranch, 512) ||
    !isNullableBoundedString(value.root.startedAt, 128) ||
    !Array.isArray(value.threads) ||
    value.threads.length > MAX_THREADS ||
    !value.threads.every(validateThread) ||
    !isNonNegativeInteger(value.stats.threadCount) ||
    !isNonNegativeInteger(value.stats.eventCount) ||
    !isNonNegativeInteger(value.stats.messageCount) ||
    !isNonNegativeInteger(value.stats.sidechainCount)
  ) {
    return false;
  }

  const eventCount = value.threads.reduce((total, thread) => total + thread.events.length, 0);
  const sidechainCount = value.threads.filter((thread) => thread.kind === "sidechain").length;

  return (
    eventCount <= MAX_EVENTS &&
    value.stats.threadCount === value.threads.length &&
    value.stats.eventCount === eventCount &&
    value.stats.messageCount <= eventCount &&
    value.stats.sidechainCount === sidechainCount
  );
}

export function validateUploadRequest(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Invalid upload payload." };
  }

  const source = value.source;
  if (typeof source !== "string" || !VALID_UPLOAD_SOURCES.has(source as UploadSource)) {
    return { ok: false, error: "Invalid upload source." };
  }

  if (
    value.schemaVersion !== 1 ||
    !isBoundedString(value.sessionId, 512) ||
    !isBoundedString(value.projectKey, 1024) ||
    !isNullableBoundedString(value.projectPath, 4096) ||
    !isNullableBoundedString(value.title, 512)
  ) {
    return { ok: false, error: "Invalid upload metadata." };
  }

  if (!Array.isArray(value.rawFiles) || value.rawFiles.length === 0 || value.rawFiles.length > MAX_RAW_FILES) {
    return { ok: false, error: `Upload must include 1-${MAX_RAW_FILES} raw transcript files.` };
  }

  if (!value.rawFiles.every(validateRawFile)) {
    return { ok: false, error: "Invalid raw transcript file payload." };
  }

  if (!validateNormalizedSession(value.normalized, source as UploadSource, value.sessionId)) {
    return { ok: false, error: "Invalid normalized transcript payload." };
  }

  return { ok: true, value: value as unknown as UploadRequest };
}

export function isUploadRequest(value: unknown): value is UploadRequest {
  return validateUploadRequest(value).ok;
}
