export type UploadSource = "claude-code";

export type ContentBlock =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string; signature?: string }
  | { kind: "tool_use"; id: string; name: string; input: unknown; caller?: unknown }
  | { kind: "tool_result"; toolUseId?: string; content: unknown; status?: string }
  | { kind: "raw"; value: unknown };

export type NormalizedEventDisplayKind =
  | "message"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "system"
  | "snapshot"
  | "meta";

export interface NormalizedEvent {
  id: string;
  parentId: string | null;
  seq: number;
  timestamp: string | null;
  topLevelType: string;
  role: "user" | "assistant" | "system" | null;
  displayKind: NormalizedEventDisplayKind;
  blocks: ContentBlock[];
  textPreview: string | null;
  flags: {
    isMeta: boolean;
    isSidechain: boolean;
  };
  refs: {
    promptId?: string;
    requestId?: string;
    sourceToolAssistantUUID?: string;
  };
  meta: {
    cwd?: string;
    gitBranch?: string;
    version?: string;
    userType?: string;
    entrypoint?: string;
    subtype?: string;
    level?: string;
    model?: string;
    stopReason?: string | null;
    usage?: unknown;
    snapshot?: unknown;
  };
}

export interface NormalizedThread {
  id: string;
  kind: "main" | "sidechain";
  sessionId: string;
  agentId: string | null;
  sourceFileName: string;
  sourceRelativePath: string;
  cwd: string | null;
  gitBranch: string | null;
  startedAt: string | null;
  rootEventIds: string[];
  events: NormalizedEvent[];
}

export interface NormalizedSession {
  schemaVersion: 1;
  source: UploadSource;
  importedAt: string;
  root: {
    sessionId: string;
    projectKey: string;
    projectPath: string | null;
    title: string | null;
    cwd: string | null;
    gitBranch: string | null;
    startedAt: string | null;
  };
  threads: NormalizedThread[];
  stats: {
    threadCount: number;
    eventCount: number;
    messageCount: number;
    sidechainCount: number;
  };
}

export interface RawUploadFile {
  threadId: string;
  kind: "main" | "sidechain";
  fileName: string;
  relativePath: string;
  content: string;
}

export interface UploadRequest {
  schemaVersion: 1;
  source: UploadSource;
  sessionId: string;
  projectKey: string;
  projectPath: string | null;
  title: string | null;
  rawFiles: RawUploadFile[];
  normalized: NormalizedSession;
}

export interface UploadResponse {
  publicId: string;
  url: string;
}
