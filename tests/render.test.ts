import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToReadableStream } from "react-dom/server";

import type { NormalizedEvent, NormalizedSession, NormalizedThread } from "../src/shared/contracts";
import { resetDiffBudget } from "../lib/transcript/diff";
import { getToolMeta } from "../lib/transcript/tool-inline";
import { buildCursorHref, parseTranscriptCursor, sliceSessionForEventPage } from "../lib/transcript/pagination";
import { buildSessionEventsResponse } from "../lib/transcript/events-response";
import { Thread } from "../components/transcript/thread";
import { ImportCard } from "../components/transcript/import-card";

async function renderThread(thread: NormalizedThread, showHeader = false): Promise<string> {
  resetDiffBudget();
  const stream = await renderToReadableStream(
    createElement(Thread, { thread, showHeader }),
  );
  await stream.allReady;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function mainThread(session: NormalizedSession): NormalizedThread {
  const t = session.threads.find((t) => t.kind === "main") ?? session.threads[0];
  if (!t) throw new Error("no thread");
  return t;
}

function textEvent(seq: number): NormalizedEvent {
  return {
    id: `event-${seq}`,
    parentId: null,
    seq,
    timestamp: `2026-03-27T00:${String(seq).padStart(2, "0")}:00.000Z`,
    topLevelType: "message",
    role: seq % 2 === 0 ? "user" : "assistant",
    displayKind: "message",
    blocks: [{ kind: "text", text: `event ${seq}` }],
    textPreview: `event ${seq}`,
    flags: { isMeta: false, isSidechain: false },
    refs: {},
    meta: {},
  };
}

function eventPageSession(count: number): NormalizedSession {
  const events = Array.from({ length: count }, (_entry, index) => textEvent(index));

  return {
    schemaVersion: 1,
    source: "codex",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "paginated-session",
      projectKey: "paginated-project",
      projectPath: "/tmp/project",
      title: "Pagination",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-pagination",
        kind: "main",
        sessionId: "paginated-session",
        agentId: null,
        sourceFileName: "paginated.jsonl",
        sourceRelativePath: "sessions/2026/03/27/paginated.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: events.map((event) => event.id),
        events,
      },
    ],
    stats: { threadCount: 1, eventCount: count, messageCount: count, sidechainCount: 0 },
  };
}

function sessionEnv(session: NormalizedSession | null): { DB: D1Database; SESSIONS_BUCKET: R2Bucket } {
  const db = {
    prepare: () => ({
      bind: () => ({
        first: async () =>
          session
            ? {
                id: "upload-1",
                public_id: "abc123",
                source: session.source,
                session_id: session.root.sessionId,
                project_key: session.root.projectKey,
                title: session.root.title,
                project_path: session.root.projectPath,
                raw_prefix: "raw/codex/upload-1",
                normalized_key: "normalized/upload-1.json",
                event_count: session.stats.eventCount,
                thread_count: session.stats.threadCount,
                created_at: "2026-03-27T00:00:00.000Z",
              }
            : null,
      }),
    }),
  };
  const bucket = {
    get: async (key: string) =>
      session && key === "normalized/upload-1.json"
        ? { json: async () => session }
        : null,
    list: async () => ({ objects: [], truncated: false }),
  };

  return { DB: db as unknown as D1Database, SESSIONS_BUCKET: bucket as unknown as R2Bucket };
}

test("renders transcript event slices for infinite scrolling", async () => {
  const response = await buildSessionEventsResponse(sessionEnv(eventPageSession(125)), "abc123", "120");
  const payload = await response.json() as { html: string; page: { cursor: number; nextCursor: number | null; startEventNumber: number; endEventNumber: number } };

  expect(response.status).toBe(200);
  expect(payload.page.cursor).toBe(120);
  expect(payload.page.startEventNumber).toBe(121);
  expect(payload.page.endEventNumber).toBe(125);
  expect(payload.page.nextCursor).toBeNull();
  expect(payload.html).toContain("event 120");
  expect(payload.html).not.toContain("event 0");
});

test("sanitizes invalid transcript event cursors to the first slice", async () => {
  const response = await buildSessionEventsResponse(sessionEnv(eventPageSession(3)), "abc123", "not-a-number");
  const payload = await response.json() as { html: string; page: { cursor: number; nextCursor: number | null } };

  expect(response.status).toBe(200);
  expect(payload.page.cursor).toBe(0);
  expect(payload.page.nextCursor).toBeNull();
  expect(payload.html).toContain("event 0");
});

test("returns not found for missing transcript event sessions", async () => {
  const response = await buildSessionEventsResponse(sessionEnv(null), "missing", "0");
  const payload = await response.json() as { error: string };

  expect(response.status).toBe(404);
  expect(payload.error).toBe("Session not found.");
});

test("slices large transcript pages without changing full session stats", () => {
  const session = eventPageSession(5);
  const first = sliceSessionForEventPage(session, 0, 2);
  const second = sliceSessionForEventPage(session, 2, 2);
  const oversized = sliceSessionForEventPage(session, 99, 2);

  expect(first.session.stats.eventCount).toBe(5);
  expect(first.session.threads[0]?.events.map((event) => event.id)).toEqual(["event-0", "event-1"]);
  expect(first.startEventNumber).toBe(1);
  expect(first.endEventNumber).toBe(2);
  expect(first.previousCursor).toBeNull();
  expect(first.nextCursor).toBe(2);

  expect(second.session.threads[0]?.events.map((event) => event.id)).toEqual(["event-2", "event-3"]);
  expect(second.previousCursor).toBe(0);
  expect(second.nextCursor).toBe(4);

  expect(oversized.cursor).toBe(4);
  expect(oversized.session.threads[0]?.events.map((event) => event.id)).toEqual(["event-4"]);
  expect(oversized.nextCursor).toBeNull();
});

test("builds stable transcript cursor links", () => {
  expect(parseTranscriptCursor(undefined)).toBe(0);
  expect(parseTranscriptCursor("-10")).toBe(0);
  expect(parseTranscriptCursor("240")).toBe(240);
  expect(parseTranscriptCursor(["360"])).toBe(360);
  expect(buildCursorHref("abc123", 0, "event-1")).toBe("/t/abc123#event-1");
  expect(buildCursorHref("abc123", 120, "event-2")).toBe("/t/abc123?cursor=120#event-2");
});

test("renders a source-locked import command card", async () => {
  const stream = await renderToReadableStream(
    createElement(ImportCard, {
      publicId: "abc123",
      serverUrl: "https://agent-thread.com",
      source: "codex",
    }),
  );
  await stream.allReady;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const html = Buffer.concat(chunks).toString("utf8");

  expect(html).toContain("Import into");
  expect(html).toContain("Codex");
  expect(html).toContain("bunx agent-thread --import https://agent-thread.com/t/abc123");
  expect(html).not.toContain("--to");
});

test("summarizes exec_command tool inputs with a command preview", () => {
  const idealCommand = "find /Users/amalshaji/.codex/sqlite -maxdepth 2 -type f -print";
  const meta = getToolMeta("exec_command", {
    cmd: `  ${idealCommand}\nignored second line`,
  });

  expect(meta.shortName).toBe("exec_command");
  expect(meta.summary).toBe(idealCommand);
  expect(meta.iconPaths).toContain("polyline");

  const truncated = getToolMeta("exec_command", { cmd: "x".repeat(100) });
  expect(truncated.summary.length).toBe(idealCommand.length);
  expect(truncated.summary.endsWith("...")).toBe(true);
});

test("hides empty thinking pre blocks and renders patch diffs", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-1",
      projectKey: "project-1",
      projectPath: "/tmp/project",
      title: "Diff Test",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-1",
        kind: "main",
        sessionId: "session-1",
        agentId: null,
        sourceFileName: "session-1.jsonl",
        sourceRelativePath: "project-1/session-1.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["thinking-1", "tool-1"],
        events: [
          {
            id: "thinking-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "thinking",
            blocks: [{ kind: "thinking", text: "" }],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "tool-1",
            parentId: null,
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [
              {
                kind: "tool_result",
                content:
                  "diff --git a/file.ts b/file.ts\nindex 1111111..2222222 100644\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n",
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 2, messageCount: 2, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain("Thinking was captured without displayable text.");
  expect(html).not.toContain('<details class="block thinking">');
  expect(html).toContain("data-diff");
});

test("renders thinking events in the primary conversation", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "codex",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-thinking",
      projectKey: "project-thinking",
      projectPath: "/tmp/project",
      title: "Thinking Test",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-thinking",
        kind: "main",
        sessionId: "session-thinking",
        agentId: null,
        sourceFileName: "session-thinking.jsonl",
        sourceRelativePath: "project-thinking/session-thinking.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["thinking-1", "assistant-1"],
        events: [
          {
            id: "thinking-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "response_item",
            role: "assistant",
            displayKind: "thinking",
            blocks: [{ kind: "thinking", text: "I should inspect the parser first." }],
            textPreview: "I should inspect the parser first.",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "assistant-1",
            parentId: "thinking-1",
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "response_item",
            role: "assistant",
            displayKind: "message",
            blocks: [{ kind: "text", text: "Done." }],
            textPreview: "Done.",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 2, messageCount: 2, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain('<details class="block thinking">');
  expect(html).toContain("I should inspect the parser first.");
  expect(html).not.toContain("hidden activity");
});

test("renders markdown for user and assistant messages", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-markdown",
      projectKey: "project-markdown",
      projectPath: "/tmp/project",
      title: "Markdown",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-markdown",
        kind: "main",
        sessionId: "session-markdown",
        agentId: null,
        sourceFileName: "session-markdown.jsonl",
        sourceRelativePath: "project-markdown/session-markdown.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["user-markdown", "assistant-markdown"],
        events: [
          {
            id: "user-markdown",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [{ kind: "text", text: "See **bold** and [docs](https://example.com)." }],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "assistant-markdown",
            parentId: null,
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "message",
            blocks: [
              {
                kind: "text",
                text: "### Summary\n\n- one\n- two\n\n```ts\nconst answer = 42;\n```\n\n```diff\ndiff --git a/file.ts b/file.ts\nindex 1111111..2222222 100644\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n```",
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 2, messageCount: 2, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain('class="block markdown"');
  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain('href="https://example.com"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain("<h3>Summary</h3>");
  expect(html).toContain("<ul>");
  expect(html).toContain("const answer = 42;");
  expect(html).toContain("data-diff");
});

test("renders user attachments outside the compact user badge", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-attachments",
      projectKey: "project-attachments",
      projectPath: "/tmp/project",
      title: "Attachment",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-attachments",
        kind: "main",
        sessionId: "session-attachments",
        agentId: null,
        sourceFileName: "session-attachments.jsonl",
        sourceRelativePath: "project-attachments/session-attachments.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["user-attachment-1"],
        events: [
          {
            id: "user-attachment-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [
              { kind: "text", text: "[Image #1] What does this have?" },
              {
                kind: "raw",
                value: {
                  type: "image",
                  source: { type: "base64", media_type: "image/png", data: "Zm9v" },
                },
              },
            ],
            textPreview: "[Image #1] What does this have?",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 1, messageCount: 1, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain('class="msg msg-user"');
  expect(html).toContain('class="block attachment-card attachment-image"');
  expect(html).toContain('class="attachment-image-button"');
  expect(html).toContain('class="attachment-image-content"');
  expect(html).toContain("data-lightbox-src=");
  expect(html).toContain("data-lightbox-alt=");
  expect(html).not.toContain("Raw Block");
});

test("avoids duplicate activity labels and message kind noise", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-2",
      projectKey: "project-2",
      projectPath: "/tmp/project",
      title: "Activity Labels",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-2",
        kind: "main",
        sessionId: "session-2",
        agentId: null,
        sourceFileName: "session-2.jsonl",
        sourceRelativePath: "project-2/session-2.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["user-1", "snapshot-1"],
        events: [
          {
            id: "user-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [{ kind: "text", text: "Hello" }],
            textPreview: "Hello",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "snapshot-1",
            parentId: null,
            seq: 1,
            timestamp: null,
            topLevelType: "file-history-snapshot",
            role: null,
            displayKind: "snapshot",
            blocks: [],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 2, messageCount: 2, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain(">Snapshot<");
  expect(html).toContain("Show 1 hidden activity item");
  expect(html).not.toContain(">unknown<");
});

test("keeps tool calls and results in the assistant lane", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-3",
      projectKey: "project-3",
      projectPath: "/tmp/project",
      title: "Tool Alignment",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-3",
        kind: "main",
        sessionId: "session-3",
        agentId: null,
        sourceFileName: "session-3.jsonl",
        sourceRelativePath: "project-3/session-3.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["tool-use-1", "tool-result-1"],
        events: [
          {
            id: "tool-use-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_use",
            blocks: [{ kind: "tool_use", id: "call-1", name: "Agent", input: { query: "hi" } }],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "tool-result-1",
            parentId: null,
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [{ kind: "tool_result", content: { ok: true } }],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 2, messageCount: 2, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain('class="msg msg-assistant"');
  expect(html).not.toContain('class="message-row lane-system');
  expect(html).not.toContain("Tool Result");
  expect(html).not.toContain(">Tool Call<");
  expect(html).toContain(">Agent<");
  expect(html).toContain('class="block tool-result-disclosure"');
  expect(html).toContain("Tool output");
  expect(html).toContain("1 response");
});

test("renders tool outputs without a separate show-call affordance", async () => {
  const thread: NormalizedThread = {
    id: "thread-tool-link",
    kind: "main",
    sessionId: "session-tool-link",
    agentId: null,
    sourceFileName: "session-tool-link.jsonl",
    sourceRelativePath: "project-tool-link/session-tool-link.jsonl",
    cwd: "/tmp/project",
    gitBranch: "main",
    startedAt: "2026-03-27T00:00:00.000Z",
    rootEventIds: ["tool-use-link", "tool-result-link"],
    events: [
      {
        id: "tool-use-link",
        parentId: null,
        seq: 0,
        timestamp: "2026-03-27T00:00:01.000Z",
        topLevelType: "assistant",
        role: "assistant",
        displayKind: "tool_use",
        blocks: [{ kind: "tool_use", id: "call-linked", name: "Bash", input: { command: "pwd" } }],
        textPreview: null,
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
      {
        id: "tool-result-link",
        parentId: null,
        seq: 1,
        timestamp: "2026-03-27T00:00:02.000Z",
        topLevelType: "assistant",
        role: "assistant",
        displayKind: "tool_result",
        blocks: [{ kind: "tool_result", toolUseId: "call-linked", content: "/tmp/project" }],
        textPreview: null,
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
    ],
  };

  const html = await renderThread(thread);

  expect(html).toContain("Tool output");
  expect(html).not.toContain("Show call");
  expect(html).not.toContain("data-show-tool-call");
});

test("renders generic tool inputs as readable JSON without a nested payload frame", async () => {
  const thread: NormalizedThread = {
    id: "thread-agent-json",
    kind: "main",
    sessionId: "session-agent-json",
    agentId: null,
    sourceFileName: "session-agent-json.jsonl",
    sourceRelativePath: "project-agent-json/session-agent-json.jsonl",
    cwd: "/tmp/project",
    gitBranch: "main",
    startedAt: "2026-03-27T00:00:00.000Z",
    rootEventIds: ["tool-use-agent"],
    events: [
      {
        id: "tool-use-agent",
        parentId: null,
        seq: 0,
        timestamp: "2026-03-27T00:00:01.000Z",
        topLevelType: "assistant",
        role: "assistant",
        displayKind: "tool_use",
        blocks: [
          {
            kind: "tool_use",
            id: "agent-1",
            name: "Agent",
            input: {
              description: "Find Claude Code session storage location",
              subagent_type: "claude-code-guide",
              prompt: "Where are local Claude Code sessions/conversations stored on disk? Include <path>.",
            },
          },
        ],
        textPreview: null,
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
    ],
  };

  const html = await renderThread(thread);

  expect(html).toContain(">Agent<");
  expect(html).toContain('class="tool-payload tool-call-payload"');
  expect(html).not.toContain("tool-call-panel");
  expect(html).toContain("&quot;description&quot;");
  expect(html).toContain("Find Claude Code session storage location");
  expect(html).toContain("&lt;path&gt;");
  expect(html).not.toContain("&amp;quot;description&amp;quot;");
  expect(html).not.toContain("&amp;lt;path&amp;gt;");
});

test("renders structured tool result text as markdown instead of JSON", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-tool-markdown",
      projectKey: "project-tool-markdown",
      projectPath: "/tmp/project",
      title: "Tool Markdown",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-tool-markdown",
        kind: "main",
        sessionId: "session-tool-markdown",
        agentId: null,
        sourceFileName: "session-tool-markdown.jsonl",
        sourceRelativePath: "project-tool-markdown/session-tool-markdown.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["tool-result-markdown"],
        events: [
          {
            id: "tool-result-markdown",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [
              {
                kind: "tool_result",
                content: [{ type: "text", text: "## Result\n\n- one\n- two\n\n```ts\nconst answer = 42;\n```" }],
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 1, messageCount: 1, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain("<h2>Result</h2>");
  expect(html).toContain("<ul>");
  expect(html).toContain("const answer = 42;");
  expect(html).not.toContain("&quot;type&quot;: &quot;text&quot;");
  expect(html).toContain('class="block tool-result-disclosure"');
  expect(html).toContain("Tool output");
  expect(html).toContain("1 response");
});

test("formats JSON string tool results as readable JSON", async () => {
  const thread: NormalizedThread = {
    id: "thread-tool-json-result",
    kind: "main",
    sessionId: "session-tool-json-result",
    agentId: null,
    sourceFileName: "session-tool-json-result.jsonl",
    sourceRelativePath: "project-tool-json-result/session-tool-json-result.jsonl",
    cwd: "/tmp/project",
    gitBranch: "main",
    startedAt: "2026-03-27T00:00:00.000Z",
    rootEventIds: ["tool-result-json"],
    events: [
      {
        id: "tool-result-json",
        parentId: null,
        seq: 0,
        timestamp: "2026-03-27T00:00:01.000Z",
        topLevelType: "response_item.function_call_output",
        role: "assistant",
        displayKind: "tool_result",
        blocks: [
          {
            kind: "tool_result",
            toolUseId: "call-json",
            content: JSON.stringify({
              result: {
                Output: JSON.stringify({ ok: true, items: ["one", "two"] }),
                exitCode: 0,
              },
            }),
          },
        ],
        textPreview: null,
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
    ],
  };

  const html = await renderThread(thread);

  expect(html).toContain('class="tool-payload"');
  expect(html).toContain("&quot;result&quot;: {");
  expect(html).toContain("&quot;Output&quot;: {");
  expect(html).toContain("&quot;ok&quot;: true");
  expect(html).toContain("&quot;items&quot;: [");
  expect(html).not.toContain("\\&quot;ok\\&quot;");
});

test("formats JSON after tool output metadata as readable JSON", async () => {
  const thread: NormalizedThread = {
    id: "thread-tool-output-json-result",
    kind: "main",
    sessionId: "session-tool-output-json-result",
    agentId: null,
    sourceFileName: "session-tool-output-json-result.jsonl",
    sourceRelativePath: "project-tool-output-json-result/session-tool-output-json-result.jsonl",
    cwd: "/tmp/project",
    gitBranch: "main",
    startedAt: "2026-03-27T00:00:00.000Z",
    rootEventIds: ["tool-result-output-json"],
    events: [
      {
        id: "tool-result-output-json",
        parentId: null,
        seq: 0,
        timestamp: "2026-03-27T00:00:01.000Z",
        topLevelType: "response_item.function_call_output",
        role: "assistant",
        displayKind: "tool_result",
        blocks: [
          {
            kind: "tool_result",
            toolUseId: "call-output-json",
            content: [
              "Chunk ID: abc123",
              "Wall time: 0.0000 seconds",
              "Process exited with code 0",
              "Output:",
              "{\"name\":\"agent-thread\",\"scripts\":{\"dev\":\"bun --bun ./node_modules/next/dist/bin/next dev\"}}",
            ].join("\n"),
          },
        ],
        textPreview: null,
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
    ],
  };

  const html = await renderThread(thread);

  expect(html).toContain("Chunk ID: abc123");
  expect(html).toContain("Output:");
  expect(html).toContain("&quot;name&quot;: &quot;agent-thread&quot;");
  expect(html).toContain("&quot;scripts&quot;: {");
  expect(html).toContain("\n  &quot;name&quot;");
});

test("renders structured tool result images as attachments", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-tool-image",
      projectKey: "project-tool-image",
      projectPath: "/tmp/project",
      title: "Tool Image",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-tool-image",
        kind: "main",
        sessionId: "session-tool-image",
        agentId: null,
        sourceFileName: "session-tool-image.jsonl",
        sourceRelativePath: "project-tool-image/session-tool-image.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["tool-result-image"],
        events: [
          {
            id: "tool-result-image",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [
              {
                kind: "tool_result",
                content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "Zm9v" } }],
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 1, messageCount: 1, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain('class="block attachment-card attachment-image"');
  expect(html).toContain('alt="Tool result image"');
  expect(html).not.toContain("&quot;type&quot;: &quot;image&quot;");
  expect(html).toContain('class="block tool-result-disclosure"');
  expect(html).toContain("Tool output");
  expect(html).toContain("1 response");
});

test("groups multiple tool outputs inside one collapsed disclosure", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-tool-multi",
      projectKey: "project-tool-multi",
      projectPath: "/tmp/project",
      title: "Tool Multi",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-tool-multi",
        kind: "main",
        sessionId: "session-tool-multi",
        agentId: null,
        sourceFileName: "session-tool-multi.jsonl",
        sourceRelativePath: "project-tool-multi/session-tool-multi.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["tool-result-multi"],
        events: [
          {
            id: "tool-result-multi",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [
              {
                kind: "tool_result",
                content: [
                  { type: "text", text: "First response" },
                  { type: "text", text: "Second response" },
                ],
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 1, messageCount: 1, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain('class="block tool-result-disclosure"');
  expect(html).toContain("2 responses");
  expect(html).toContain('class="tool-result-entry"');
  expect(html).toContain("First response");
  expect(html).toContain("Second response");
});

test("renders write tool calls inline and hides redundant write results", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-6",
      projectKey: "project-6",
      projectPath: "/tmp/project",
      title: "Write Tool",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-6",
        kind: "main",
        sessionId: "session-6",
        agentId: null,
        sourceFileName: "session-6.jsonl",
        sourceRelativePath: "project-6/session-6.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["tool-use-1", "tool-result-1"],
        events: [
          {
            id: "tool-use-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_use",
            blocks: [
              {
                kind: "tool_use",
                id: "call-1",
                name: "Write",
                input: { file_path: "/tmp/project/Fibonacci.ts", content: "const value = 1;\n" },
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "tool-result-1",
            parentId: null,
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [
              {
                kind: "tool_result",
                toolUseId: "call-1",
                content: "File created successfully at: /tmp/project/Fibonacci.ts",
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 2, messageCount: 2, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain("tool-call-disclosure");
  expect(html).toContain('class="tool-file-preview"');
  expect(html).toContain(">Write<");
  expect(html).toContain(">Fibonacci.ts<");
  expect(html).toContain("const value = 1;");
  expect(html).toContain('class="msg msg-assistant"');
  expect(html).not.toContain(">Tool Call<");
  expect(html).not.toContain("Writing file Fibonacci.ts");
  expect(html).not.toContain("&quot;file_path&quot;");
  expect(html).not.toContain("&quot;content&quot;");
  expect(html).not.toContain("File created successfully at:");
  expect(html).not.toContain('class="block tool-result-disclosure"');
});

test("renders read tool contents inline and hides redundant read results", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-read",
      projectKey: "project-read",
      projectPath: "/tmp/project",
      title: "Read Tool",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-read",
        kind: "main",
        sessionId: "session-read",
        agentId: null,
        sourceFileName: "session-read.jsonl",
        sourceRelativePath: "project-read/session-read.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["tool-use-read", "tool-result-read"],
        events: [
          {
            id: "tool-use-read",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_use",
            blocks: [
              { kind: "tool_use", id: "read-1", name: "Read", input: { file_path: "/tmp/project/app.tsx" } },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "tool-result-read",
            parentId: null,
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [
              {
                kind: "tool_result",
                toolUseId: "read-1",
                content: "export function App() {\n  return <button>Submit</button>;\n}\n",
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 2, messageCount: 2, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain("tool-call-disclosure");
  expect(html).toContain('class="tool-file-preview"');
  expect(html).toContain(">Read<");
  expect(html).toContain(">app.tsx<");
  expect(html).toContain("return");
  expect(html).toContain('class="msg msg-assistant"');
  expect(html).not.toContain("Reading file app.tsx");
  expect(html).not.toContain('class="block tool-result-disclosure"');
});

test("renders edit tool diffs inline and hides redundant edit results", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-7",
      projectKey: "project-7",
      projectPath: "/tmp/project",
      title: "Edit Tool",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-7",
        kind: "main",
        sessionId: "session-7",
        agentId: null,
        sourceFileName: "session-7.jsonl",
        sourceRelativePath: "project-7/session-7.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["tool-use-1", "tool-result-1"],
        events: [
          {
            id: "tool-use-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_use",
            blocks: [
              {
                kind: "tool_use",
                id: "edit-1",
                name: "Edit",
                input: {
                  file_path: "/tmp/project/app.tsx",
                  old_string: "return <button>Submit</button>;",
                  new_string: "return <button>Publish changes</button>;",
                },
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "tool-result-1",
            parentId: null,
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [
              {
                kind: "tool_result",
                toolUseId: "edit-1",
                content: "diff --git a/app.tsx b/app.tsx\nindex 1111111..2222222 100644\n--- a/app.tsx\n+++ b/app.tsx\n@@ -1 +1 @@\n-return <button>Submit</button>;\n+return <button>Publish changes</button>;\n",
              },
            ],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 2, messageCount: 2, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).toContain("tool-call-disclosure");
  expect(html).toContain(">Edit<");
  expect(html).toContain("data-diff");
  expect(html).toContain('class="msg msg-assistant"');
  expect(html).not.toContain("Editing file app.tsx");
  expect(html).not.toContain("&quot;old_string&quot;");
  expect(html).not.toContain("&quot;new_string&quot;");
  expect(html).not.toContain('class="block tool-result-disclosure"');
});

test("renders normalized meta events as hidden activity instead of user bubbles", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-4",
      projectKey: "project-4",
      projectPath: "/tmp/project",
      title: "Meta Event",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-4",
        kind: "main",
        sessionId: "session-4",
        agentId: null,
        sourceFileName: "session-4.jsonl",
        sourceRelativePath: "project-4/session-4.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["meta-1"],
        events: [
          {
            id: "meta-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "user",
            role: null,
            displayKind: "meta",
            blocks: [{ kind: "text", text: "<command-name>/voice</command-name>" }],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 1, messageCount: 0, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));

  expect(html).not.toContain('class="msg msg-user"');
  expect(html).toContain('class="message-row lane-activity event-meta"');
});

test("renders Codex token count as an inline expandable activity bubble", async () => {
  const thread: NormalizedThread = {
    id: "thread-codex-token-count",
    kind: "main",
    sessionId: "session-codex-token-count",
    agentId: null,
    sourceFileName: "session-codex-token-count.jsonl",
    sourceRelativePath: "codex/session-codex-token-count.jsonl",
    cwd: "/tmp/project",
    gitBranch: "main",
    startedAt: "2026-03-27T00:00:00.000Z",
    rootEventIds: ["user-1", "token-1", "user-2"],
    events: [
      {
        id: "user-1",
        parentId: null,
        seq: 0,
        timestamp: "2026-03-27T00:00:01.000Z",
        topLevelType: "response_item.message",
        role: "user",
        displayKind: "message",
        blocks: [{ kind: "text", text: "First user message" }],
        textPreview: "First user message",
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: { entrypoint: "codex" },
      },
      {
        id: "token-1",
        parentId: null,
        seq: 1,
        timestamp: "2026-03-27T00:00:02.000Z",
        topLevelType: "event_msg.token_count",
        role: null,
        displayKind: "meta",
        blocks: [{ kind: "text", text: "Codex token usage" }],
        textPreview: "Codex token usage",
        flags: { isMeta: true, isSidechain: false },
        refs: {},
        meta: {
          entrypoint: "codex",
          subtype: "token_count",
          usage: {
            last: {
              inputTokens: 148552,
              cachedInputTokens: 146816,
              outputTokens: 478,
              reasoningOutputTokens: 24,
              totalTokens: 149030,
            },
            modelContextWindow: 258400,
          },
        },
      },
      {
        id: "user-2",
        parentId: null,
        seq: 2,
        timestamp: "2026-03-27T00:00:03.000Z",
        topLevelType: "response_item.message",
        role: "user",
        displayKind: "message",
        blocks: [{ kind: "text", text: "Second user message" }],
        textPreview: "Second user message",
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: { entrypoint: "codex" },
      },
    ],
  };

  const html = await renderThread(thread);
  const userClusterMatches = html.match(/class="msg msg-user"/g) ?? [];

  expect(userClusterMatches).toHaveLength(2);
  expect(html).toContain('class="codex-token-bubble"');
  expect(html).toContain("Codex token usage");
  expect(html).toMatch(/149,030(?:<!-- -->)? tokens/);
  expect(html).toContain("Cached input");
  expect(html).toContain("258,400");
  expect(html).not.toContain("Show 1 hidden activity item");
});

test("hides legacy local command records from the primary transcript", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-5",
      projectKey: "project-5",
      projectPath: "/tmp/project",
      title: "Legacy Local Command",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-5",
        kind: "main",
        sessionId: "session-5",
        agentId: null,
        sourceFileName: "session-5.jsonl",
        sourceRelativePath: "project-5/session-5.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["user-1", "legacy-command-1", "legacy-stdout-1"],
        events: [
          {
            id: "user-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [{ kind: "text", text: "Hi" }],
            textPreview: "Hi",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "legacy-command-1",
            parentId: "user-1",
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [
              {
                kind: "text",
                text: "<command-name>/voice</command-name>\n            <command-message>voice</command-message>\n            <command-args></command-args>",
              },
            ],
            textPreview: "<command-name>/voice</command-name>",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "legacy-stdout-1",
            parentId: "legacy-command-1",
            seq: 2,
            timestamp: "2026-03-27T00:00:03.000Z",
            topLevelType: "system",
            role: "system",
            displayKind: "system",
            blocks: [{ kind: "text", text: "<local-command-stdout>Voice mode enabled.</local-command-stdout>" }],
            textPreview: "<local-command-stdout>Voice mode enabled.</local-command-stdout>",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: { subtype: "local_command" },
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 3, messageCount: 3, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));
  const userClusterMatches = html.match(/class="msg msg-user"/g) ?? [];
  const activityLaneMatches = html.match(/class="message-row lane-activity\b[^"]*"/g) ?? [];

  expect(html).toContain("Show 2 hidden activity items");
  expect(userClusterMatches).toHaveLength(1);
  expect(activityLaneMatches).toHaveLength(2);
});

test("groups consecutive user and assistant events into role clusters", async () => {
  const session: NormalizedSession = {
    schemaVersion: 1,
    source: "claude-code",
    importedAt: "2026-03-27T00:00:00.000Z",
    root: {
      sessionId: "session-clusters",
      projectKey: "project-clusters",
      projectPath: "/tmp/project",
      title: "Clusters",
      cwd: "/tmp/project",
      gitBranch: "main",
      startedAt: "2026-03-27T00:00:00.000Z",
    },
    threads: [
      {
        id: "thread-clusters",
        kind: "main",
        sessionId: "session-clusters",
        agentId: null,
        sourceFileName: "session-clusters.jsonl",
        sourceRelativePath: "project-clusters/session-clusters.jsonl",
        cwd: "/tmp/project",
        gitBranch: "main",
        startedAt: "2026-03-27T00:00:00.000Z",
        rootEventIds: ["user-1", "assistant-1", "assistant-2", "user-2"],
        events: [
          {
            id: "user-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-03-27T00:00:01.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [{ kind: "text", text: "First prompt" }],
            textPreview: "First prompt",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "assistant-1",
            parentId: null,
            seq: 1,
            timestamp: "2026-03-27T00:00:02.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "message",
            blocks: [{ kind: "text", text: "First reply" }],
            textPreview: "First reply",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "assistant-2",
            parentId: null,
            seq: 2,
            timestamp: "2026-03-27T00:00:03.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_use",
            blocks: [{ kind: "tool_use", id: "call-cluster", name: "Bash", input: { command: "ls" } }],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "user-2",
            parentId: null,
            seq: 3,
            timestamp: "2026-03-27T00:00:04.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [{ kind: "text", text: "Follow-up prompt" }],
            textPreview: "Follow-up prompt",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 4, messageCount: 4, sidechainCount: 0 },
  };

  const html = await renderThread(mainThread(session));
  const userClusterMatches = html.match(/class="msg msg-user"/g) ?? [];
  const assistantClusterMatches = html.match(/class="msg msg-assistant"/g) ?? [];

  expect(userClusterMatches).toHaveLength(2);
  expect(assistantClusterMatches).toHaveLength(1);
  expect(html).toContain("Claude");
  expect(html).toContain(">Bash<");
});

test("groups parallel tool calls with matching outputs", async () => {
  const thread: NormalizedThread = {
    id: "thread-parallel",
    kind: "main",
    sessionId: "session-parallel",
    agentId: null,
    sourceFileName: "session-parallel.jsonl",
    sourceRelativePath: "project-parallel/session-parallel.jsonl",
    cwd: "/tmp/project",
    gitBranch: "main",
    startedAt: "2026-03-27T00:00:00.000Z",
    rootEventIds: ["assistant-1"],
    events: [
      {
        id: "assistant-1",
        parentId: null,
        seq: 0,
        timestamp: "2026-03-27T00:00:01.000Z",
        topLevelType: "assistant",
        role: "assistant",
        displayKind: "message",
        blocks: [{ kind: "text", text: "I will inspect a few files." }],
        textPreview: "I will inspect a few files.",
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
      {
        id: "call-1-event",
        parentId: null,
        seq: 1,
        timestamp: "2026-03-27T00:00:02.000Z",
        topLevelType: "response_item.function_call",
        role: "assistant",
        displayKind: "tool_use",
        blocks: [{ kind: "tool_use", id: "call-1", name: "exec_command", input: { cmd: "pwd" } }],
        textPreview: null,
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
      {
        id: "call-2-event",
        parentId: null,
        seq: 2,
        timestamp: "2026-03-27T00:00:02.000Z",
        topLevelType: "response_item.function_call",
        role: "assistant",
        displayKind: "tool_use",
        blocks: [{ kind: "tool_use", id: "call-2", name: "exec_command", input: { cmd: "ls" } }],
        textPreview: null,
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
      {
        id: "call-1-output",
        parentId: null,
        seq: 3,
        timestamp: "2026-03-27T00:00:03.000Z",
        topLevelType: "response_item.function_call_output",
        role: "assistant",
        displayKind: "tool_result",
        blocks: [{ kind: "tool_result", toolUseId: "call-1", content: "/tmp/project" }],
        textPreview: "/tmp/project",
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
      {
        id: "call-2-output",
        parentId: null,
        seq: 4,
        timestamp: "2026-03-27T00:00:03.000Z",
        topLevelType: "response_item.function_call_output",
        role: "assistant",
        displayKind: "tool_result",
        blocks: [{ kind: "tool_result", toolUseId: "call-2", content: "package.json" }],
        textPreview: "package.json",
        flags: { isMeta: false, isSidechain: false },
        refs: {},
        meta: {},
      },
    ],
  };

  const html = await renderThread(thread);

  expect(html).toContain("Parallel tool calls");
  expect(html).toContain('class="parallel-tool-accordion-icon"');
  expect(html).toMatch(/2(?:<!-- -->)? calls/);
  expect(html).toContain("/tmp/project");
  expect(html).toContain("package.json");
});
