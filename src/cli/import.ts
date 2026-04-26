import type { SessionExportBundle } from "../shared/contracts";
import { importSessionBundle, resolveWorkspace, targetLabel, type ImportResult, type ImportTarget } from "../shared/imports";

interface ImportCliOptions {
  serverUrl: string;
  importRef: string;
  target: ImportTarget;
  workspace: string;
  claudeHome?: string;
  codexHome?: string;
  dryRun?: boolean;
  force?: boolean;
}

function summarizeBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

export function parseImportRef(value: string, fallbackServerUrl: string): { publicId: string; serverUrl: string } {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const threadIndex = parts.indexOf("t");
    const apiSessionIndex = parts.indexOf("sessions");
    const publicId = threadIndex >= 0 ? parts[threadIndex + 1] : apiSessionIndex >= 0 ? parts[apiSessionIndex + 1] : parts.at(-1);

    if (!publicId) {
      throw new Error(`Could not find a public ID in ${value}.`);
    }

    return { publicId, serverUrl: url.origin };
  } catch (error) {
    if (error instanceof TypeError) {
      const publicId = value.trim().replace(/^\/+|\/+$/g, "");
      if (!publicId) {
        throw new Error("--import requires a URL or public ID.");
      }
      return { publicId, serverUrl: fallbackServerUrl };
    }

    throw error;
  }
}

async function formatImportFetchFailure(response: Response, exportUrl: URL): Promise<string> {
  const body = await response.text();
  const trimmed = body.trim();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json") && trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return `Import failed (${response.status}): ${parsed.error.trim()}`;
      }
    } catch {
      // Fall through.
    }
  }

  return trimmed
    ? `Import failed (${response.status}) at ${exportUrl.toString()}: ${summarizeBody(trimmed)}`
    : `Import failed (${response.status}) at ${exportUrl.toString()}.`;
}

function isSessionExportBundle(value: unknown): value is SessionExportBundle {
  const candidate = value as Partial<SessionExportBundle> | null;

  return (
    Boolean(candidate) &&
    candidate?.schemaVersion === 1 &&
    (candidate.source === "claude-code" || candidate.source === "codex") &&
    typeof candidate.publicId === "string" &&
    Array.isArray(candidate.rawFiles) &&
    Boolean(candidate.normalized)
  );
}

export async function fetchSessionExport(importRef: string, fallbackServerUrl: string): Promise<SessionExportBundle> {
  const parsed = parseImportRef(importRef, fallbackServerUrl);
  const exportUrl = new URL(`/api/sessions/${parsed.publicId}/export`, parsed.serverUrl);
  const response = await fetch(exportUrl);

  if (!response.ok) {
    throw new Error(await formatImportFetchFailure(response, exportUrl));
  }

  const body = await response.json();
  if (!isSessionExportBundle(body)) {
    throw new Error(`Import failed: ${exportUrl.toString()} did not return an agent-thread export bundle.`);
  }

  return body;
}

export async function importSharedSession(options: ImportCliOptions): Promise<ImportResult> {
  const bundle = await fetchSessionExport(options.importRef, options.serverUrl);

  return importSessionBundle(bundle, {
    target: options.target,
    workspace: resolveWorkspace(options.workspace),
    claudeHome: options.claudeHome,
    codexHome: options.codexHome,
    dryRun: options.dryRun,
    force: options.force,
  });
}

export function formatImportSummary(result: ImportResult): string {
  const action = result.dryRun ? "would import" : "imported";
  const mode = result.transformed ? `${result.source} -> ${targetLabel(result.target)} transform` : `${targetLabel(result.target)} raw restore`;
  const files = result.files.map((file) => `  ${file.written ? "wrote" : "plan"} ${file.path}`).join("\n");
  const warnings = result.warnings.length > 0 ? `\n\n${result.warnings.map((warning) => `Warning: ${warning}`).join("\n")}` : "";

  return `${action} ${result.files.length} file${result.files.length === 1 ? "" : "s"} (${mode})\n${files}${warnings}`;
}
