import { basename, dirname, join, resolve } from "node:path";

import type { RawUploadFile, UploadSource } from "../contracts";
import { encodeClaudeProjectPath, getClaudeHome } from "../claude/path-utils";
import { getCodexHome } from "../codex/path-utils";
import type { ImportTarget } from "./types";

export function resolveWorkspace(workspace?: string, fallback = process.cwd()): string {
  return resolve(workspace ?? fallback);
}

export function targetForSource(source: UploadSource): ImportTarget {
  return source === "codex" ? "codex" : "claude";
}

export function targetLabel(target: ImportTarget): string {
  return target === "codex" ? "Codex" : "Claude Code";
}

export function getClaudeProjectDir(workspace: string, explicitClaudeHome?: string): string {
  return join(getClaudeHome(explicitClaudeHome), "projects", encodeClaudeProjectPath(workspace));
}

export function getClaudeImportPath(rawFile: RawUploadFile, workspace: string, explicitClaudeHome?: string): string {
  return join(getClaudeProjectDir(workspace, explicitClaudeHome), basename(rawFile.fileName));
}

export function getCodexImportPath(rawFile: RawUploadFile, explicitCodexHome?: string): string {
  const relativePath = rawFile.relativePath.startsWith("sessions/")
    ? rawFile.relativePath
    : join("sessions", dirname(rawFile.relativePath), rawFile.fileName);

  return join(getCodexHome(explicitCodexHome), relativePath);
}
