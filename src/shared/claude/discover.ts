import { join, resolve } from "node:path";

import { maybeProjectDirs, maybeReadDir, getGitRoot } from "./fs";
import { encodeClaudeProjectPath, getClaudeHome, matchesScope } from "./path-utils";
import { sortSessions, summarizeTranscriptFile } from "./summaries";
import type { DiscoverClaudeSessionsOptions, DiscoveredClaudeSession } from "./types";

export async function discoverClaudeSessions(
  options: DiscoverClaudeSessionsOptions = {},
): Promise<DiscoveredClaudeSession[]> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const claudeHome = getClaudeHome(options.claudeHome);
  const projectsRoot = join(claudeHome, "projects");
  const gitRoot = await getGitRoot(cwd);
  const roots = Array.from(new Set([cwd, gitRoot].filter((value): value is string => Boolean(value))));
  const exactProjectKeys = roots.map((root) => encodeClaudeProjectPath(root));
  const exactProjectDirs = exactProjectKeys.map((key) => join(projectsRoot, key));
  const availableExactProjectDirs = (
    await Promise.all(
      exactProjectDirs.map(async (projectDir) => {
        const contents = await maybeReadDir(projectDir);
        return contents ? projectDir : null;
      }),
    )
  ).filter((value): value is string => value !== null);

  const projectDirs =
    availableExactProjectDirs.length > 0 ? availableExactProjectDirs : await maybeProjectDirs(projectsRoot);

  const transcriptPaths: string[] = [];

  for (const projectDir of projectDirs) {
    const fileNames = await maybeReadDir(projectDir);

    if (!fileNames) {
      continue;
    }

    for (const fileName of fileNames) {
      if (fileName.endsWith(".jsonl")) {
        transcriptPaths.push(join(projectDir, fileName));
      }
    }
  }

  const summaries = await Promise.all(transcriptPaths.map((path) => summarizeTranscriptFile(path, projectsRoot)));
  const scopedSummaries =
    availableExactProjectDirs.length > 0 ? summaries : summaries.filter((summary) => matchesScope(summary.cwd, roots));
  const grouped = new Map<string, DiscoveredClaudeSession>();

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
