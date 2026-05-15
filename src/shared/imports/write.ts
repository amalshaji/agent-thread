import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import type { NormalizedThread, RawUploadFile, SessionExportBundle } from "../contracts";
import { getCodexHome } from "../codex/path-utils";
import { getClaudeImportPath, getCodexImportPath, targetForSource } from "./paths";
import type { ImportOptions, ImportPreparedFile, ImportResult } from "./types";

const execFileAsync = promisify(execFile);

type JsonRecord = Record<string, unknown>;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function mapJsonLines(content: string, mapper: (record: JsonRecord) => void): string {
  return content
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return "";
      const parsed = JSON.parse(line);
      const record = asRecord(parsed);
      if (record) {
        mapper(record);
      }
      return JSON.stringify(record ?? parsed);
    })
    .filter(Boolean)
    .join("\n")
    .concat("\n");
}

function retargetClaudeRawFiles(rawFiles: RawUploadFile[], workspace: string): RawUploadFile[] {
  return rawFiles.map((file) => ({
    ...file,
    content: mapJsonLines(file.content, (record) => {
      record.cwd = workspace;
    }),
  }));
}

function retargetCodexRawFiles(rawFiles: RawUploadFile[], workspace: string): RawUploadFile[] {
  return rawFiles.map((file) => ({
    ...file,
    content: mapJsonLines(file.content, (record) => {
      const payload = asRecord(record.payload);
      if ((record.type === "session_meta" || record.type === "turn_context") && payload) {
        payload.cwd = workspace;
      }
    }),
  }));
}

function prepareRawFiles(bundle: SessionExportBundle, options: ImportOptions): RawUploadFile[] {
  return bundle.source === "codex"
    ? retargetCodexRawFiles(bundle.rawFiles, options.workspace)
    : retargetClaudeRawFiles(bundle.rawFiles, options.workspace);
}

function escapeSql(value: string | null | undefined): string {
  if (value == null) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function firstUserText(thread: NormalizedThread): string {
  for (const event of thread.events) {
    if (event.role !== "user") continue;
    for (const block of event.blocks) {
      if (block.kind === "text" && block.text.trim()) {
        return block.text.trim().slice(0, 1000);
      }
    }
  }

  return "";
}

function unixSeconds(value: string | null | undefined): number {
  const date = value ? new Date(value) : new Date();
  const millis = Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
  return Math.floor(millis / 1000);
}

async function maybeIndexCodexThreads(
  bundle: SessionExportBundle,
  files: ImportPreparedFile[],
  options: ImportOptions,
): Promise<string[]> {
  if (bundle.source !== "codex" || options.dryRun) {
    return [];
  }

  const warnings: string[] = [];
  const stateDb = join(getCodexHome(options.codexHome), "state_5.sqlite");

  if (!(await exists(stateDb))) {
    warnings.push(`Codex index not updated because ${stateDb} does not exist yet.`);
    return warnings;
  }

  const fileByThreadId = new Map(files.map((file) => [file.rawFile.threadId, file]));
  const insertMode = options.force ? "INSERT OR REPLACE" : "INSERT OR IGNORE";
  const importedAt = Math.floor(Date.now() / 1000);
  const statements = bundle.normalized.threads
    .map((thread) => {
      const file = fileByThreadId.get(thread.kind === "main" ? thread.sessionId : `${thread.sessionId}:${thread.agentId ?? thread.id}`) ?? fileByThreadId.get(thread.id);
      if (!file) return null;

      const createdAt = unixSeconds(thread.startedAt ?? bundle.normalized.root.startedAt);
      const updatedAt = Math.max(importedAt, createdAt);
      const title = bundle.normalized.root.title || firstUserText(thread) || "Imported thread";
      const userText = firstUserText(thread);

      return `
        ${insertMode} INTO threads (
          id,
          rollout_path,
          created_at,
          updated_at,
          source,
          model_provider,
          cwd,
          title,
          sandbox_policy,
          approval_mode,
          tokens_used,
          has_user_event,
          archived,
          git_sha,
          git_branch,
          git_origin_url,
          cli_version,
          first_user_message,
          model,
          reasoning_effort,
          created_at_ms,
          updated_at_ms
        ) VALUES (
          ${escapeSql(thread.kind === "main" ? thread.sessionId : (thread.agentId ?? thread.id))},
          ${escapeSql(file.targetPath)},
          ${createdAt},
          ${updatedAt},
          'cli',
          'openai',
          ${escapeSql(options.workspace)},
          ${escapeSql(title)},
          'danger-full-access',
          'never',
          0,
          ${userText ? 1 : 0},
          0,
          NULL,
          ${escapeSql(thread.gitBranch ?? bundle.normalized.root.gitBranch)},
          NULL,
          'agent-thread-import',
          ${escapeSql(userText)},
          ${escapeSql(thread.events.find((event) => event.meta.model)?.meta.model)},
          NULL,
          ${createdAt * 1000},
          ${updatedAt * 1000}
        );
      `;
    })
    .filter((statement): statement is string => statement !== null);

  if (statements.length === 0) {
    return warnings;
  }

  try {
    await execFileAsync("sqlite3", [stateDb, statements.join("\n")]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Codex index not updated: ${message}`);
  }

  return warnings;
}

export async function importSessionBundle(bundle: SessionExportBundle, options: ImportOptions): Promise<ImportResult> {
  const target = targetForSource(bundle.source);
  const preparedRawFiles = prepareRawFiles(bundle, options);
  const targetFiles = preparedRawFiles.map((rawFile) => ({
    rawFile,
    content: rawFile.content,
    targetPath:
      target === "codex"
        ? getCodexImportPath(rawFile, options.codexHome)
        : getClaudeImportPath(rawFile, options.workspace, options.claudeHome),
  }));
  const existing = await Promise.all(targetFiles.map((file) => exists(file.targetPath)));

  if (!options.force && !options.dryRun) {
    const conflicts = targetFiles.filter((_, index) => existing[index]);
    if (conflicts.length > 0) {
      throw new Error(
        [
          `Import would overwrite ${conflicts.length} existing file${conflicts.length === 1 ? "" : "s"}.`,
          "Use --force to replace them or --dry-run to inspect the target paths.",
          ...conflicts.slice(0, 5).map((file) => `- ${file.targetPath}`),
        ].join("\n"),
      );
    }
  }

  if (!options.dryRun) {
    await Promise.all(
      targetFiles.map(async (file) => {
        await mkdir(dirname(file.targetPath), { recursive: true });
        await writeFile(file.targetPath, file.content, { encoding: "utf8", flag: options.force ? "w" : "wx" });
      }),
    );
  }

  const warnings = await maybeIndexCodexThreads(bundle, targetFiles, options);

  return {
    source: bundle.source,
    target,
    workspace: options.workspace,
    dryRun: options.dryRun === true,
    files: targetFiles.map((file, index) => ({
      kind: file.rawFile.kind,
      threadId: file.rawFile.threadId,
      path: file.targetPath,
      bytes: Buffer.byteLength(file.content, "utf8"),
      existed: existing[index] === true,
      written: options.dryRun !== true,
    })),
    warnings,
  };
}
