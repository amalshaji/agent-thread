import { basename, isAbsolute, join, relative, resolve } from "node:path";

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

function splitSafeRelativePath(value: string, fieldName: string): string[] {
  const normalized = value.replaceAll("\\", "/");

  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`Unsafe Codex import path: ${fieldName} must be relative.`);
  }

  const parts = normalized.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) {
    throw new Error(`Unsafe Codex import path: ${fieldName} contains unsafe path segments.`);
  }

  return parts;
}

function assertSafeFileName(value: string): string {
  if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new Error("Unsafe Codex import path: fileName must be a single file name.");
  }

  return value;
}

function isWithinPath(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

export function getCodexImportPath(rawFile: RawUploadFile, explicitCodexHome?: string): string {
  const codexHome = getCodexHome(explicitCodexHome);
  const sessionsRoot = join(codexHome, "sessions");
  const relativeParts = splitSafeRelativePath(rawFile.relativePath, "relativePath");
  const targetParts =
    relativeParts[0] === "sessions"
      ? relativeParts.slice(1)
      : [...relativeParts.slice(0, -1), assertSafeFileName(rawFile.fileName)];

  if (targetParts.length === 0) {
    throw new Error("Unsafe Codex import path: relativePath must point to a file under sessions.");
  }

  const targetPath = resolve(sessionsRoot, ...targetParts);

  if (!isWithinPath(sessionsRoot, targetPath)) {
    throw new Error("Unsafe Codex import path: target must stay inside the Codex sessions directory.");
  }

  return targetPath;
}
