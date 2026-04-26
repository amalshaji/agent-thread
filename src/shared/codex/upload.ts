import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import type { NormalizedSession, RawUploadFile, UploadRequest } from "../contracts";
import { readCodexRecords } from "./fs";
import { getCodexHome } from "./path-utils";
import { buildNormalizedThread } from "./summaries";
import type { CodexTranscriptSummary, DiscoveredCodexSession } from "./types";

async function buildRawUploadFile(transcript: CodexTranscriptSummary): Promise<RawUploadFile> {
  return {
    threadId: transcript.kind === "main" ? transcript.sessionId : `${transcript.sessionId}:${transcript.agentId ?? transcript.threadId}`,
    kind: transcript.kind,
    fileName: transcript.fileName,
    relativePath: transcript.relativePath,
    content: await readFile(transcript.path, "utf8"),
  };
}

function sortTranscripts(transcripts: CodexTranscriptSummary[]): CodexTranscriptSummary[] {
  return [...transcripts].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "main" ? -1 : 1;
    }

    return left.fileName.localeCompare(right.fileName);
  });
}

export async function buildUploadRequest(session: DiscoveredCodexSession, codexHome?: string): Promise<UploadRequest> {
  const resolvedCodexHome = getCodexHome(codexHome);
  const transcripts = sortTranscripts(session.transcripts);

  const threads = await Promise.all(
    transcripts.map(async (transcript) =>
      buildNormalizedThread(await readCodexRecords(transcript.path), {
        ...transcript,
        relativePath: relative(resolvedCodexHome, transcript.path),
      }),
    ),
  );

  const rawFiles = await Promise.all(transcripts.map((transcript) => buildRawUploadFile(transcript)));
  const normalized: NormalizedSession = {
    schemaVersion: 1,
    source: "codex",
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
    source: "codex",
    sessionId: session.sessionId,
    projectKey: session.projectKey,
    projectPath: session.projectPath,
    title: session.title,
    rawFiles,
    normalized,
  };
}
