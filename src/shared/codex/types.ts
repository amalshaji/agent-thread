export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface CodexRecord {
  timestamp?: string;
  type?: string;
  payload?: unknown;
}

export interface CodexTranscriptSummary {
  path: string;
  projectKey: string;
  fileName: string;
  relativePath: string;
  kind: "main" | "sidechain";
  sessionId: string;
  threadId: string;
  agentId: string | null;
  cwd: string | null;
  gitBranch: string | null;
  title: string | null;
  startedAt: string | null;
  latestTimestamp: string | null;
  eventCount: number;
  model: string | null;
  cliVersion: string | null;
}

export interface DiscoveredCodexSession {
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
  mainThread: CodexTranscriptSummary | null;
  sidechains: CodexTranscriptSummary[];
  transcripts: CodexTranscriptSummary[];
}

export interface DiscoverCodexSessionsOptions {
  cwd?: string;
  codexHome?: string;
}
