import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { ClaudeEvent } from "./types";

export async function maybeReadDir(path: string): Promise<string[] | null> {
  try {
    return await readdir(path, { withFileTypes: false });
  } catch {
    return null;
  }
}

export async function maybeProjectDirs(projectsRoot: string): Promise<string[]> {
  try {
    const entries = await readdir(projectsRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => join(projectsRoot, entry.name));
  } catch {
    return [];
  }
}

export async function getGitRoot(cwd: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
      cwd,
      stdout: "pipe",
      stderr: "ignore",
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return null;
    }

    const gitRoot = output.trim();
    return gitRoot.length > 0 ? gitRoot : null;
  } catch {
    return null;
  }
}

export function parseJsonLines(text: string): ClaudeEvent[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ClaudeEvent);
}

export async function readClaudeEvents(path: string): Promise<ClaudeEvent[]> {
  return parseJsonLines(await Bun.file(path).text());
}
