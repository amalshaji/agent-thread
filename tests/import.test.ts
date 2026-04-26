import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { parseImportRef } from "../src/cli/import";
import type { NormalizedSession, SessionExportBundle } from "../src/shared/contracts";
import { importSessionBundle, normalizedToClaudeRawFiles, normalizedToCodexRawFiles } from "../src/shared/imports";

function hasType(value: unknown, type: string): boolean {
  return Boolean(value && typeof value === "object" && "type" in value && (value as { type?: unknown }).type === type);
}

function sampleSession(source: "claude-code" | "codex" = "claude-code"): NormalizedSession {
  return {
    schemaVersion: 1,
    source,
    importedAt: "2026-04-26T00:00:00.000Z",
    root: {
      sessionId: "session-1",
      projectKey: "project",
      projectPath: "/remote/workspace",
      title: "Import test",
      cwd: "/remote/workspace",
      gitBranch: "main",
      startedAt: "2026-04-26T10:11:12.000Z",
    },
    threads: [
      {
        id: "session-1",
        kind: "main",
        sessionId: "session-1",
        agentId: null,
        sourceFileName: "session-1.jsonl",
        sourceRelativePath: "project/session-1.jsonl",
        cwd: "/remote/workspace",
        gitBranch: "main",
        startedAt: "2026-04-26T10:11:12.000Z",
        rootEventIds: ["user-1", "assistant-1", "thinking-1", "tool-1", "result-1"],
        events: [
          {
            id: "user-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-04-26T10:11:12.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [{ kind: "text", text: "hello" }],
            textPreview: "hello",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "assistant-1",
            parentId: "user-1",
            seq: 1,
            timestamp: "2026-04-26T10:11:13.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "message",
            blocks: [{ kind: "text", text: "hi" }],
            textPreview: "hi",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: { model: "gpt-test" },
          },
          {
            id: "thinking-1",
            parentId: "assistant-1",
            seq: 2,
            timestamp: "2026-04-26T10:11:14.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "thinking",
            blocks: [{ kind: "thinking", text: "reasoning summary" }],
            textPreview: "reasoning summary",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "tool-1",
            parentId: "assistant-1",
            seq: 3,
            timestamp: "2026-04-26T10:11:15.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_use",
            blocks: [{ kind: "tool_use", id: "call-1", name: "exec_command", input: { cmd: "pwd" } }],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "result-1",
            parentId: "tool-1",
            seq: 4,
            timestamp: "2026-04-26T10:11:16.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [{ kind: "tool_result", toolUseId: "call-1", content: "output" }],
            textPreview: "output",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 5, messageCount: 5, sidechainCount: 0 },
  };
}

describe("import ref parsing", () => {
  test("accepts public IDs and thread URLs", () => {
    expect(parseImportRef("abc123", "https://agent-thread.com")).toEqual({
      publicId: "abc123",
      serverUrl: "https://agent-thread.com",
    });
    expect(parseImportRef("https://example.com/t/abc123", "https://agent-thread.com")).toEqual({
      publicId: "abc123",
      serverUrl: "https://example.com",
    });
  });
});

function codexSession(): NormalizedSession {
  // Simulates a Codex session where all parentId values are null (Codex normalizer behaviour)
  return {
    ...sampleSession("codex"),
    root: { ...sampleSession("codex").root, sessionId: "codex-session-1" },
    threads: [
      {
        id: "codex-session-1",
        kind: "main",
        sessionId: "codex-session-1",
        agentId: null,
        sourceFileName: "rollout-codex-session-1.jsonl",
        sourceRelativePath: "2026/04/26/rollout-codex-session-1.jsonl",
        cwd: "/remote/workspace",
        gitBranch: "main",
        startedAt: "2026-04-26T10:11:12.000Z",
        rootEventIds: ["e1"],
        events: [
          {
            id: "e1",
            parentId: null,
            seq: 0,
            timestamp: "2026-04-26T10:11:12.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [{ kind: "text", text: "hello from codex" }],
            textPreview: "hello from codex",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "e2",
            parentId: null,
            seq: 1,
            timestamp: "2026-04-26T10:11:13.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "message",
            blocks: [{ kind: "text", text: "hi from assistant" }],
            textPreview: "hi from assistant",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: { model: "gpt-5.5" },
          },
          {
            id: "e3",
            parentId: null,
            seq: 2,
            timestamp: "2026-04-26T10:11:14.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_use",
            blocks: [{ kind: "tool_use", id: "call-1", name: "exec_command", input: { cmd: "pwd" } }],
            textPreview: null,
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "e4",
            parentId: null,
            seq: 3,
            timestamp: "2026-04-26T10:11:15.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "tool_result",
            blocks: [{ kind: "tool_result", toolUseId: "call-1", content: "/remote/workspace" }],
            textPreview: "/remote/workspace",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: {},
          },
          {
            id: "e5",
            parentId: null,
            seq: 4,
            timestamp: "2026-04-26T10:11:16.000Z",
            topLevelType: "assistant",
            role: "assistant",
            displayKind: "message",
            blocks: [{ kind: "text", text: "done" }],
            textPreview: "done",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: { model: "claude-sonnet-4-6" },
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 5, messageCount: 3, sidechainCount: 0 },
  };
}

function imageSession(source: "claude-code" | "codex", imageValue: unknown): NormalizedSession {
  const session = sampleSession(source);
  const firstEvent = session.threads[0]!.events[0]!;
  firstEvent.blocks = [...firstEvent.blocks, { kind: "raw", value: imageValue }];
  return session;
}

describe("normalizedToClaudeRawFiles (Codex -> Claude transform)", () => {
  test("produces one JSONL file per thread", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    expect(files).toHaveLength(1);
    expect(files[0]!.fileName).toBe("codex-session-1.jsonl");
  });

  test("all records are chained sequentially (parentUuid non-null after first)", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    expect(records.length).toBeGreaterThan(1);
    expect(records[0].parentUuid).toBeNull();

    for (let i = 1; i < records.length; i++) {
      expect(records[i].parentUuid).toBe(records[i - 1].uuid);
    }
  });

  test("user plain-text content is a string not an array (matches native Claude format)", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const userRecord = records.find((r: { type: string }) => r.type === "user");
    expect(typeof userRecord.message.content).toBe("string");
    expect(userRecord.message.content).toBe("hello from codex");
  });

  test("assistant records have message.type='message' (matches native Claude format)", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const assistantRecords = records.filter((r: { type: string }) => r.type === "assistant");
    expect(assistantRecords.length).toBeGreaterThan(0);
    for (const r of assistantRecords) {
      expect(r.message.type).toBe("message");
    }
  });

  test("non-Claude model names are stripped to null", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const assistantWithGpt = records.find(
      (r: { type: string; message: { model?: string } }) => r.type === "assistant" && r.message.model === "gpt-5.5",
    );
    expect(assistantWithGpt).toBeUndefined();

    const withModel = records.find(
      (r: { type: string; message: { model?: string } }) => r.type === "assistant" && r.message.model === "claude-sonnet-4-6",
    );
    expect(withModel?.message.model).toBe("claude-sonnet-4-6");
  });

  test("tool_result events emit type='user' records (native Claude convention)", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const toolResultRecord = records.find(
      (r: { type: string; message?: { content?: unknown[] } }) =>
        r.type === "user" && Array.isArray(r.message?.content) && r.message.content.some((block) => hasType(block, "tool_result")),
    );
    expect(toolResultRecord).toBeDefined();
  });

  test("no consecutive same-role records (Claude API constraint)", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1].type;
      const curr = records[i].type;
      if (prev === "assistant" || prev === "user") {
        expect(curr).not.toBe(prev);
      }
    }
  });

  test("text and tool_use from same turn are merged into one assistant record", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const assistantWithBoth = records.find(
      (r: { type: string; message?: { content?: unknown[] } }) =>
        r.type === "assistant" &&
        Array.isArray(r.message?.content) &&
        r.message.content.some((block) => hasType(block, "text")) &&
        r.message.content.some((block) => hasType(block, "tool_use")),
    );
    expect(assistantWithBoth).toBeDefined();
  });

  test("all uuid and parentUuid values are valid UUID4 format", () => {
    const uuid4Re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    for (const r of records) {
      expect(uuid4Re.test(r.uuid)).toBe(true);
      if (r.parentUuid !== null) {
        expect(uuid4Re.test(r.parentUuid)).toBe(true);
      }
    }
  });

  test("workspace cwd is written into every record", () => {
    const files = normalizedToClaudeRawFiles(codexSession(), "/local/workspace");
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    for (const r of records) {
      expect(r.cwd).toBe("/local/workspace");
    }
  });
});

describe("import transforms", () => {
  test("converts normalized Claude events into Codex JSONL records", () => {
    const files = normalizedToCodexRawFiles(sampleSession("claude-code"), "/local/workspace");

    expect(files).toHaveLength(1);
    expect(files[0]!.relativePath).toBe("sessions/2026/04/26/rollout-2026-04-26T10-11-12-session-1.jsonl");
    expect(files[0]!.content).toContain('"type":"session_meta"');
    expect(files[0]!.content).toContain('"cwd":"/local/workspace"');
    expect(files[0]!.content).toContain('"type":"reasoning"');
    expect(files[0]!.content).toContain('"type":"function_call"');
    expect(files[0]!.content).toContain('"type":"function_call_output"');
  });

  test("converts Claude image blocks into Codex input images", () => {
    const files = normalizedToCodexRawFiles(
      imageSession("claude-code", {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "abc123" },
      }),
      "/local/workspace",
    );
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const message = records.find((r: { payload?: { type?: string; role?: string } }) => r.payload?.type === "message" && r.payload.role === "user");

    expect(message.payload.content).toContainEqual({
      type: "input_image",
      image_url: "data:image/png;base64,abc123",
    });
  });

  test("converts Codex data-url image blocks into Claude image blocks", () => {
    const files = normalizedToClaudeRawFiles(
      imageSession("codex", {
        type: "image",
        source: { url: "data:image/png;base64,abc123", media_type: "image/png" },
      }),
      "/local/workspace",
    );
    const records = files[0]!.content
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const user = records.find((r: { type: string }) => r.type === "user");

    expect(user.message.content).toContainEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "abc123" },
    });
  });

  test("dry-runs a same-source Claude import into the requested workspace", async () => {
    const bundle: SessionExportBundle = {
      schemaVersion: 1,
      publicId: "abc123",
      source: "claude-code",
      normalized: sampleSession("claude-code"),
      rawFiles: [
        {
          threadId: "session-1",
          kind: "main",
          fileName: "session-1.jsonl",
          relativePath: "-remote-workspace/session-1.jsonl",
          content: JSON.stringify({ type: "user", cwd: "/remote/workspace", sessionId: "session-1" }) + "\n",
        },
      ],
    };

    const result = await importSessionBundle(bundle, {
      target: "claude",
      workspace: "/local/workspace",
      claudeHome: "/tmp/agent-thread-test-claude",
      dryRun: true,
    });

    expect(result.transformed).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.files[0]!.path).toBe(join("/tmp/agent-thread-test-claude", "projects", "-local-workspace", "session-1.jsonl"));
    expect(result.files[0]!.written).toBe(false);
  });
});
