import { ImageAttachment } from "./image-attachment";
import { TextContent } from "./text-content";
import type { ToolResultBlock } from "@/src/worker/view/tool-inline";
import { getRenderableImage } from "@/src/worker/view/attachments";
import { prettyJson } from "@/src/worker/view/utils";

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

async function ToolResultEntry({ entry }: { entry: unknown }) {
  if (typeof entry === "string") {
    return <TextContent text={entry} />;
  }
  if (getRenderableImage(entry)) {
    return <ImageAttachment value={entry} alt="Tool result image" />;
  }
  const record = asRecord(entry);
  const text = getTextFromRecord(record);
  if (text) return <TextContent text={text} />;
  return <pre className="tool-payload">{prettyJson(entry)}</pre>;
}

async function ToolResultContent({ content }: { content: unknown }) {
  if (typeof content === "string") {
    return <TextContent text={content} />;
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
  if (text) return <TextContent text={text} />;
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
        <span className="tool-result-summary-chip">
          <span className="tool-result-arrow" aria-hidden="true">▸</span>
          <span className="tool-result-summary-copy">
            <span className="tool-result-summary-label">Tool output</span>
            <span className="tool-result-summary-count">{countLabel}</span>
          </span>
        </span>
      </summary>
      <div className="tool-result-panel">
        <div className="tool-shell tool-result-shell">
          <ToolResultContent content={block.content} />
        </div>
      </div>
    </details>
  );
}
