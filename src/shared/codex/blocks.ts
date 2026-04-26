import type {
  ContentBlock,
  NormalizedEvent,
  NormalizedEventDisplayKind,
} from "../contracts";
import type { CodexRecord, CodexTranscriptSummary, JsonValue } from "./types";

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeCodexImage(value: unknown): ContentBlock {
  const url = asString(asRecord(value)?.image_url);
  const mediaType = url?.match(/^data:([^;,]+)[;,]/)?.[1] ?? "image/*";

  if (url) {
    return {
      kind: "raw",
      value: {
        type: "image",
        source: {
          url,
          media_type: mediaType,
        },
      },
    };
  }

  return { kind: "raw", value: value as JsonValue };
}

export function normalizeCodexContentBlocks(rawContent: unknown): ContentBlock[] {
  if (typeof rawContent === "string") {
    return rawContent.length > 0 ? [{ kind: "text", text: rawContent }] : [];
  }

  if (!Array.isArray(rawContent)) {
    return [];
  }

  return rawContent.map((entry) => {
    const block = asRecord(entry);

    switch (block?.type) {
      case "input_text":
      case "output_text":
        return { kind: "text", text: asString(block.text) ?? "" };
      case "input_image":
        return normalizeCodexImage(block);
      default:
        return { kind: "raw", value: entry as JsonValue };
    }
  });
}

function firstTextBlock(blocks: ContentBlock[]): string | null {
  for (const block of blocks) {
    if (block.kind === "text" && block.text.trim().length > 0) {
      return block.text.trim();
    }

    if (block.kind === "thinking" && block.text.trim().length > 0) {
      return block.text.trim();
    }

    if (block.kind === "tool_result" && typeof block.content === "string" && block.content.trim()) {
      return block.content.trim();
    }
  }

  return null;
}

export function extractTitleCandidate(blocks: ContentBlock[]): string | null {
  const text = firstTextBlock(blocks);

  if (!text || isSetupUserMessage(blocks)) {
    return null;
  }

  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function isSetupUserMessage(blocks: ContentBlock[]): boolean {
  const text = blocks
    .filter((block): block is Extract<ContentBlock, { kind: "text" }> => block.kind === "text")
    .map((block) => block.text.trim())
    .join("\n")
    .trim();

  return (
    text.startsWith("# AGENTS.md instructions") ||
    text.startsWith("<environment_context>") ||
    text.includes("<environment_context>")
  );
}

function buildEvent(
  row: CodexRecord,
  seq: number,
  transcript: CodexTranscriptSummary,
  config: {
    id?: string;
    role?: NormalizedEvent["role"];
    displayKind: NormalizedEventDisplayKind;
    blocks: ContentBlock[];
    isMeta?: boolean;
    model?: string | null;
    subtype?: string;
    callId?: string;
  },
): NormalizedEvent {
  const payload = asRecord(row.payload);

  return {
    id: config.id ?? `${transcript.threadId}-${seq}`,
    parentId: null,
    seq,
    timestamp: row.timestamp ?? null,
    topLevelType: `${row.type ?? "unknown"}${payload?.type ? `.${String(payload.type)}` : ""}`,
    role: config.role ?? null,
    displayKind: config.displayKind,
    blocks: config.blocks,
    textPreview: firstTextBlock(config.blocks),
    flags: {
      isMeta: config.isMeta === true,
      isSidechain: transcript.kind === "sidechain",
    },
    refs: {
      requestId: config.callId,
    },
    meta: {
      cwd: transcript.cwd ?? undefined,
      gitBranch: transcript.gitBranch ?? undefined,
      version: transcript.cliVersion ?? undefined,
      entrypoint: "codex",
      subtype: config.subtype,
      model: config.model ?? transcript.model ?? undefined,
    },
  };
}

function reasoningBlocks(payload: RecordValue): ContentBlock[] {
  const summary = Array.isArray(payload.summary) ? payload.summary : [];
  const text = summary
    .map((entry) => asString(asRecord(entry)?.text))
    .filter((value): value is string => Boolean(value && value.trim()))
    .join("\n\n");

  return text ? [{ kind: "thinking", text }] : [];
}

function normalizeResponseItem(
  row: CodexRecord,
  payload: RecordValue,
  seq: number,
  transcript: CodexTranscriptSummary,
): NormalizedEvent | null {
  const responseType = asString(payload.type);

  switch (responseType) {
    case "message": {
      const role = asString(payload.role);
      if (role === "developer") {
        return null;
      }

      const blocks = normalizeCodexContentBlocks(payload.content);
      if (role === "user" && isSetupUserMessage(blocks)) {
        return null;
      }

      if (role !== "user" && role !== "assistant" && role !== "system") {
        return null;
      }

      return buildEvent(row, seq, transcript, {
        role,
        displayKind: "message",
        blocks,
        model: transcript.model,
      });
    }

    case "reasoning": {
      const blocks = reasoningBlocks(payload);
      if (blocks.length === 0) {
        return null;
      }

      return buildEvent(row, seq, transcript, {
        displayKind: "thinking",
        blocks,
        role: "assistant",
      });
    }

    case "function_call": {
      const callId = asString(payload.call_id) ?? `${transcript.threadId}-${seq}`;
      const name = asString(payload.name) ?? "function_call";
      const args = asString(payload.arguments);

      return buildEvent(row, seq, transcript, {
        id: `${callId}:call`,
        role: "assistant",
        displayKind: "tool_use",
        blocks: [{ kind: "tool_use", id: callId, name, input: args ? parseJsonString(args) : null }],
        callId,
      });
    }

    case "function_call_output": {
      const callId = asString(payload.call_id);

      return buildEvent(row, seq, transcript, {
        id: callId ? `${callId}:output` : undefined,
        role: "assistant",
        displayKind: "tool_result",
        blocks: [{ kind: "tool_result", toolUseId: callId ?? undefined, content: payload.output }],
        callId: callId ?? undefined,
      });
    }

    case "custom_tool_call": {
      const callId = asString(payload.call_id) ?? `${transcript.threadId}-${seq}`;
      const name = asString(payload.name) ?? "custom_tool";

      return buildEvent(row, seq, transcript, {
        id: `${callId}:call`,
        role: "assistant",
        displayKind: "tool_use",
        blocks: [{ kind: "tool_use", id: callId, name, input: payload.input }],
        callId,
      });
    }

    case "custom_tool_call_output":
    case "tool_search_output": {
      const callId = asString(payload.call_id);

      return buildEvent(row, seq, transcript, {
        id: callId ? `${callId}:output` : undefined,
        role: "assistant",
        displayKind: "tool_result",
        blocks: [{ kind: "tool_result", toolUseId: callId ?? undefined, content: payload.output ?? payload.tools ?? payload }],
        callId: callId ?? undefined,
      });
    }

    case "web_search_call": {
      const callId = asString(payload.call_id) ?? `${transcript.threadId}-${seq}`;

      return buildEvent(row, seq, transcript, {
        id: `${callId}:call`,
        role: "assistant",
        displayKind: "tool_use",
        blocks: [{ kind: "tool_use", id: callId, name: "web_search", input: payload.action ?? payload }],
        callId,
      });
    }

    case "tool_search_call": {
      const callId = asString(payload.call_id) ?? `${transcript.threadId}-${seq}`;

      return buildEvent(row, seq, transcript, {
        id: `${callId}:call`,
        role: "assistant",
        displayKind: "tool_use",
        blocks: [{ kind: "tool_use", id: callId, name: "tool_search", input: payload.arguments ?? payload }],
        callId,
      });
    }

    default:
      return null;
  }
}

function normalizeEventMessage(
  row: CodexRecord,
  payload: RecordValue,
  seq: number,
  transcript: CodexTranscriptSummary,
): NormalizedEvent | null {
  const eventType = asString(payload.type);

  if (eventType === "error") {
    return buildEvent(row, seq, transcript, {
      role: "system",
      displayKind: "system",
      blocks: normalizeCodexContentBlocks(payload.message ?? "Codex reported an error."),
      subtype: eventType,
    });
  }

  if (eventType === "turn_aborted") {
    const reason = asString(payload.reason);
    return buildEvent(row, seq, transcript, {
      displayKind: "meta",
      blocks: [{ kind: "text", text: reason ? `Turn aborted: ${reason}` : "Turn aborted." }],
      isMeta: true,
      subtype: eventType,
    });
  }

  if (eventType === "context_compacted") {
    return buildEvent(row, seq, transcript, {
      displayKind: "meta",
      blocks: [{ kind: "text", text: "Context compacted." }],
      isMeta: true,
      subtype: eventType,
    });
  }

  return null;
}

export function normalizeCodexRecord(
  row: CodexRecord,
  seq: number,
  transcript: CodexTranscriptSummary,
): NormalizedEvent | null {
  const payload = asRecord(row.payload);
  if (!payload) {
    return null;
  }

  if (row.type === "response_item") {
    return normalizeResponseItem(row, payload, seq, transcript);
  }

  if (row.type === "event_msg") {
    return normalizeEventMessage(row, payload, seq, transcript);
  }

  return null;
}
