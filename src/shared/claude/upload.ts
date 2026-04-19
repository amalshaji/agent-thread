import { join, relative } from "node:path";

import type { NormalizedSession, RawUploadFile, UploadRequest } from "../contracts";
import { readClaudeEvents } from "./fs";
import { getClaudeHome } from "./path-utils";
import { buildNormalizedThread } from "./summaries";
import type { ClaudeTranscriptSummary, DiscoveredClaudeSession } from "./types";

async function buildRawUploadFile(transcript: ClaudeTranscriptSummary): Promise<RawUploadFile> {
  return {
    threadId: transcript.kind === "main" ? transcript.sessionId : `${transcript.sessionId}:${transcript.agentId ?? transcript.fileName}`,
    kind: transcript.kind,
    fileName: transcript.fileName,
    relativePath: transcript.relativePath,
    content: await Bun.file(transcript.path).text(),
  };
}

function sortTranscripts(transcripts: ClaudeTranscriptSummary[]): ClaudeTranscriptSummary[] {
  return [...transcripts].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "main" ? -1 : 1;
    }

    return left.fileName.localeCompare(right.fileName);
  });
}

export async function buildUploadRequest(session: DiscoveredClaudeSession, claudeHome?: string): Promise<UploadRequest> {
  const projectsRoot = join(getClaudeHome(claudeHome), "projects");
  const transcripts = sortTranscripts(session.transcripts);

  const threads = await Promise.all(
    transcripts.map(async (transcript) =>
      buildNormalizedThread(await readClaudeEvents(transcript.path), {
        ...transcript,
        relativePath: relative(projectsRoot, transcript.path),
      }),
    ),
  );

  const rawFiles = await Promise.all(transcripts.map((transcript) => buildRawUploadFile(transcript)));
  const normalized: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: new Date().toISOString(),
    root: {
      sessionId: session.sessionId,
      projectKey: session.projectKey,
      projectPath: session.projectPath,
      title: session.title,
      cwd: session.cwd,
      gitBranch: session.gitBranch,
      startedAt: session.startedAt,
    },
    threads,
    stats: {
      threadCount: threads.length,
      eventCount: threads.reduce((total, thread) => total + thread.events.length, 0),
      messageCount: threads.reduce(
        (total, thread) =>
          total + thread.events.filter((event) => event.displayKind !== "snapshot" && event.displayKind !== "meta").length,
        0,
      ),
      sidechainCount: threads.filter((thread) => thread.kind === "sidechain").length,
    },
  };

  return {
    schemaVersion: 1,
    source: "claude-code",
    sessionId: session.sessionId,
    projectKey: session.projectKey,
    projectPath: session.projectPath,
    title: session.title,
    rawFiles,
    normalized,
  };
}
