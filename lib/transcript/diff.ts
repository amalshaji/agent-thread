import { escapeHtml } from "./utils";

function stripDiffFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:diff|patch)\s*\n([\s\S]*?)\n```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function looksLikePatch(value: string): boolean {
  const text = stripDiffFence(value);
  const hasGitHeader = text.includes("diff --git ");
  const hasFileMarkers = text.includes("\n--- ") && text.includes("\n+++ ");
  const hasHunkHeader = /(^|\n)@@ [^@]+ @@/m.test(text);
  const hasChangeLines = /(^|\n)[+-][^\n]+/m.test(text);

  return (hasGitHeader || hasFileMarkers) && hasHunkHeader && hasChangeLines;
}

export function extractPatch(value: unknown, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }

  if (typeof value === "string") {
    const patch = stripDiffFence(value);
    return looksLikePatch(patch) ? patch : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const patch = extractPatch(entry, depth + 1);
      if (patch) {
        return patch;
      }
    }

    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const priorityKeys = ["patch", "diff", "content", "text", "stdout", "stderr", "input"];

  for (const key of priorityKeys) {
    if (key in record) {
      const patch = extractPatch(record[key], depth + 1);
      if (patch) {
        return patch;
      }
    }
  }

  for (const entry of Object.values(record)) {
    const patch = extractPatch(entry, depth + 1);
    if (patch) {
      return patch;
    }
  }

  return null;
}

const DIFF_SIZE_LIMIT = 3000;
const MAX_DIFFS_PER_REQUEST = 6;
let _diffBudget = MAX_DIFFS_PER_REQUEST;

export function resetDiffBudget(): void {
  _diffBudget = MAX_DIFFS_PER_REQUEST;
}

export async function renderDiffBlock(patch: string): Promise<string | null> {
  if (patch.length > DIFF_SIZE_LIMIT || _diffBudget <= 0) {
    return null;
  }
  _diffBudget--;
  return `<pre class="diff-view" data-diff>${escapeHtml(patch)}</pre>`;
}
