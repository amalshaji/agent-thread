import { expect, test } from "bun:test";

import type { NormalizedSession } from "../src/shared/contracts";
import { renderSessionPage } from "../src/worker/render";

test("renderSessionPage hides empty thinking pre blocks and renders patch diffs", async () => {
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
    stats: {
      threadCount: 1,
      eventCount: 2,
      messageCount: 2,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-1", session);

  expect(html).toContain("Thinking was captured without displayable text.");
  expect(html).not.toContain("<details class=\"block thinking\"><summary>Thinking</summary><pre class=\"tool-payload\"></pre></details>");
  expect(html).toContain("data-diff");
  expect(html).toContain("tool-pill");
  expect(html).not.toContain("<details class=\"block tool\">");
  expect(html).toContain("tool-payload");
  expect(html).toContain("data-theme-toggle");
  expect(html).toContain("data-image-lightbox");
});

test("renderSessionPage renders markdown for user and assistant messages", async () => {
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
                text:
                  "### Summary\n\n- one\n- two\n\n```ts\nconst answer = 42;\n```\n\n```diff\ndiff --git a/file.ts b/file.ts\nindex 1111111..2222222 100644\n--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n```",
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
    stats: {
      threadCount: 1,
      eventCount: 2,
      messageCount: 2,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-markdown", session);

  expect(html).toContain('<div class="block markdown">');
  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain('href="https://example.com"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain("<h3>Summary</h3>");
  expect(html).toContain("<ul>");
  expect(html).toContain("const answer = 42;");
  expect(html).toContain("data-diff");
});

test("renderSessionPage renders user attachments outside the compact user badge", async () => {
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
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: "Zm9v",
                  },
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
    stats: {
      threadCount: 1,
      eventCount: 1,
      messageCount: 1,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-attachments", session);

  expect(html).toContain('class="msg msg-user"');
  expect(html).toContain('class="message-bubble bubble-user"');
  expect(html).toContain('class="message-bubble bubble-user-rich"');
  expect(html).toContain('class="block attachment-card attachment-image"');
  expect(html).toContain('class="attachment-image-button"');
  expect(html).toContain('class="attachment-image-content"');
  expect(html).toContain("data-lightbox-src=");
  expect(html).toContain("data-lightbox-alt=");
  expect(html).not.toContain("Raw Block");
});

test("renderSessionPage avoids duplicate activity labels and message kind noise", async () => {
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
    stats: {
      threadCount: 1,
      eventCount: 2,
      messageCount: 2,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-2", session);

  expect(html).toContain(">Snapshot<");
  expect(html).toContain("Show 1 hidden activity item");
  expect(html).not.toContain("Snapshot</span>\n            <span>Snapshot</span>");
  expect(html).not.toContain(">unknown<");
});

test("renderSessionPage keeps tool calls and results in the assistant lane", async () => {
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
    stats: {
      threadCount: 1,
      eventCount: 2,
      messageCount: 2,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-3", session);

  expect(html).toContain('class="msg msg-assistant"');
  expect(html).not.toContain('class="message-row lane-system');
  expect(html).not.toContain("Tool Result");
  expect(html).not.toContain(">Tool Call<");
  expect(html).toContain("Running agent");
  expect(html).toContain('class="block tool-result-disclosure"');
  expect(html).toContain("Tool output");
  expect(html).toContain("1 response");
});

test("renderSessionPage renders structured tool result text as markdown instead of JSON", async () => {
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
                content: [
                  {
                    type: "text",
                    text: "## Result\n\n- one\n- two\n\n```ts\nconst answer = 42;\n```",
                  },
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
    stats: {
      threadCount: 1,
      eventCount: 1,
      messageCount: 1,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-tool-markdown", session);

  expect(html).toContain("<h2>Result</h2>");
  expect(html).toContain("<ul>");
  expect(html).toContain("const answer = 42;");
  expect(html).not.toContain("&quot;type&quot;: &quot;text&quot;");
  expect(html).toContain('class="block tool-result-disclosure"');
  expect(html).toContain("Tool output");
  expect(html).toContain("1 response");
});

test("renderSessionPage renders structured tool result images as attachments", async () => {
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
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: "image/png",
                      data: "Zm9v",
                    },
                  },
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
    stats: {
      threadCount: 1,
      eventCount: 1,
      messageCount: 1,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-tool-image", session);

  expect(html).toContain('class="block attachment-card attachment-image"');
  expect(html).toContain('alt="Tool result image"');
  expect(html).not.toContain("&quot;type&quot;: &quot;image&quot;");
  expect(html).toContain('class="block tool-result-disclosure"');
  expect(html).toContain("Tool output");
  expect(html).toContain("1 response");
});

test("renderSessionPage groups multiple tool outputs inside one collapsed disclosure", async () => {
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
    stats: {
      threadCount: 1,
      eventCount: 1,
      messageCount: 1,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-tool-multi", session);

  expect(html).toContain('class="block tool-result-disclosure"');
  expect(html).toContain("2 responses");
  expect(html).toContain('class="tool-result-entry"');
  expect(html).toContain("First response");
  expect(html).toContain("Second response");
});

test("renderSessionPage renders write tool calls inline and hides redundant write results", async () => {
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
                input: {
                  file_path: "/tmp/project/Fibonacci.ts",
                  content: "const value = 1;\n",
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
    stats: {
      threadCount: 1,
      eventCount: 2,
      messageCount: 2,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-6", session);

  expect(html).toContain('class="block tool-inline-call"');
  expect(html).toContain('class="tool-file-preview"');
  expect(html).toContain("Writing file Fibonacci.ts");
  expect(html).toContain(">Fibonacci.ts<");
  expect(html).toContain("const value = 1;");
  expect(html).toContain('class="msg msg-assistant"');
  expect(html).not.toContain("tool-pill-row-secondary");
  expect(html).not.toContain(">Tool Call<");
  expect(html).not.toContain(">Write<");
  expect(html).not.toContain('<span class="tool-pill tool-pill-call">Fibonacci.ts</span>');
  expect(html).not.toContain('class="block tool-call-disclosure"');
  expect(html).not.toContain("&quot;file_path&quot;");
  expect(html).not.toContain("&quot;content&quot;");
  expect(html).not.toContain("File created successfully at:");
  expect(html).not.toContain('class="block tool-result-disclosure"');
});

test("renderSessionPage renders read tool contents inline and hides redundant read results", async () => {
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
              {
                kind: "tool_use",
                id: "read-1",
                name: "Read",
                input: {
                  file_path: "/tmp/project/app.tsx",
                },
              },
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
    stats: {
      threadCount: 1,
      eventCount: 2,
      messageCount: 2,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-read", session);

  expect(html).toContain('class="block tool-inline-call"');
  expect(html).toContain('class="tool-file-preview"');
  expect(html).toContain("Reading file app.tsx");
  expect(html).toContain(">app.tsx<");
  expect(html).toContain("return &lt;button&gt;Submit&lt;/button&gt;;");
  expect(html).toContain('class="msg msg-assistant"');
  expect(html).not.toContain('class="block tool-call-disclosure"');
  expect(html).not.toContain('class="block tool-result-disclosure"');
});

test("renderSessionPage renders edit tool diffs inline and hides redundant edit results", async () => {
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
                content:
                  "diff --git a/app.tsx b/app.tsx\nindex 1111111..2222222 100644\n--- a/app.tsx\n+++ b/app.tsx\n@@ -1 +1 @@\n-return <button>Submit</button>;\n+return <button>Publish changes</button>;\n",
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
    stats: {
      threadCount: 1,
      eventCount: 2,
      messageCount: 2,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-7", session);

  expect(html).toContain('class="block tool-inline-call"');
  expect(html).toContain("Editing file app.tsx");
  expect(html).toContain("data-diff");
  expect(html).toContain('class="msg msg-assistant"');
  expect(html).not.toContain("&quot;old_string&quot;");
  expect(html).not.toContain("&quot;new_string&quot;");
  expect(html).not.toContain('class="block tool-call-disclosure"');
  expect(html).not.toContain('class="block tool-result-disclosure"');
});

test("renderSessionPage renders normalized meta events as hidden activity instead of user bubbles", async () => {
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
    stats: {
      threadCount: 1,
      eventCount: 1,
      messageCount: 0,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-4", session);

  expect(html).not.toContain('class="message-row lane-user"');
  expect(html).toContain('class="message-row lane-activity event-meta"');
});

test("renderSessionPage hides legacy local command records from the primary transcript", async () => {
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
                text:
                  "<command-name>/voice</command-name>\n            <command-message>voice</command-message>\n            <command-args></command-args>",
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
    stats: {
      threadCount: 1,
      eventCount: 3,
      messageCount: 3,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-5", session);
  const userLaneMatches = html.match(/class="msg msg-user"/g) ?? [];
  const activityLaneMatches = html.match(/class="message-row lane-activity\b[^"]*"/g) ?? [];

  expect(html).toContain("Show 2 hidden activity items");
  expect(userLaneMatches).toHaveLength(1);
  expect(activityLaneMatches).toHaveLength(2);
});

test("renderSessionPage groups consecutive user and assistant events into role clusters", async () => {
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
    stats: {
      threadCount: 1,
      eventCount: 4,
      messageCount: 4,
      sidechainCount: 0,
    },
  };

  const html = await renderSessionPage("public-clusters", session);
  const userClusterMatches = html.match(/class="msg msg-user"/g) ?? [];
  const assistantClusterMatches = html.match(/class="msg msg-assistant"/g) ?? [];

  expect(userClusterMatches).toHaveLength(2);
  expect(assistantClusterMatches).toHaveLength(1);
  expect(html).toContain("Claude");
  expect(html).toContain("Running command");
});
