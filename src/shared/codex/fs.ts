import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { CodexRecord } from "./types";

const execFileAsync = promisify(execFile);

export async function getGitRoot(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd });
    const gitRoot = stdout.trim();
    return gitRoot.length > 0 ? gitRoot : null;
  } catch {
    return null;
  }
}

async function collectJsonlFiles(dir: string, results: string[]): Promise<void> {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        await collectJsonlFiles(path, results);
        return;
      }

      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        results.push(path);
      }
    }),
  );
}

export async function findCodexTranscriptFiles(sessionsRoot: string): Promise<string[]> {
  const results: string[] = [];
  await collectJsonlFiles(sessionsRoot, results);
  return results;
}

export function parseJsonLines(text: string): CodexRecord[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CodexRecord);
}

export async function readCodexRecords(path: string): Promise<CodexRecord[]> {
  return parseJsonLines(await readFile(path, "utf8"));
}
