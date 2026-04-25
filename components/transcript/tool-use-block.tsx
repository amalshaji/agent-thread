import { extractPatch, renderDiffBlock } from "@/src/worker/view/diff";
import {
  getToolFilePath,
  getToolMeta,
  getToolResultTextContent,
  basename,
} from "@/src/worker/view/tool-inline";
import type { ToolResultBlock, ToolUseBlock } from "@/src/worker/view/tool-inline";
import { prettyJson } from "@/src/worker/view/utils";

const CHEV_SVG = (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6,4 10,8 6,12" />
  </svg>
);

function ToolCallSummary({ name, input }: { name: string; input: unknown }) {
  const meta = getToolMeta(name, input);
  return (
    <span className={`tool-color-${meta.color}`} style={{ display: "contents" }}>
      <span className="tool-pill-row tool-pill-row-primary">
        <span className="tool-call-icon">
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: meta.iconPaths }}
          />
        </span>
        <span className="tool-pill tool-pill-call">{meta.shortName}</span>
        {meta.summary ? (
          <>
            <span className="tool-call-sep">—</span>
            <span className="tool-call-summary">{meta.summary}</span>
          </>
        ) : null}
      </span>
      <span className="tool-call-chev">{CHEV_SVG}</span>
    </span>
  );
}

function ToolFilePreview({ content, fileName }: { content: string; fileName: string | null }) {
  const ext = fileName?.split(".").at(-1)?.toLowerCase();
  const langClass = ext ? ` language-${ext}` : "";
  return (
    <div className="tool-file-preview">
      {fileName ? (
        <div className="tool-file-header">
          <span className="tool-file-name">{fileName}</span>
        </div>
      ) : null}
      <pre className="tool-payload tool-code-payload">
        <code className={langClass.trim() || undefined}>{content}</code>
      </pre>
    </div>
  );
}

function splitLines(value: string): string[] {
  const normalized = value.replace(/\r\n/g, "\n");
  const trimmed = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return trimmed.length > 0 ? trimmed.split("\n") : [""];
}

function buildSyntheticPatch(fileName: string, oldString: string, newString: string): string {
  const oldLines = splitLines(oldString);
  const newLines = splitLines(newString);
  const fmtCount = (n: number) => (n === 1 ? "1" : `1,${n}`);
  return [
    `diff --git a/${fileName} b/${fileName}`,
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    `@@ -${fmtCount(oldLines.length)} +${fmtCount(newLines.length)} @@`,
    ...oldLines.map((l) => `-${l}`),
    ...newLines.map((l) => `+${l}`),
    "",
  ].join("\n");
}

function collectEditPatches(input: unknown): string[] {
  const record = asRecord(input);
  if (!record) return [];
  const fileName = getToolFileName(input) ?? "file";
  const directOld = typeof record.old_string === "string" ? record.old_string : null;
  const directNew = typeof record.new_string === "string" ? record.new_string : null;
  if (directOld !== null && directNew !== null) {
    return [buildSyntheticPatch(fileName, directOld, directNew)];
  }
  if (!Array.isArray(record.edits)) return [];
  return record.edits
    .map((entry) => {
      const edit = asRecord(entry);
      if (!edit || typeof edit.old_string !== "string" || typeof edit.new_string !== "string") return null;
      return buildSyntheticPatch(fileName, edit.old_string, edit.new_string);
    })
    .filter((p): p is string => p !== null);
}

function getToolFileName(input: unknown): string | null {
  const path = getToolFilePath(input);
  return path ? basename(path) : null;
}

function getToolResultText(result: ToolResultBlock | undefined): string | null {
  if (!result) return null;
  return getToolResultTextContent(result.content);
}

type InputRecord = Record<string, unknown>;
function asRecord(v: unknown): InputRecord | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as InputRecord) : null;
}

async function getInlinePreview(
  block: ToolUseBlock,
  relatedResult?: ToolResultBlock,
): Promise<{ kind: "file"; content: string; fileName: string | null } | { kind: "diff"; html: string } | null> {
  const fileName = getToolFileName(block.input);
  const n = block.name.toLowerCase();

  if (n === "read") {
    const text = getToolResultText(relatedResult);
    if (text) return { kind: "file", content: text, fileName };
    return null;
  }

  if (n === "write") {
    const record = asRecord(block.input);
    const content = typeof record?.content === "string" ? record.content : null;
    if (content) return { kind: "file", content, fileName };
    return null;
  }

  if (n === "edit" || n === "multiedit") {
    const directPatch = extractPatch(block.input);
    if (directPatch) {
      const html = await renderDiffBlock(directPatch);
      if (html) return { kind: "diff", html };
    }
    // Build synthetic patch from old_string/new_string
    const patches = collectEditPatches(block.input);
    if (patches.length > 0) {
      const rendered = (await Promise.all(patches.map(renderDiffBlock))).filter((h): h is string => h !== null);
      if (rendered.length > 0) return { kind: "diff", html: rendered.join("") };
    }
    return null;
  }

  return null;
}

export async function ToolUseBlockComponent({
  block,
  relatedResult,
}: {
  block: ToolUseBlock;
  relatedResult?: ToolResultBlock;
}) {
  const meta = getToolMeta(block.name, block.input);
  const colorClass = `tool-color-${meta.color}`;
  const preview = await getInlinePreview(block, relatedResult);

  const patch = preview ? null : extractPatch(block.input);
  const diffHtml = patch ? await renderDiffBlock(patch) : null;

  if (preview) {
    return (
      <details className={`block tool-call-disclosure ${colorClass}`} open>
        <summary>
          <ToolCallSummary name={block.name} input={block.input} />
        </summary>
        {preview.kind === "file" ? (
          <ToolFilePreview content={preview.content} fileName={preview.fileName} />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: preview.html }} />
        )}
      </details>
    );
  }

  return (
    <details className={`block tool-call-disclosure ${colorClass}`}>
      <summary>
        <ToolCallSummary name={block.name} input={block.input} />
      </summary>
      <div className="tool-call-panel">
        {diffHtml ? (
          <div dangerouslySetInnerHTML={{ __html: diffHtml }} />
        ) : null}
        <pre className="tool-payload">{prettyJson(block.input)}</pre>
      </div>
    </details>
  );
}
