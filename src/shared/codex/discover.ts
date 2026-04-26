import { join, resolve } from "node:path";

import { findCodexTranscriptFiles, getGitRoot } from "./fs";
import { getCodexHome, matchesScope } from "./path-utils";
import { sortSessions, summarizeTranscriptFile } from "./summaries";
import type { DiscoverCodexSessionsOptions, DiscoveredCodexSession } from "./types";

export async function discoverCodexSessions(
  options: DiscoverCodexSessionsOptions = {},
): Promise<DiscoveredCodexSession[]> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const codexHome = getCodexHome(options.codexHome);
  const sessionsRoot = join(codexHome, "sessions");
  const gitRoot = await getGitRoot(cwd);
  const roots = Array.from(new Set([cwd, gitRoot].filter((value): value is string => Boolean(value))));
  const transcriptPaths = await findCodexTranscriptFiles(sessionsRoot);
  const summaries = (
    await Promise.all(transcriptPaths.map((path) => summarizeTranscriptFile(path, codexHome)))
  ).filter((summary): summary is NonNullable<typeof summary> => summary !== null);
  const scopedSummaries = summaries.filter((summary) => matchesScope(summary.cwd, roots));
  const grouped = new Map<string, DiscoveredCodexSession>();

  for (const summary of scopedSummaries) {
    const existing = grouped.get(summary.sessionId);

    if (!existing) {
      grouped.set(summary.sessionId, {
        sessionId: summary.sessionId,
        projectKey: summary.projectKey,
        projectPath: summary.cwd,
        cwd: summary.cwd,
        gitBranch: summary.gitBranch,
        title: summary.title,
        startedAt: summary.startedAt,
        latestTimestamp: summary.latestTimestamp,
        eventCount: summary.eventCount,
        sidechainCount: summary.kind === "sidechain" ? 1 : 0,
        mainThread: summary.kind === "main" ? summary : null,
        sidechains: summary.kind === "sidechain" ? [summary] : [],
        transcripts: [summary],
      });
      continue;
    }

    existing.transcripts.push(summary);
    existing.eventCount += summary.eventCount;
    existing.sidechainCount += summary.kind === "sidechain" ? 1 : 0;

    if (!existing.projectPath && summary.cwd) {
      existing.projectPath = summary.cwd;
    }

    if (!existing.cwd && summary.cwd) {
      existing.cwd = summary.cwd;
    }

    if (!existing.gitBranch && summary.gitBranch) {
      existing.gitBranch = summary.gitBranch;
    }

    if (!existing.title && summary.title) {
      existing.title = summary.title;
    }

    if (!existing.startedAt || (summary.startedAt && summary.startedAt < existing.startedAt)) {
      existing.startedAt = summary.startedAt;
    }

    if (!existing.latestTimestamp || (summary.latestTimestamp && summary.latestTimestamp > existing.latestTimestamp)) {
      existing.latestTimestamp = summary.latestTimestamp;
    }

    if (summary.kind === "main" && !existing.mainThread) {
      existing.mainThread = summary;
    }

    if (summary.kind === "sidechain") {
      existing.sidechains.push(summary);
    }
  }

  return sortSessions([...grouped.values()]);
}
