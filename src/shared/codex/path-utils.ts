import { join, resolve } from "node:path";

function getHomeDir(): string {
  const home = process.env.HOME;

  if (!home) {
    throw new Error("HOME is not set.");
  }

  return home;
}

export function getCodexHome(explicitHome?: string): string {
  return resolve(explicitHome ?? process.env.CODEX_HOME ?? join(getHomeDir(), ".codex"));
}

export function encodeCodexProjectPath(projectPath: string): string {
  return resolve(projectPath).replaceAll("/", "-");
}

function normalizePath(value: string): string {
  return resolve(value);
}

function pathContains(parent: string, candidate: string): boolean {
  if (parent === candidate) {
    return true;
  }

  const prefix = parent.endsWith("/") ? parent : `${parent}/`;
  return candidate.startsWith(prefix);
}

export function matchesScope(transcriptCwd: string | null, roots: string[]): boolean {
  if (!transcriptCwd) {
    return false;
  }

  const normalizedTranscriptCwd = normalizePath(transcriptCwd);

  return roots.some((root) => {
    const normalizedRoot = normalizePath(root);
    return (
      pathContains(normalizedRoot, normalizedTranscriptCwd) ||
      pathContains(normalizedTranscriptCwd, normalizedRoot)
    );
  });
}
