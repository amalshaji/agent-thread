import { ImageAttachment } from "./image-attachment";
import { TextContent } from "./text-content";
import type { ToolResultBlock } from "@/lib/transcript/tool-inline";
import { getRenderableImage } from "@/lib/transcript/attachments";
import { prettyJson } from "@/lib/transcript/utils";

type RecordValue = Record<string, unknown>;
function asRecord(v: unknown): RecordValue | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as RecordValue) : null;
}

function getTextFromRecord(record: RecordValue | null): string | null {
  if (!record) return null;
  if (record.type === "text" && typeof record.text === "string") return record.text;
  if (typeof record.text === "string" && record.text.trim().length > 0) return record.text;
  return null;
}

function parseJsonObjectOrArray(value: string, depth = 0): unknown | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return parseNestedJsonStrings(JSON.parse(trimmed), depth);
  } catch {
    return null;
  }
}

function parseNestedJsonStrings(value: unknown, depth = 0): unknown {
  if (depth >= 4) {
    return value;
  }

  if (typeof value === "string") {
    return parseJsonObjectOrArray(value, depth + 1) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => parseNestedJsonStrings(entry, depth + 1));
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, parseNestedJsonStrings(entry, depth + 1)]),
  );
}

function formatEmbeddedJsonOutput(value: string): string | null {
  const normalized = value.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const outputLineIndex = lines.findLastIndex((line) => line.trim() === "Output:");
  if (outputLineIndex < 0) {
    return null;
  }

  const output = lines.slice(outputLineIndex + 1).join("\n");
  const parsed = parseJsonObjectOrArray(output);
  if (parsed === null) {
    return null;
  }

  return [
    ...lines.slice(0, outputLineIndex + 1),
    prettyJson(parsed),
  ].join("\n");
}

async function ToolResultText({ text }: { text: string }) {
  const parsed = parseJsonObjectOrArray(text);
  if (parsed !== null) {
    return <pre className="tool-payload">{prettyJson(parsed)}</pre>;
  }

  const formattedOutput = formatEmbeddedJsonOutput(text);
  if (formattedOutput !== null) {
    return <pre className="tool-payload">{formattedOutput}</pre>;
  }

  return <TextContent text={text} />;
}

async function ToolResultEntry({ entry }: { entry: unknown }) {
  if (typeof entry === "string") {
    return <ToolResultText text={entry} />;
  }
  if (getRenderableImage(entry)) {
    return <ImageAttachment value={entry} alt="Tool result image" />;
  }
  const record = asRecord(entry);
  const text = getTextFromRecord(record);
  if (text) return <ToolResultText text={text} />;
  return <pre className="tool-payload">{prettyJson(entry)}</pre>;
}

async function ToolResultContent({ content }: { content: unknown }) {
  if (typeof content === "string") {
    return <ToolResultText text={content} />;
  }
  if (getRenderableImage(content)) {
    return <ImageAttachment value={content} alt="Tool result image" />;
  }
  if (Array.isArray(content)) {
    const entries = content.filter((e) => e != null);
    if (entries.length > 0) {
      return (
        <>
          {entries.map((entry, i) => (
            <div key={i} className="tool-result-entry">
              <ToolResultEntry entry={entry} />
            </div>
          ))}
        </>
      );
    }
  }
  const record = asRecord(content);
  const text = getTextFromRecord(record);
  if (text) return <ToolResultText text={text} />;
  return <pre className="tool-payload">{prettyJson(content)}</pre>;
}

function countEntries(content: unknown): number {
  if (Array.isArray(content)) return Math.max(content.length, 1);
  return 1;
}

export async function ToolResultBlockComponent({ block }: { block: ToolResultBlock }) {
  const entryCount = countEntries(block.content);
  const countLabel = entryCount === 1 ? "1 response" : `${entryCount} responses`;

  return (
    <details className="block tool-result-disclosure">
      <summary>
        <span className="toolcall-head-inner">
          <span className="toolcall-chevron tool-result-arrow" aria-hidden="true">▸</span>
          <span className="toolcall-icon tool-output-icon" aria-hidden="true">↳</span>
          <span className="toolcall-name">Tool output</span>
          <span className="toolcall-sep">·</span>
          <span className="toolcall-summary">{countLabel}</span>
        </span>
      </summary>
      <div className="toolcall-body tool-result-panel">
        <div className="toolcall-section">
          <div className="toolcall-section-label">Result</div>
          <div className="tool-shell tool-result-shell">
            <ToolResultContent content={block.content} />
          </div>
        </div>
      </div>
    </details>
  );
}
