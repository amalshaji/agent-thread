import type {
  ContentBlock,
  NormalizedEvent,
  NormalizedEventDisplayKind,
} from "../contracts";
import type { ClaudeEvent, ClaudeMessageBlock, JsonValue } from "./types";

const LOCAL_COMMAND_PREFIXES = ["<local-command-caveat>", "<command-name>", "<local-command-stdout>"];

function extractToolResultPreview(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry && typeof entry === "object" && "text" in entry) {
        const text = (entry as { text?: unknown }).text;
        if (typeof text === "string" && text.trim().length > 0) {
          return text.trim();
        }
      }
    }
  }

  return null;
}

function isLocalCommandText(text: string): boolean {
  return LOCAL_COMMAND_PREFIXES.some((prefix) => text.startsWith(prefix));
}

function hasLocalCommandBlocks(blocks: ContentBlock[]): boolean {
  return blocks.some((block) => block.kind === "text" && isLocalCommandText(block.text.trim()));
}

export function firstTextBlock(blocks: ContentBlock[]): string | null {
  for (const block of blocks) {
    if (block.kind === "text" && block.text.trim().length > 0) {
      return block.text.trim();
    }

    if (block.kind === "thinking" && block.text.trim().length > 0) {
      return block.text.trim();
    }

    if (block.kind === "tool_result") {
      const candidate = extractToolResultPreview(block.content);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

export function extractTitleCandidate(blocks: ContentBlock[]): string | null {
  const text = firstTextBlock(blocks);

  if (!text) {
    return null;
  }

  if (
    isLocalCommandText(text)
  ) {
    return null;
  }

  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function normalizeContentBlocks(rawContent: unknown): ContentBlock[] {
  if (typeof rawContent === "string") {
    return rawContent.length > 0 ? [{ kind: "text", text: rawContent }] : [];
  }

  if (!Array.isArray(rawContent)) {
    return [];
  }

  return rawContent.map((entry) => {
    const block = entry as ClaudeMessageBlock;

    switch (block.type) {
      case "text":
        return { kind: "text", text: block.text ?? "" };
      case "thinking":
        return {
          kind: "thinking",
          text: block.thinking ?? "",
          signature: block.signature,
        };
      case "tool_use":
        return {
          kind: "tool_use",
          id: block.id ?? "",
          name: block.name ?? "unknown",
          input: block.input,
          caller: block.caller,
        };
      case "tool_result":
        return {
          kind: "tool_result",
          toolUseId: block.tool_use_id,
          content: block.content,
        };
      default:
        return { kind: "raw", value: entry as JsonValue };
    }
  });
}

function deriveDisplayKind(event: ClaudeEvent, blocks: ContentBlock[]): NormalizedEventDisplayKind {
  if (event.type === "file-history-snapshot") {
    return "snapshot";
  }

  if (event.isMeta || event.subtype === "local_command" || hasLocalCommandBlocks(blocks)) {
    return "meta";
  }

  if (event.type === "system") {
    return "system";
  }

  if (blocks.some((block) => block.kind === "tool_result")) {
    return "tool_result";
  }

  if (blocks.some((block) => block.kind === "tool_use")) {
    return "tool_use";
  }

  if (blocks.some((block) => block.kind === "thinking") && !blocks.some((block) => block.kind === "text")) {
    return "thinking";
  }

  return "message";
}

export function normalizeClaudeEvent(event: ClaudeEvent, seq: number): NormalizedEvent {
  const blocks =
    event.type === "system"
      ? normalizeContentBlocks(event.content ?? "")
      : normalizeContentBlocks(event.message?.content ?? event.toolUseResult);

  const displayKind = deriveDisplayKind(event, blocks);
  const textPreview = firstTextBlock(blocks);
  const role = displayKind === "meta" ? null : event.message?.role ?? (event.type === "system" ? "system" : null);

  return {
    id: event.uuid ?? `event-${seq}`,
    parentId: event.parentUuid ?? null,
    seq,
    timestamp: event.timestamp ?? null,
    topLevelType: event.type ?? "unknown",
    role,
    displayKind,
    blocks,
    textPreview,
    flags: {
      isMeta: event.isMeta === true,
      isSidechain: event.isSidechain === true,
    },
    refs: {
      promptId: event.promptId,
      requestId: event.requestId,
      sourceToolAssistantUUID: event.sourceToolAssistantUUID,
    },
    meta: {
      cwd: event.cwd,
      gitBranch: event.gitBranch,
      version: event.version,
      userType: event.userType,
      entrypoint: event.entrypoint,
      subtype: event.subtype,
      level: event.level,
      model: event.message?.model,
      stopReason: event.message?.stop_reason,
      usage: event.message?.usage,
      snapshot: event.snapshot,
    },
  };
}
