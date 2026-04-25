import type { ContentBlock } from "../../shared/contracts";
import { extractPatch, renderDiffBlock } from "./diff";
import { renderImageAttachment } from "./attachments";
import { renderTextContent } from "./text-content";
import type { ToolResultBlock, ToolUseBlock } from "./tool-inline";
import { getToolMeta, renderInlineToolUsePreview } from "./tool-inline";
import { escapeHtml, prettyJson } from "./utils";

type ToolRenderableBlock = Extract<ContentBlock, { kind: "tool_use" | "tool_result" | "raw" }>;
type ToolInputRecord = Record<string, unknown>;

function renderToolPill(label: string, variant: "call" | "result" | "raw"): string {
  return `<span class="tool-pill tool-pill-${variant}">${escapeHtml(label)}</span>`;
}

const CHEV_SVG = `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6,4 10,8 6,12"/></svg>`;

function renderToolCallSummaryInner(name: string, input: unknown): { colorClass: string; html: string } {
  const meta = getToolMeta(name, input);
  const iconSvg = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${meta.iconPaths}</svg>`;
  const iconEl = `<span class="tool-call-icon">${iconSvg}</span>`;
  const nameEl = `<span class="tool-pill tool-pill-call">${escapeHtml(meta.shortName)}</span>`;
  const summaryEl = meta.summary ? `<span class="tool-call-sep">—</span><span class="tool-call-summary">${escapeHtml(meta.summary)}</span>` : "";
  const html = `<span class="tool-pill-row tool-pill-row-primary">${iconEl}${nameEl}${summaryEl}</span><span class="tool-call-chev">${CHEV_SVG}</span>`;
  return { colorClass: `tool-color-${meta.color}`, html };
}

function asRecord(value: unknown): ToolInputRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ToolInputRecord) : null;
}

function renderToolHeader(block: ToolRenderableBlock): string {
  switch (block.kind) {
    case "tool_use":
      return "";
    case "tool_result":
      return "";
    case "raw":
      return `
        <div class="tool-pill-row">
          ${renderToolPill("Raw Block", "raw")}
        </div>
      `;
  }
}

function renderToolDisclosureSummary(entryCount: number): string {
  const countLabel = entryCount === 1 ? "1 response" : `${entryCount} responses`;

  return `
    <span class="tool-result-summary-chip">
      <span class="tool-result-arrow" aria-hidden="true">▸</span>
      <span class="tool-result-summary-copy">
        <span class="tool-result-summary-label">Tool output</span>
        <span class="tool-result-summary-count">${escapeHtml(countLabel)}</span>
      </span>
    </span>
  `;
}

function getToolPayload(block: ToolRenderableBlock): unknown {
  switch (block.kind) {
    case "tool_use":
      return block.input;
    case "tool_result":
      return block.content;
    case "raw":
      return block.value;
  }
}

async function renderToolResultEntry(entry: unknown): Promise<string> {
  if (typeof entry === "string") {
    return renderTextContent(entry);
  }

  const image = renderImageAttachment(entry, "Tool result image");
  if (image) {
    return image;
  }

  const record = asRecord(entry);
  if (!record) {
    return `<pre class="tool-payload">${prettyJson(entry)}</pre>`;
  }

  if (typeof record.type === "string" && record.type === "text" && typeof record.text === "string") {
    return renderTextContent(record.text);
  }

  if (typeof record.text === "string" && record.text.trim().length > 0) {
    return renderTextContent(record.text);
  }

  return `<pre class="tool-payload">${prettyJson(entry)}</pre>`;
}

function wrapToolResultEntries(entries: string[]): string {
  return entries
    .map((entry) => `<div class="tool-result-entry">${entry}</div>`)
    .join("");
}

async function renderToolResultContent(content: unknown): Promise<{ entryCount: number; html: string }> {
  if (typeof content === "string") {
    return { entryCount: 1, html: await renderTextContent(content) };
  }

  const image = renderImageAttachment(content, "Tool result image");
  if (image) {
    return { entryCount: 1, html: image };
  }

  if (Array.isArray(content)) {
    const renderedEntries = (await Promise.all(content.map(renderToolResultEntry))).filter((entry) => entry.length > 0);

    if (renderedEntries.length > 0) {
      return {
        entryCount: renderedEntries.length,
        html: wrapToolResultEntries(renderedEntries),
      };
    }
  }

  const record = asRecord(content);
  if (record && typeof record.type === "string" && record.type === "text" && typeof record.text === "string") {
    return { entryCount: 1, html: await renderTextContent(record.text) };
  }

  if (record && typeof record.text === "string" && record.text.trim().length > 0) {
    return { entryCount: 1, html: await renderTextContent(record.text) };
  }

  return { entryCount: 1, html: `<pre class="tool-payload">${prettyJson(content)}</pre>` };
}

export async function renderToolBlock(
  block: ToolRenderableBlock,
  _relatedToolUse?: ToolUseBlock,
): Promise<string> {
  const payload = getToolPayload(block);

  if (block.kind === "tool_result") {
    const rendered = await renderToolResultContent(block.content);

    return `
      <details class="block tool-result-disclosure">
        <summary>
          ${renderToolDisclosureSummary(rendered.entryCount)}
        </summary>
        <div class="tool-result-panel">
          <div class="tool-shell tool-result-shell">
            ${rendered.html}
          </div>
        </div>
      </details>
    `;
  }

  const patch = extractPatch(payload);
  const diffHtml = patch ? await renderDiffBlock(patch) : null;

  return `
    <div class="block tool-card">
      ${renderToolHeader(block)}
      <div class="tool-shell">
        ${diffHtml ?? ""}
        <pre class="tool-payload">${prettyJson(payload)}</pre>
      </div>
    </div>
  `;
}

export async function renderToolUseBlock(
  block: Extract<ContentBlock, { kind: "tool_use" }>,
  relatedResult?: ToolResultBlock,
): Promise<string> {
  const { colorClass, html: summaryInner } = renderToolCallSummaryInner(block.name, block.input);
  const inlinePreview = await renderInlineToolUsePreview(block, relatedResult);
  const patch = extractPatch(block.input);
  const diffHtml = inlinePreview ? null : patch ? await renderDiffBlock(patch) : null;
  const payloadHtml = inlinePreview ?? `<pre class="tool-payload">${prettyJson(block.input)}</pre>`;

  if (inlinePreview) {
    return `
      <details class="block tool-call-disclosure ${colorClass}" open>
        <summary>${summaryInner}</summary>
        ${payloadHtml}
      </details>
    `;
  }

  return `
    <details class="block tool-call-disclosure ${colorClass}">
      <summary>${summaryInner}</summary>
      <div class="tool-call-panel">
        ${diffHtml ?? ""}
        ${payloadHtml}
      </div>
    </details>
  `;
}
