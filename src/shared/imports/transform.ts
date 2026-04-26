import { basename } from "node:path";

import type { ContentBlock, NormalizedEvent, NormalizedSession, NormalizedThread, RawUploadFile } from "../contracts";
import { encodeClaudeProjectPath } from "../claude/path-utils";
import { codexRelativePathForThread } from "./paths";

type JsonRecord = Record<string, unknown>;

function toJsonLines(records: JsonRecord[]): string {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function eventTimestamp(event: NormalizedEvent, fallback: string): string {
  return event.timestamp ?? fallback;
}

function threadStartedAt(thread: NormalizedThread, session: NormalizedSession): string {
  return thread.startedAt ?? session.root.startedAt ?? new Date().toISOString();
}

function textFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "text":
          return block.text;
        case "thinking":
          return block.text;
        case "tool_result":
          return typeof block.content === "string" ? block.content : JSON.stringify(block.content, null, 2);
        case "tool_use":
          return JSON.stringify({ name: block.name, input: block.input }, null, 2);
        case "raw":
          return JSON.stringify(block.value, null, 2);
      }
    })
    .filter((value) => value.trim().length > 0)
    .join("\n\n");
}

function firstUserMessage(thread: NormalizedThread): string {
  for (const event of thread.events) {
    if (event.role === "user") {
      const text = textFromBlocks(event.blocks).trim();
      if (text) {
        return text.length > 1000 ? `${text.slice(0, 997)}...` : text;
      }
    }
  }

  return "";
}

function dataUrlFromClaudeImage(value: JsonRecord): string | null {
  const source = asRecord(value.source);
  if (!source) return null;

  const url = typeof source.url === "string" ? source.url : null;
  if (url) return url;

  const data = typeof source.data === "string" ? source.data : null;
  const mediaType = typeof source.media_type === "string" ? source.media_type : "image/png";
  return data ? `data:${mediaType};base64,${data}` : null;
}

function codexImageContentFromRaw(value: unknown): JsonRecord | null {
  const record = asRecord(value);
  if (record?.type !== "image") return null;

  const source = asRecord(record.source);
  const imageUrl =
    typeof source?.url === "string"
      ? source.url
      : typeof source?.data === "string"
        ? dataUrlFromClaudeImage(record)
        : null;

  return imageUrl ? { type: "input_image", image_url: imageUrl } : null;
}

function appendTextContent(content: JsonRecord[], type: "input_text" | "output_text", parts: string[]): void {
  const text = parts
    .filter((value) => value.trim().length > 0)
    .join("\n\n");

  if (text) {
    content.push({ type, text });
  }
}

function codexContentFromBlocks(blocks: ContentBlock[], role: "user" | "assistant" | "system"): JsonRecord[] {
  const type = role === "assistant" ? "output_text" : "input_text";
  const content: JsonRecord[] = [];
  const textParts: string[] = [];

  for (const block of blocks) {
    if (block.kind === "raw") {
      const image = codexImageContentFromRaw(block.value);
      if (image) {
        appendTextContent(content, type, textParts);
        textParts.length = 0;
        content.push(image);
        continue;
      }
    }

    textParts.push(textFromBlocks([block]));
  }

  appendTextContent(content, type, textParts);
  return content;
}

function stringifyToolOutput(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function codexRecordsForEvent(event: NormalizedEvent, fallbackTimestamp: string): JsonRecord[] {
  const timestamp = eventTimestamp(event, fallbackTimestamp);

  if (event.displayKind === "thinking") {
    const text = textFromBlocks(event.blocks).trim();
    return text
      ? [
          {
            timestamp,
            type: "response_item",
            payload: { type: "reasoning", summary: [{ type: "summary_text", text }] },
          },
        ]
      : [];
  }

  if (event.displayKind === "tool_use") {
    return event.blocks
      .filter((block): block is Extract<ContentBlock, { kind: "tool_use" }> => block.kind === "tool_use")
      .map((block) => ({
        timestamp,
        type: "response_item",
        payload: {
          type: "function_call",
          call_id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input ?? null),
        },
      }));
  }

  if (event.displayKind === "tool_result") {
    return event.blocks
      .filter((block): block is Extract<ContentBlock, { kind: "tool_result" }> => block.kind === "tool_result")
      .map((block) => ({
        timestamp,
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: block.toolUseId,
          output: stringifyToolOutput(block.content),
        },
      }));
  }

  if (event.displayKind === "message" || event.displayKind === "system") {
    const role = event.role === "assistant" || event.role === "system" ? event.role : "user";
    const content = codexContentFromBlocks(event.blocks, role);

    return content.length > 0
      ? [
          {
            timestamp,
            type: "response_item",
            payload: { type: "message", role, content },
          },
        ]
      : [];
  }

  return [];
}

export function normalizedToCodexRawFiles(session: NormalizedSession, workspace: string): RawUploadFile[] {
  return session.threads.map((thread) => {
    const startedAt = threadStartedAt(thread, session);
    const threadId = thread.kind === "main" ? thread.sessionId : (thread.agentId ?? thread.id);
    const source =
      thread.kind === "sidechain"
        ? {
            subagent: {
              thread_spawn: {
                parent_thread_id: session.root.sessionId,
                depth: 1,
                agent_nickname: null,
                agent_role: null,
              },
            },
          }
        : "agent-thread-import";
    const records: JsonRecord[] = [
      {
        timestamp: startedAt,
        type: "session_meta",
        payload: {
          id: threadId,
          timestamp: startedAt,
          cwd: workspace,
          originator: "agent-thread import",
          source,
          model_provider: "openai",
          cli_version: "agent-thread-import",
          git: thread.gitBranch ? { branch: thread.gitBranch } : undefined,
        },
      },
    ];

    if (session.root.title) {
      records.push({
        timestamp: startedAt,
        type: "event_msg",
        payload: { type: "thread_name_updated", thread_name: session.root.title },
      });
    }

    for (const event of thread.events) {
      records.push(...codexRecordsForEvent(event, startedAt));
    }

    const relativePath = codexRelativePathForThread({
      ...thread,
      startedAt,
    });

    return {
      threadId: thread.id,
      kind: thread.kind,
      fileName: basename(relativePath),
      relativePath,
      content: toJsonLines(records),
    };
  });
}

function claudeBlockFromBlock(block: ContentBlock): JsonRecord {
  switch (block.kind) {
    case "text":
      return { type: "text", text: block.text };
    case "thinking":
      return { type: "thinking", thinking: block.text, signature: block.signature };
    case "tool_use":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input, caller: block.caller };
    case "tool_result":
      return { type: "tool_result", tool_use_id: block.toolUseId, content: block.content };
    case "raw":
      return claudeBlockFromRaw(block.value) ?? { type: "text", text: JSON.stringify(block.value, null, 2) };
  }
}

function claudeBlockFromRaw(value: unknown): JsonRecord | null {
  const record = asRecord(value);
  if (record?.type !== "image") return null;

  const source = asRecord(record.source);
  if (!source) return null;

  if (source.type === "base64" && typeof source.data === "string") {
    return {
      ...record,
      type: "image",
      source: {
        type: "base64",
        media_type: typeof source.media_type === "string" ? source.media_type : "image/png",
        data: source.data,
      },
    };
  }

  const url = typeof source.url === "string" ? source.url : null;
  const match = url?.match(/^data:([^;,]+);base64,(.*)$/);
  if (match) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: match[1],
        data: match[2],
      },
    };
  }

  if (url) {
    return { type: "image", source: { type: "url", url } };
  }

  return null;
}

function claudeRecordForEvent(
  event: NormalizedEvent,
  thread: NormalizedThread,
  session: NormalizedSession,
  workspace: string,
  fallbackTimestamp: string,
): JsonRecord | null {
  if (event.displayKind === "meta" || event.displayKind === "snapshot") {
    return null;
  }

  const timestamp = eventTimestamp(event, fallbackTimestamp);
  const base = {
    uuid: event.id || crypto.randomUUID(),
    parentUuid: event.parentId,
    timestamp,
    sessionId: session.root.sessionId,
    cwd: workspace,
    gitBranch: thread.gitBranch ?? session.root.gitBranch,
    isSidechain: thread.kind === "sidechain",
    agentId: thread.agentId,
  };

  if (event.displayKind === "system" || event.role === "system") {
    return {
      ...base,
      type: "system",
      content: textFromBlocks(event.blocks),
    };
  }

  const role =
    event.displayKind === "tool_result"
      ? "user"
      : event.displayKind === "tool_use" || event.displayKind === "thinking"
        ? "assistant"
        : event.role === "assistant"
          ? "assistant"
          : "user";
  const content = event.blocks.map((block) => claudeBlockFromBlock(block));

  if (content.length === 0) {
    return null;
  }

  // User content: Claude Code expects a string for plain text messages.
  const userContent =
    role === "user" && content.length === 1 && content[0]?.type === "text"
      ? (content[0] as { type: string; text: string }).text
      : content;

  // Model: strip non-Claude model names so Claude Code doesn't reject the session.
  const model = typeof event.meta.model === "string" && event.meta.model.startsWith("claude-") ? event.meta.model : null;

  return {
    ...base,
    type: role,
    message:
      role === "user"
        ? { role, content: userContent }
        : {
            type: "message",
            role,
            content,
            model,
            stop_reason: event.meta.stopReason ?? null,
            usage: event.meta.usage ?? null,
          },
  };
}

function chainRecords(records: JsonRecord[]): JsonRecord[] {
  let lastUuid: string | null = null;

  return records.map((record) => {
    const uuid = (record.uuid as string) || crypto.randomUUID();
    const chained = record.parentUuid == null && lastUuid != null ? { ...record, uuid, parentUuid: lastUuid } : { ...record, uuid };
    lastUuid = uuid;
    return chained;
  });
}

// Merge consecutive same-role records so there are no back-to-back assistant/user turns,
// which the Claude API rejects. Codex emits thinking, text, and tool_use as separate
// events; Claude Code stores them as one response with multiple content blocks.
function mergeConsecutiveSameRole(records: JsonRecord[]): JsonRecord[] {
  const merged: JsonRecord[] = [];

  for (const record of records) {
    const last = merged[merged.length - 1];
    const lastType = last?.type as string | undefined;
    const currType = record.type as string;

    if (last && lastType === currType && (currType === "assistant" || currType === "user")) {
      const lastMsg = last.message as JsonRecord;
      const currMsg = record.message as JsonRecord;
      const lastContent = Array.isArray(lastMsg.content) ? (lastMsg.content as JsonRecord[]) : [];
      const currContent = Array.isArray(currMsg.content)
        ? (currMsg.content as JsonRecord[])
        : typeof currMsg.content === "string"
          ? [{ type: "text", text: currMsg.content }]
          : [];
      lastMsg.content = [...lastContent, ...currContent];
      if (!lastMsg.model && currMsg.model) {
        lastMsg.model = currMsg.model;
      }
    } else {
      merged.push({ ...record, message: { ...(record.message as JsonRecord) } });
    }
  }

  return merged;
}

const UUID4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toUuid4Map(events: NormalizedSession["threads"][0]["events"]): Map<string, string> {
  const map = new Map<string, string>();
  for (const event of events) {
    if (event.id) {
      map.set(event.id, UUID4_RE.test(event.id) ? event.id : crypto.randomUUID());
    }
  }
  return map;
}

export function normalizedToClaudeRawFiles(session: NormalizedSession, workspace: string): RawUploadFile[] {
  const projectKey = encodeClaudeProjectPath(workspace);

  return session.threads.map((thread) => {
    const startedAt = threadStartedAt(thread, session);
    const fileName = thread.kind === "main" ? `${session.root.sessionId}.jsonl` : `agent-${thread.agentId ?? thread.id}.jsonl`;
    const idMap = toUuid4Map(thread.events);
    const records = chainRecords(
      mergeConsecutiveSameRole(
        thread.events
          .map((event): JsonRecord | null => {
            const record = claudeRecordForEvent(event, thread, session, workspace, startedAt);
            if (!record) return null;
            const uuid = idMap.get(event.id) ?? crypto.randomUUID();
            const parentUuid = event.parentId ? (idMap.get(event.parentId) ?? null) : null;
            return { ...record, uuid, parentUuid };
          })
          .filter((record): record is JsonRecord => record !== null),
      ),
    );

    if (records.length === 0) {
      records.push({
        uuid: crypto.randomUUID(),
        timestamp: startedAt,
        type: "user",
        sessionId: session.root.sessionId,
        cwd: workspace,
        gitBranch: thread.gitBranch ?? session.root.gitBranch,
        message: {
          role: "user",
          content: [{ type: "text", text: firstUserMessage(thread) || session.root.title || "Imported thread" }],
        },
      });
    }

    return {
      threadId: thread.id,
      kind: thread.kind,
      fileName,
      relativePath: `${projectKey}/${fileName}`,
      content: toJsonLines(records),
    };
  });
}

export function retargetClaudeRawFiles(rawFiles: RawUploadFile[], workspace: string): RawUploadFile[] {
  return rawFiles.map((file) => ({
    ...file,
    content: file.content
      .split(/\r?\n/)
      .map((line) => {
        if (!line.trim()) return "";
        const parsed = asRecord(JSON.parse(line));
        if (parsed) {
          parsed.cwd = workspace;
        }
        return JSON.stringify(parsed ?? JSON.parse(line));
      })
      .filter(Boolean)
      .join("\n")
      .concat("\n"),
  }));
}

export function retargetCodexRawFiles(rawFiles: RawUploadFile[], workspace: string): RawUploadFile[] {
  return rawFiles.map((file) => ({
    ...file,
    content: file.content
      .split(/\r?\n/)
      .map((line) => {
        if (!line.trim()) return "";
        const parsed = asRecord(JSON.parse(line));
        const payload = asRecord(parsed?.payload);
        if (parsed?.type === "session_meta" && payload) {
          payload.cwd = workspace;
        }
        if (parsed?.type === "turn_context" && payload) {
          payload.cwd = workspace;
        }
        return JSON.stringify(parsed ?? JSON.parse(line));
      })
      .filter(Boolean)
      .join("\n")
      .concat("\n"),
  }));
}
