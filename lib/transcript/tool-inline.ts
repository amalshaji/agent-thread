import type { ContentBlock } from "@/src/shared/contracts";
import { extractPatch, renderDiffBlock } from "./diff";
import { escapeHtml } from "./utils";

type ToolInputRecord = Record<string, unknown>;

export type ToolUseBlock = Extract<ContentBlock, { kind: "tool_use" }>;
export type ToolResultBlock = Extract<ContentBlock, { kind: "tool_result" }>;

function asRecord(value: unknown): ToolInputRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ToolInputRecord) : null;
}

function firstString(record: ToolInputRecord | null, keys: string[]): string | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function basename(value: string): string {
  const parts = value.split(/[\\/]/).filter((part) => part.length > 0);
  return parts.at(-1) ?? value;
}

export function getToolFilePath(input: unknown): string | null {
  const record = asRecord(input);
  return firstString(record, ["file_path", "path", "target_file", "targetPath"]);
}

function getToolFileName(input: unknown): string | null {
  const path = getToolFilePath(input);
  return path ? basename(path) : null;
}

export function getToolResultTextContent(content: unknown): string | null {
  if (typeof content === "string" && content.length > 0) {
    return content;
  }

  if (Array.isArray(content)) {
    const parts = content
      .map((entry) => {
        const record = asRecord(entry);
        if (!record) {
          return null;
        }

        if (typeof record.type === "string" && record.type === "text" && typeof record.text === "string") {
          return record.text;
        }

        if (typeof record.text === "string") {
          return record.text;
        }

        return null;
      })
      .filter((value): value is string => value !== null && value.length > 0);

    return parts.length > 0 ? parts.join("\n\n") : null;
  }

  const record = asRecord(content);
  if (!record) {
    return null;
  }

  if (typeof record.type === "string" && record.type === "text" && typeof record.text === "string") {
    return record.text;
  }

  if (typeof record.text === "string" && record.text.length > 0) {
    return record.text;
  }

  return null;
}

export type ToolColor = "blue" | "purple" | "amber" | "green" | "cyan" | "gray" | "pink";

export interface ToolMeta {
  shortName: string;
  color: ToolColor;
  iconPaths: string;
  summary: string;
}

const TOOL_ICONS: Record<string, string | undefined> = {
  file: '<path d="M4 2h5l3 3v9H4z"/><polyline points="9,2 9,5 12,5"/>',
  edit: '<path d="M3 13l2-.5L12 5.5 10.5 4 3.5 11 3 13z"/>',
  terminal: '<polyline points="3,5 6,8 3,11"/><line x1="8" y1="11" x2="13" y2="11"/>',
  sparkle: '<path d="M8 2v5M8 9v5M2 8h5M9 8h5"/>',
  link: '<path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4L8 4"/><path d="M9 7a3 3 0 0 0-4 0L3 9a3 3 0 0 0 4 4l1-1"/>',
  grep: '<path d="M3 4h10M3 8h10M3 12h6"/>',
  dot: '<circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>',
};

const icon = (key: string): string => TOOL_ICONS[key] ?? TOOL_ICONS.dot ?? "";

export function getToolMeta(name: string, input: unknown): ToolMeta {
  const fileName = getToolFileName(input);
  const record = asRecord(input);
  const n = name.toLowerCase();

  switch (n) {
    case "write":
      return { shortName: "Write", color: "purple", iconPaths: icon("edit"), summary: fileName ?? "" };
    case "edit":
      return { shortName: "Edit", color: "purple", iconPaths: icon("edit"), summary: fileName ?? "" };
    case "multiedit":
      return { shortName: "Edit", color: "purple", iconPaths: icon("edit"), summary: fileName ?? "" };
    case "read":
      return { shortName: "Read", color: "blue", iconPaths: icon("file"), summary: fileName ?? "" };
    case "bash": {
      const cmd = typeof record?.command === "string" ? (record.command.trim().split("\n")[0] ?? "") : "";
      return { shortName: "Bash", color: "gray", iconPaths: icon("terminal"), summary: cmd.substring(0, 60) };
    }
    case "agent":
      return { shortName: "Agent", color: "pink", iconPaths: icon("sparkle"), summary: "" };
    case "webfetch":
      return { shortName: "Fetch", color: "cyan", iconPaths: icon("link"), summary: "" };
    case "websearch": {
      const q = typeof record?.query === "string" ? record.query.substring(0, 40) : "";
      return { shortName: "Search", color: "cyan", iconPaths: icon("link"), summary: q };
    }
    case "grep":
      return { shortName: "Grep", color: "amber", iconPaths: icon("grep"), summary: fileName ?? "" };
    case "glob":
      return { shortName: "Glob", color: "amber", iconPaths: icon("grep"), summary: fileName ?? "" };
    default:
      return { shortName: name, color: "gray", iconPaths: icon("dot"), summary: fileName ?? "" };
  }
}

export function getToolIntentLabel(name: string, input: unknown): string {
  const fileName = getToolFileName(input);

  switch (name.toLowerCase()) {
    case "write":
      return fileName ? `Writing file ${fileName}` : "Writing file";
    case "edit":
    case "multiedit":
      return fileName ? `Editing file ${fileName}` : "Editing file";
    case "read":
      return fileName ? `Reading file ${fileName}` : "Reading file";
    case "agent":
      return "Running agent";
    case "webfetch":
      return "Fetching page";
    case "bash":
      return "Running command";
    default:
      return fileName ? `${name} ${fileName}` : name;
  }
}

function inferLanguage(fileName: string | null): string | null {
  if (!fileName || !fileName.includes(".")) {
    return null;
  }

  const extension = fileName.split(".").at(-1)?.toLowerCase();

  switch (extension) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "json":
    case "html":
    case "css":
    case "md":
    case "sh":
    case "py":
    case "rb":
    case "go":
    case "rs":
      return extension;
    default:
      return null;
  }
}

function renderCodePayload(content: string, fileName: string | null): string {
  const language = inferLanguage(fileName);
  const languageClass = language ? ` class="language-${escapeHtml(language)}"` : "";
  const header = fileName
    ? `<div class="tool-file-header"><span class="tool-file-name">${escapeHtml(fileName)}</span></div>`
    : "";

  return `
    <div class="tool-file-preview">
      ${header}
      <pre class="tool-payload tool-code-payload"><code${languageClass}>${escapeHtml(content)}</code></pre>
    </div>
  `;
}

function splitLines(value: string): string[] {
  const normalized = value.replace(/\r\n/g, "\n");
  const trimmed = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return trimmed.length > 0 ? trimmed.split("\n") : [""];
}

function formatHunkCount(count: number): string {
  return count === 1 ? "1" : `1,${count}`;
}

function buildSyntheticPatch(fileName: string, oldString: string, newString: string): string {
  const oldLines = splitLines(oldString);
  const newLines = splitLines(newString);

  return [
    `diff --git a/${fileName} b/${fileName}`,
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    `@@ -${formatHunkCount(oldLines.length)} +${formatHunkCount(newLines.length)} @@`,
    ...oldLines.map((line) => `-${line}`),
    ...newLines.map((line) => `+${line}`),
    "",
  ].join("\n");
}

function collectEditPatches(input: unknown): string[] {
  const record = asRecord(input);
  if (!record) {
    return [];
  }

  const fileName = getToolFileName(input) ?? "file";
  const directOld = typeof record.old_string === "string" ? record.old_string : null;
  const directNew = typeof record.new_string === "string" ? record.new_string : null;

  if (directOld !== null && directNew !== null) {
    return [buildSyntheticPatch(fileName, directOld, directNew)];
  }

  if (!Array.isArray(record.edits)) {
    return [];
  }

  return record.edits
    .map((entry) => {
      const edit = asRecord(entry);
      if (!edit || typeof edit.old_string !== "string" || typeof edit.new_string !== "string") {
        return null;
      }

      return buildSyntheticPatch(fileName, edit.old_string, edit.new_string);
    })
    .filter((patch): patch is string => patch !== null);
}

export async function renderInlineToolUsePreview(
  block: ToolUseBlock,
  relatedResult?: ToolResultBlock,
): Promise<string | null> {
  const fileName = getToolFileName(block.input);

  switch (block.name.toLowerCase()) {
    case "read": {
      const resultContent = relatedResult ? getToolResultTextContent(relatedResult.content) : null;
      return resultContent ? renderCodePayload(resultContent, fileName) : null;
    }
    case "write": {
      const record = asRecord(block.input);
      const content = typeof record?.content === "string" ? record.content : null;
      return content ? renderCodePayload(content, fileName) : null;
    }
    case "edit":
    case "multiedit": {
      const directPatch = extractPatch(block.input);
      const syntheticPatches = directPatch ? [directPatch] : collectEditPatches(block.input);
      const renderedDiffs = (await Promise.all(syntheticPatches.map(renderDiffBlock))).filter(
        (value): value is string => value !== null,
      );

      if (renderedDiffs.length === 0) {
        return null;
      }

      return renderedDiffs.join("");
    }
    default:
      return null;
  }
}

function isFileMutationTool(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized === "write" || normalized === "edit" || normalized === "multiedit";
}

export function isInlineFileMutationTool(name: string): boolean {
  return isFileMutationTool(name);
}

export function isInlineToolPreviewTool(name: string): boolean {
  return isFileMutationTool(name.toLowerCase());
}

function isSimpleFileMutationResult(content: unknown): boolean {
  if (extractPatch(content)) {
    return true;
  }

  if (typeof content !== "string") {
    return false;
  }

  return /file (created|updated|written) successfully at:/i.test(content);
}

export function shouldHideRedundantToolResult(toolUse: ToolUseBlock | undefined, result: ToolResultBlock): boolean {
  if (!toolUse) {
    return false;
  }

  if (toolUse.name.toLowerCase() === "read") {
    return result.status !== "error" && getToolResultTextContent(result.content) !== null;
  }

  if (!isFileMutationTool(toolUse.name)) {
    return false;
  }

  return isSimpleFileMutationResult(result.content);
}
