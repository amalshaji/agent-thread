import type { UploadSource } from "../shared/contracts";
import {
  buildUploadRequest as buildClaudeUploadRequest,
  type DiscoveredClaudeSession,
} from "../shared/claude";
import {
  buildUploadRequest as buildCodexUploadRequest,
  type DiscoveredCodexSession,
} from "../shared/codex";
import {
  importSessionBundle,
  resolveWorkspace,
  targetLabel,
  type ImportResult,
  type ImportTarget,
} from "../shared/imports";

export type LocalSourceProvider = "claude" | "codex";

type LocalConversionSelection =
  | {
      provider: "claude";
      session: DiscoveredClaudeSession;
      claudeHome?: string;
    }
  | {
      provider: "codex";
      session: DiscoveredCodexSession;
      codexHome?: string;
    };

interface LocalConversionOptions {
  target?: ImportTarget;
  workspace: string;
  claudeHome?: string;
  codexHome?: string;
  dryRun?: boolean;
  force?: boolean;
}

function sourceLabel(provider: LocalSourceProvider | UploadSource): string {
  return provider === "codex" ? "Codex" : "Claude Code";
}

export function defaultLocalConversionTarget(provider: LocalSourceProvider): ImportTarget {
  return provider === "codex" ? "claude" : "codex";
}

export function resolveLocalConversionTarget(
  provider: LocalSourceProvider,
  requestedTarget?: ImportTarget,
): ImportTarget {
  const target = defaultLocalConversionTarget(provider);

  if (requestedTarget && requestedTarget !== target) {
    throw new Error(
      `Local conversion from ${sourceLabel(provider)} can only target ${targetLabel(target)}.`,
    );
  }

  return target;
}

export async function convertLocalSelection(
  selection: LocalConversionSelection,
  options: LocalConversionOptions,
): Promise<ImportResult> {
  const target = resolveLocalConversionTarget(selection.provider, options.target);
  const upload =
    selection.provider === "codex"
      ? await buildCodexUploadRequest(selection.session, selection.codexHome)
      : await buildClaudeUploadRequest(selection.session, selection.claudeHome);

  return importSessionBundle(
    {
      schemaVersion: 1,
      publicId: `local-${upload.sessionId}`,
      source: upload.source,
      normalized: upload.normalized,
      rawFiles: upload.rawFiles,
    },
    {
      target,
      workspace: resolveWorkspace(options.workspace),
      claudeHome: options.claudeHome,
      codexHome: options.codexHome,
      dryRun: options.dryRun,
      force: options.force,
    },
  );
}

export function formatLocalConversionSummary(result: ImportResult): string {
  const action = result.dryRun ? "would convert" : "converted";
  const mode = `${sourceLabel(result.source)} -> ${targetLabel(result.target)}`;
  const files = result.files.map((file) => `  ${file.written ? "wrote" : "plan"} ${file.path}`).join("\n");
  const warnings =
    result.warnings.length > 0
      ? `\n\n${result.warnings.map((warning) => `Warning: ${warning}`).join("\n")}`
      : "";

  return `${action} ${result.files.length} file${result.files.length === 1 ? "" : "s"} (${mode})\n${files}${warnings}`;
}
