import { basename, dirname, join, resolve } from "node:path";

import type { RawUploadFile, NormalizedThread } from "../contracts";
import { encodeClaudeProjectPath, getClaudeHome } from "../claude/path-utils";
import { getCodexHome } from "../codex/path-utils";
import type { ImportTarget } from "./types";

function safeId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || crypto.randomUUID();
}

export function resolveWorkspace(workspace?: string, fallback = process.cwd()): string {
  return resolve(workspace ?? fallback);
}

export function targetLabel(target: ImportTarget): string {
  return target === "codex" ? "Codex" : "Claude Code";
}

export function providerSourceForTarget(target: ImportTarget): "claude-code" | "codex" {
  return target === "codex" ? "codex" : "claude-code";
}

export function getClaudeProjectDir(workspace: string, explicitClaudeHome?: string): string {
  return join(getClaudeHome(explicitClaudeHome), "projects", encodeClaudeProjectPath(workspace));
}

export function getClaudeImportPath(rawFile: RawUploadFile, workspace: string, explicitClaudeHome?: string): string {
  return join(getClaudeProjectDir(workspace, explicitClaudeHome), basename(rawFile.fileName));
}

export function codexDateParts(timestamp: string | null | undefined): { year: string; month: string; day: string; stamp: string } {
  const date = timestamp ? new Date(timestamp) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  const iso = valid.toISOString();

  return {
    year: iso.slice(0, 4),
    month: iso.slice(5, 7),
    day: iso.slice(8, 10),
    stamp: iso.slice(0, 19).replace(/:/g, "-"),
  };
}

export function codexRelativePathForThread(thread: NormalizedThread): string {
  const parts = codexDateParts(thread.startedAt);
  const threadId = safeId(thread.kind === "main" ? thread.sessionId : (thread.agentId ?? thread.id));
  return join("sessions", parts.year, parts.month, parts.day, `rollout-${parts.stamp}-${threadId}.jsonl`);
}

export function getCodexImportPath(rawFile: RawUploadFile, explicitCodexHome?: string): string {
  const codexHome = getCodexHome(explicitCodexHome);
  const relativePath = rawFile.relativePath.startsWith("sessions/")
    ? rawFile.relativePath
    : join("sessions", dirname(rawFile.relativePath), rawFile.fileName);

  return join(codexHome, relativePath);
}
