import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { parseImportRef } from "../src/cli/import";
import type { NormalizedSession, SessionExportBundle } from "../src/shared/contracts";
import { createSessionExportResponse, loadSessionExportByPublicId } from "../lib/storage";
import { importSessionBundle } from "../src/shared/imports";
import { encodeClaudeProjectPath } from "../src/shared/claude";

const execFileAsync = promisify(execFile);

function sampleSession(source: "claude-code" | "codex" = "claude-code"): NormalizedSession {
  return {
    schemaVersion: 1,
    source,
    importedAt: "2026-04-26T00:00:00.000Z",
    root: {
      sessionId: source === "codex" ? "codex-session-1" : "claude-session-1",
      projectKey: "remote-project",
      projectPath: "/remote/workspace",
      title: "Import test",
      cwd: "/remote/workspace",
      gitBranch: "main",
      startedAt: "2026-04-26T10:11:12.000Z",
    },
    threads: [
      {
        id: source === "codex" ? "codex-session-1" : "claude-session-1",
        kind: "main",
        sessionId: source === "codex" ? "codex-session-1" : "claude-session-1",
        agentId: null,
        sourceFileName: source === "codex" ? "rollout-codex-session-1.jsonl" : "claude-session-1.jsonl",
        sourceRelativePath: source === "codex" ? "sessions/2026/04/26/rollout-codex-session-1.jsonl" : "remote-project/claude-session-1.jsonl",
        cwd: "/remote/workspace",
        gitBranch: "main",
        startedAt: "2026-04-26T10:11:12.000Z",
        rootEventIds: ["user-1"],
        events: [
          {
            id: "user-1",
            parentId: null,
            seq: 0,
            timestamp: "2026-04-26T10:11:12.000Z",
            topLevelType: "user",
            role: "user",
            displayKind: "message",
            blocks: [{ kind: "text", text: "hello import" }],
            textPreview: "hello import",
            flags: { isMeta: false, isSidechain: false },
            refs: {},
            meta: { model: source === "codex" ? "gpt-5.5" : undefined },
          },
        ],
      },
    ],
    stats: { threadCount: 1, eventCount: 1, messageCount: 1, sidechainCount: 0 },
  };
}

function claudeBundle(): SessionExportBundle {
  return {
    schemaVersion: 1,
    publicId: "claude-public",
    source: "claude-code",
    normalized: sampleSession("claude-code"),
    rawFiles: [
      {
        threadId: "claude-session-1",
        kind: "main",
        fileName: "claude-session-1.jsonl",
        relativePath: "-remote-workspace/claude-session-1.jsonl",
        content: JSON.stringify({ type: "user", cwd: "/remote/workspace", sessionId: "claude-session-1" }) + "\n",
      },
    ],
  };
}

function codexBundle(): SessionExportBundle {
  return {
    schemaVersion: 1,
    publicId: "codex-public",
    source: "codex",
    normalized: sampleSession("codex"),
    rawFiles: [
      {
        threadId: "codex-session-1",
        kind: "main",
        fileName: "rollout-codex-session-1.jsonl",
        relativePath: "sessions/2026/04/26/rollout-codex-session-1.jsonl",
        content:
          [
            JSON.stringify({
              timestamp: "2026-04-26T10:11:12.000Z",
              type: "session_meta",
              payload: { id: "codex-session-1", cwd: "/remote/workspace", source: "cli", model_provider: "openai" },
            }),
            JSON.stringify({
              timestamp: "2026-04-26T10:11:13.000Z",
              type: "turn_context",
              payload: { cwd: "/remote/workspace", model: "gpt-5.5" },
            }),
          ].join("\n") + "\n",
      },
    ],
  };
}

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function createCodexStateDb(codexHome: string): Promise<string> {
  await mkdir(codexHome, { recursive: true });
  const dbPath = join(codexHome, "state_5.sqlite");

  await execFileAsync("sqlite3", [
    dbPath,
    `
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        rollout_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        cwd TEXT NOT NULL,
        title TEXT NOT NULL,
        sandbox_policy TEXT NOT NULL,
        approval_mode TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        has_user_event INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER,
        git_sha TEXT,
        git_branch TEXT,
        git_origin_url TEXT,
        cli_version TEXT NOT NULL DEFAULT '',
        first_user_message TEXT NOT NULL DEFAULT '',
        agent_nickname TEXT,
        agent_role TEXT,
        memory_mode TEXT NOT NULL DEFAULT 'enabled',
        model TEXT,
        reasoning_effort TEXT,
        agent_path TEXT,
        created_at_ms INTEGER,
        updated_at_ms INTEGER
      );
    `,
  ]);

  return dbPath;
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

describe("same-app imports", () => {
  test("loads export bundles with raw files from storage", async () => {
    const bundle = claudeBundle();
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            id: "upload-1",
            public_id: bundle.publicId,
            source: bundle.source,
            session_id: bundle.normalized.root.sessionId,
            project_key: bundle.normalized.root.projectKey,
            title: bundle.normalized.root.title,
            project_path: bundle.normalized.root.projectPath,
            raw_prefix: "raw/claude-code/upload-1",
            normalized_key: "normalized/upload-1.json",
            event_count: bundle.normalized.stats.eventCount,
            thread_count: bundle.normalized.stats.threadCount,
            created_at: "2026-04-26T00:00:00.000Z",
          }),
        }),
      }),
    };
    const bucket = {
      get: async (key: string) => {
        if (key === "normalized/upload-1.json") {
          return { json: async () => bundle.normalized };
        }
        if (key === "raw/claude-code/upload-1/claude-session-1.jsonl") {
          return {
            text: async () => bundle.rawFiles[0]!.content,
            customMetadata: {
              threadId: bundle.rawFiles[0]!.threadId,
              kind: bundle.rawFiles[0]!.kind,
              relativePath: bundle.rawFiles[0]!.relativePath,
            },
          };
        }
        return null;
      },
      list: async () => ({
        objects: [{ key: "raw/claude-code/upload-1/claude-session-1.jsonl" }],
        truncated: false,
      }),
    };

    const result = await loadSessionExportByPublicId(
      { DB: db as unknown as D1Database, SESSIONS_BUCKET: bucket as unknown as R2Bucket },
      bundle.publicId,
    );

    expect(result?.schemaVersion).toBe(1);
    expect(result?.source).toBe("claude-code");
    expect(result?.rawFiles).toEqual(bundle.rawFiles);
  });

  test("streams export bundles without materializing raw files first", async () => {
    const bundle = claudeBundle();
    const rawContent = "line one\nquoted \"value\"\nbackslash \\\\ value\n";
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            id: "upload-1",
            public_id: bundle.publicId,
            source: bundle.source,
            session_id: bundle.normalized.root.sessionId,
            project_key: bundle.normalized.root.projectKey,
            title: bundle.normalized.root.title,
            project_path: bundle.normalized.root.projectPath,
            raw_prefix: "raw/claude-code/upload-1",
            normalized_key: "normalized/upload-1.json",
            event_count: bundle.normalized.stats.eventCount,
            thread_count: bundle.normalized.stats.threadCount,
            created_at: "2026-04-26T00:00:00.000Z",
          }),
        }),
      }),
    };
    const bucket = {
      get: async (key: string) => {
        if (key === "normalized/upload-1.json") {
          return { json: async () => bundle.normalized };
        }
        if (key === "raw/claude-code/upload-1/claude-session-1.jsonl") {
          return {
            body: streamFromChunks(["line one\nquoted \"", "value\"\nbackslash \\\\ value\n"]),
            text: async () => {
              throw new Error("streaming export should not call text() for raw files");
            },
            customMetadata: {
              threadId: bundle.rawFiles[0]!.threadId,
              kind: bundle.rawFiles[0]!.kind,
              relativePath: bundle.rawFiles[0]!.relativePath,
            },
          };
        }
        return null;
      },
      list: async () => ({
        objects: [{ key: "raw/claude-code/upload-1/claude-session-1.jsonl" }],
        truncated: false,
      }),
    };

    const response = await createSessionExportResponse(
      { DB: db as unknown as D1Database, SESSIONS_BUCKET: bucket as unknown as R2Bucket },
      bundle.publicId,
    );
    const streamed = await response?.json() as SessionExportBundle | undefined;

    expect(streamed?.schemaVersion).toBe(1);
    expect(streamed?.source).toBe("claude-code");
    expect(streamed?.rawFiles[0]?.content).toBe(rawContent);
  });

  test("imports a Claude export into the requested Claude workspace", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-import-"));

    try {
      const claudeHome = join(sandbox, ".claude");
      const workspace = join(sandbox, "workspace", "claude-target");
      const result = await importSessionBundle(claudeBundle(), {
        workspace,
        claudeHome,
      });

      const targetPath = join(claudeHome, "projects", encodeClaudeProjectPath(workspace), "claude-session-1.jsonl");
      expect(result.target).toBe("claude");
      expect(result.files[0]?.path).toBe(targetPath);
      expect(result.files[0]?.written).toBe(true);
      expect(await readFile(targetPath, "utf8")).toContain(`"cwd":"${workspace}"`);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("dry-runs a Codex export into the Codex sessions path", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-import-"));

    try {
      const codexHome = join(sandbox, ".codex");
      const workspace = join(sandbox, "workspace", "codex-target");
      const result = await importSessionBundle(codexBundle(), {
        workspace,
        codexHome,
        dryRun: true,
      });

      expect(result.target).toBe("codex");
      expect(result.dryRun).toBe(true);
      expect(result.files[0]?.path).toBe(join(codexHome, "sessions", "2026", "04", "26", "rollout-codex-session-1.jsonl"));
      expect(result.files[0]?.written).toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("dry-runs a Codex export with legacy relative paths under sessions", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-import-"));

    try {
      const bundle = codexBundle();
      bundle.rawFiles[0]!.relativePath = "2026/04/26/rollout-codex-session-1.jsonl";

      const codexHome = join(sandbox, ".codex");
      const workspace = join(sandbox, "workspace", "codex-target");
      const result = await importSessionBundle(bundle, {
        workspace,
        codexHome,
        dryRun: true,
      });

      expect(result.files[0]?.path).toBe(join(codexHome, "sessions", "2026", "04", "26", "rollout-codex-session-1.jsonl"));
      expect(result.files[0]?.written).toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("rejects Codex imports that escape the sessions path", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-import-"));

    try {
      const bundle = codexBundle();
      bundle.rawFiles[0]!.relativePath = "sessions/../state_5.sqlite";

      await expect(
        importSessionBundle(bundle, {
          workspace: join(sandbox, "workspace", "codex-target"),
          codexHome: join(sandbox, ".codex"),
          dryRun: true,
        }),
      ).rejects.toThrow("Unsafe Codex import path");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("rejects Codex imports with unsafe raw file names", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-import-"));

    try {
      const bundle = codexBundle();
      bundle.rawFiles[0]!.relativePath = "2026/04/26/rollout-codex-session-1.jsonl";
      bundle.rawFiles[0]!.fileName = "../state_5.sqlite";

      await expect(
        importSessionBundle(bundle, {
          workspace: join(sandbox, "workspace", "codex-target"),
          codexHome: join(sandbox, ".codex"),
          dryRun: true,
        }),
      ).rejects.toThrow("Unsafe Codex import path");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("rejects overwrites unless force is passed", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-import-"));

    try {
      const claudeHome = join(sandbox, ".claude");
      const workspace = join(sandbox, "workspace", "claude-target");
      await importSessionBundle(claudeBundle(), { workspace, claudeHome });

      await expect(importSessionBundle(claudeBundle(), { workspace, claudeHome })).rejects.toThrow("Import would overwrite 1 existing file.");

      const dryRun = await importSessionBundle(claudeBundle(), { workspace, claudeHome, dryRun: true });
      expect(dryRun.files[0]?.existed).toBe(true);
      expect(dryRun.files[0]?.written).toBe(false);

      const forced = await importSessionBundle(claudeBundle(), { workspace, claudeHome, force: true });
      expect(forced.files[0]?.written).toBe(true);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("updates the Codex index when state_5.sqlite exists", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-import-"));

    try {
      const codexHome = join(sandbox, ".codex");
      const stateDb = await createCodexStateDb(codexHome);
      const workspace = join(sandbox, "workspace", "codex-target");
      const result = await importSessionBundle(codexBundle(), {
        workspace,
        codexHome,
      });

      expect(result.warnings).toEqual([]);
      expect(await readFile(result.files[0]!.path, "utf8")).toContain(`"cwd":"${workspace}"`);

      const { stdout } = await execFileAsync("sqlite3", [
        stateDb,
        "SELECT id, cwd, title, source, first_user_message, has_user_event FROM threads WHERE id = 'codex-session-1';",
      ]);
      expect(stdout.trim().split("|")).toEqual([
        "codex-session-1",
        workspace,
        "Import test",
        "cli",
        "hello import",
        "1",
      ]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("warns instead of failing when Codex state DB is absent", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-import-"));

    try {
      const codexHome = join(sandbox, ".codex");
      const workspace = join(sandbox, "workspace", "codex-target");
      const result = await importSessionBundle(codexBundle(), {
        workspace,
        codexHome,
      });

      expect(result.warnings[0]).toContain("Codex index not updated");
      expect(result.files[0]?.written).toBe(true);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});
