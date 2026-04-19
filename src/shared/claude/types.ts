export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ClaudeMessageBlock {
  type?: string;
  text?: string;
  thinking?: string;
  signature?: string;
  id?: string;
  name?: string;
  input?: unknown;
  caller?: unknown;
  tool_use_id?: string;
  content?: unknown;
}

export interface ClaudeEvent {
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  type?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  sessionId?: string;
  promptId?: string;
  requestId?: string;
  sourceToolAssistantUUID?: string;
  agentId?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  userType?: string;
  entrypoint?: string;
  subtype?: string;
  level?: string;
  toolUseResult?: unknown;
  messageId?: string;
  snapshot?: unknown;
  message?: {
    id?: string;
    type?: string;
    role?: "user" | "assistant";
    model?: string;
    content?: string | ClaudeMessageBlock[];
    stop_reason?: string | null;
    usage?: unknown;
  };
  content?: string;
}

export interface ClaudeTranscriptSummary {
  path: string;
  projectKey: string;
  fileName: string;
  relativePath: string;
  kind: "main" | "sidechain";
  sessionId: string;
  agentId: string | null;
  cwd: string | null;
  gitBranch: string | null;
  title: string | null;
  startedAt: string | null;
  latestTimestamp: string | null;
  eventCount: number;
}

export interface DiscoveredClaudeSession {
  sessionId: string;
  projectKey: string;
  projectPath: string | null;
  cwd: string | null;
  gitBranch: string | null;
  title: string | null;
  startedAt: string | null;
  latestTimestamp: string | null;
  eventCount: number;
  sidechainCount: number;
  mainThread: ClaudeTranscriptSummary | null;
  sidechains: ClaudeTranscriptSummary[];
  transcripts: ClaudeTranscriptSummary[];
}

export interface DiscoverClaudeSessionsOptions {
  cwd?: string;
  claudeHome?: string;
}
