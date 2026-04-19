import { basename, dirname, relative } from "node:path";

import type { NormalizedThread } from "../contracts";
import { extractTitleCandidate, normalizeClaudeEvent, normalizeContentBlocks } from "./blocks";
import { readClaudeEvents } from "./fs";
import type { ClaudeEvent, ClaudeTranscriptSummary, DiscoveredClaudeSession } from "./types";

export function summarizeEvents(events: ClaudeEvent[], path: string, projectsRoot: string): ClaudeTranscriptSummary {
  const fileName = basename(path);
  const projectKey = basename(dirname(path));
  const relativePath = relative(projectsRoot, path);
  const inferredKind = fileName.startsWith("agent-") ? "sidechain" : "main";
  let sessionId = basename(path, ".jsonl");
  let cwd: string | null = null;
  let gitBranch: string | null = null;
  let title: string | null = null;
  let startedAt: string | null = null;
  let latestTimestamp: string | null = null;
  let agentId: string | null = inferredKind === "sidechain" ? basename(path, ".jsonl").replace(/^agent-/, "") : null;
  let kind: "main" | "sidechain" = inferredKind;

  for (const event of events) {
    if (typeof event.sessionId === "string" && event.sessionId.length > 0) {
      sessionId = event.sessionId;
    }

    if (!cwd && typeof event.cwd === "string" && event.cwd.length > 0) {
      cwd = event.cwd;
    }

    if (!gitBranch && typeof event.gitBranch === "string" && event.gitBranch.length > 0) {
      gitBranch = event.gitBranch;
    }

    if (!startedAt && typeof event.timestamp === "string") {
      startedAt = event.timestamp;
    }

    if (typeof event.timestamp === "string" && (!latestTimestamp || event.timestamp > latestTimestamp)) {
      latestTimestamp = event.timestamp;
    }

    if (event.isSidechain === true) {
      kind = "sidechain";
    }

    if (!agentId && typeof event.agentId === "string" && event.agentId.length > 0) {
      agentId = event.agentId;
    }

    if (!title && event.type === "user" && event.isMeta !== true) {
      title = extractTitleCandidate(normalizeContentBlocks(event.message?.content));
    }
  }

  return {
    path,
    projectKey,
    fileName,
    relativePath,
    kind,
    sessionId,
    agentId,
    cwd,
    gitBranch,
    title,
    startedAt,
    latestTimestamp,
    eventCount: events.length,
  };
}

export async function summarizeTranscriptFile(path: string, projectsRoot: string): Promise<ClaudeTranscriptSummary> {
  return summarizeEvents(await readClaudeEvents(path), path, projectsRoot);
}

export function sortSessions(sessions: DiscoveredClaudeSession[]): DiscoveredClaudeSession[] {
  return sessions.sort((left, right) => {
    const leftTimestamp = left.latestTimestamp ?? "";
    const rightTimestamp = right.latestTimestamp ?? "";

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp.localeCompare(leftTimestamp);
    }

    return (left.title ?? left.sessionId).localeCompare(right.title ?? right.sessionId);
  });
}

export function buildNormalizedThread(events: ClaudeEvent[], transcript: ClaudeTranscriptSummary): NormalizedThread {
  const normalizedEvents = events.map((event, index) => normalizeClaudeEvent(event, index));
  const eventIds = new Set(normalizedEvents.map((event) => event.id));
  const rootEventIds = normalizedEvents
    .filter((event) => !event.parentId || !eventIds.has(event.parentId))
    .map((event) => event.id);

  return {
    id: transcript.kind === "main" ? transcript.sessionId : `${transcript.sessionId}:${transcript.agentId ?? transcript.fileName}`,
    kind: transcript.kind,
    sessionId: transcript.sessionId,
    agentId: transcript.agentId,
    sourceFileName: transcript.fileName,
    sourceRelativePath: transcript.relativePath,
    cwd: transcript.cwd,
    gitBranch: transcript.gitBranch,
    startedAt: transcript.startedAt,
    rootEventIds,
    events: normalizedEvents,
  };
}
