import { basename, relative } from "node:path";

import type { NormalizedThread } from "../contracts";
import { extractTitleCandidate, normalizeCodexContentBlocks, normalizeCodexRecord } from "./blocks";
import { readCodexRecords } from "./fs";
import { encodeCodexProjectPath } from "./path-utils";
import type { CodexRecord, CodexTranscriptSummary, DiscoveredCodexSession } from "./types";

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function inferThreadIdFromFileName(fileName: string): string {
  return fileName.replace(/^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/, "").replace(/\.jsonl$/, "");
}

function getSpawnParentId(source: unknown): string | null {
  const sourceRecord = asRecord(source);
  const subagent = asRecord(sourceRecord?.subagent);
  const spawn = asRecord(subagent?.thread_spawn);
  return asString(spawn?.parent_thread_id);
}

export function summarizeRecords(records: CodexRecord[], path: string, codexHome: string): CodexTranscriptSummary {
  const fileName = basename(path);
  const relativePath = relative(codexHome, path);
  let threadId = inferThreadIdFromFileName(fileName);
  let sessionId = threadId;
  let agentId: string | null = null;
  let kind: "main" | "sidechain" = "main";
  let cwd: string | null = null;
  let gitBranch: string | null = null;
  let title: string | null = null;
  let startedAt: string | null = null;
  let latestTimestamp: string | null = null;
  let model: string | null = null;
  let cliVersion: string | null = null;

  for (const row of records) {
    const payload = asRecord(row.payload);

    if (!startedAt && typeof row.timestamp === "string") {
      startedAt = row.timestamp;
    }

    if (typeof row.timestamp === "string" && (!latestTimestamp || row.timestamp > latestTimestamp)) {
      latestTimestamp = row.timestamp;
    }

    if (!payload) {
      continue;
    }

    if (row.type === "session_meta") {
      threadId = asString(payload.id) ?? threadId;
      sessionId = threadId;
      cwd = cwd ?? asString(payload.cwd);
      cliVersion = cliVersion ?? asString(payload.cli_version);
      startedAt = asString(payload.timestamp) ?? startedAt;
      const parentId = getSpawnParentId(payload.source);

      if (parentId) {
        kind = "sidechain";
        sessionId = parentId;
        agentId = threadId;
      }

      const git = asRecord(payload.git);
      gitBranch = gitBranch ?? asString(git?.branch);
    }

    if (row.type === "turn_context") {
      cwd = cwd ?? asString(payload.cwd);
      model = model ?? asString(payload.model);
    }

    if (!title && row.type === "event_msg" && payload.type === "thread_name_updated") {
      title = asString(payload.thread_name);
    }

    if (!title && row.type === "event_msg" && payload.type === "user_message") {
      const message = asString(payload.message);
      if (message?.trim()) {
        title = message.trim().length > 120 ? `${message.trim().slice(0, 117)}...` : message.trim();
      }
    }

    if (!title && row.type === "response_item" && payload.type === "message" && payload.role === "user") {
      title = extractTitleCandidate(normalizeCodexContentBlocks(payload.content));
    }
  }

  return {
    path,
    projectKey: cwd ? encodeCodexProjectPath(cwd) : "codex",
    fileName,
    relativePath,
    kind,
    sessionId,
    threadId,
    agentId,
    cwd,
    gitBranch,
    title,
    startedAt,
    latestTimestamp,
    eventCount: records.length,
    model,
    cliVersion,
  };
}

export async function summarizeTranscriptFile(path: string, codexHome: string): Promise<CodexTranscriptSummary | null> {
  const records = await readCodexRecords(path);

  if (records.length === 0) {
    return null;
  }

  return summarizeRecords(records, path, codexHome);
}

export function sortSessions(sessions: DiscoveredCodexSession[]): DiscoveredCodexSession[] {
  return sessions.sort((left, right) => {
    const leftTimestamp = left.latestTimestamp ?? "";
    const rightTimestamp = right.latestTimestamp ?? "";

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp.localeCompare(leftTimestamp);
    }

    return (left.title ?? left.sessionId).localeCompare(right.title ?? right.sessionId);
  });
}

export function buildNormalizedThread(records: CodexRecord[], transcript: CodexTranscriptSummary): NormalizedThread {
  const normalizedEvents = records
    .map((record, index) => normalizeCodexRecord(record, index, transcript))
    .filter((event): event is NonNullable<typeof event> => event !== null);

  return {
    id: transcript.kind === "main" ? transcript.sessionId : `${transcript.sessionId}:${transcript.agentId ?? transcript.threadId}`,
    kind: transcript.kind,
    sessionId: transcript.sessionId,
    agentId: transcript.agentId,
    sourceFileName: transcript.fileName,
    sourceRelativePath: transcript.relativePath,
    cwd: transcript.cwd,
    gitBranch: transcript.gitBranch,
    startedAt: transcript.startedAt,
    rootEventIds: normalizedEvents.map((event) => event.id),
    events: normalizedEvents,
  };
}
