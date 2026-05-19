import { describe, expect, test } from "bun:test";

import { DEFAULT_SERVER_URL, parseArgs, resolveServerUrl } from "../src/cli/args";
import { buildPublicThreadUrl, formatUploadFailure } from "../src/cli/upload";
import { MAX_RAW_FILE_BYTES, isUploadRequest } from "../lib/validation";

function validUploadRequest() {
  return {
    schemaVersion: 1,
    source: "codex",
    sessionId: "session-1",
    projectKey: "project",
    projectPath: null,
    title: null,
    rawFiles: [
      {
        threadId: "session-1",
        kind: "main",
        fileName: "session-1.jsonl",
        relativePath: "sessions/2026/05/19/session-1.jsonl",
        content: JSON.stringify({ type: "session_meta", payload: { id: "session-1" } }) + "\n",
      },
    ],
    normalized: {
      schemaVersion: 1,
      source: "codex",
      importedAt: "2026-04-25T00:00:00.000Z",
      root: {
        sessionId: "session-1",
        projectKey: "project",
        projectPath: null,
        title: null,
        cwd: null,
        gitBranch: null,
        startedAt: null,
      },
      threads: [],
      stats: {
        threadCount: 0,
        eventCount: 0,
        messageCount: 0,
        sidechainCount: 0,
      },
    },
  };
}

describe("CLI server URL resolution", () => {
  test("defaults to the deployed custom domain", () => {
    expect(resolveServerUrl({})).toBe(DEFAULT_SERVER_URL);
  });

  test("respects AGENT_THREAD_SERVER_URL overrides", () => {
    expect(resolveServerUrl({ AGENT_THREAD_SERVER_URL: "https://127.0.0.1:8787" })).toBe("https://127.0.0.1:8787");
  });
});

describe("CLI provider args", () => {
  test("defaults to Claude and accepts Codex flags", () => {
    expect(parseArgs([]).provider).toBe("claude");
    expect(parseArgs(["--codex", "--codex-home", "/tmp/codex"]).provider).toBe("codex");
    expect(parseArgs(["--codex", "--claude"]).provider).toBe("claude");
  });

  test("parses upload flags", () => {
    const options = parseArgs([
      "--codex",
      "--cwd",
      "/tmp/upload-scope",
      "--server",
      "https://example.com",
      "--latest",
      "--yes",
      "--json",
    ]);

    expect(options.provider).toBe("codex");
    expect(options.cwd).toBe("/tmp/upload-scope");
    expect(options.serverUrl).toBe("https://example.com");
    expect(options.latest).toBe(true);
    expect(options.yes).toBe(true);
    expect(options.json).toBe(true);
  });

  test("parses same-app import flags", () => {
    const options = parseArgs([
      "--import",
      "abc123",
      "--workspace",
      "/tmp/import-workspace",
      "--dry-run",
      "--force",
      "--json",
    ]);

    expect(options.importRef).toBe("abc123");
    expect(options.workspace).toBe("/tmp/import-workspace");
    expect(options.dryRun).toBe(true);
    expect(options.force).toBe(true);
    expect(options.json).toBe(true);
  });

  test("rejects removed import and conversion flags", () => {
    for (const flag of ["--local", "--to"]) {
      expect(() => parseArgs([flag])).toThrow(`Unknown flag: ${flag}`);
    }
  });
});

describe("upload validation", () => {
  test("accepts Codex as a persisted upload source", () => {
    expect(isUploadRequest(validUploadRequest())).toBe(true);
  });

  test("rejects uploads without raw transcript files", () => {
    const request = validUploadRequest();
    request.rawFiles = [];

    expect(isUploadRequest(request)).toBe(false);
  });

  test("rejects malformed raw transcript file fields", () => {
    const request = validUploadRequest();
    request.rawFiles[0]!.fileName = "../session-1.jsonl";

    expect(isUploadRequest(request)).toBe(false);
  });

  test("rejects raw transcript paths with traversal segments", () => {
    const request = validUploadRequest();
    request.rawFiles[0]!.relativePath = "sessions/../state_5.sqlite";

    expect(isUploadRequest(request)).toBe(false);
  });

  test("rejects oversized raw transcript files", () => {
    const request = validUploadRequest();
    request.rawFiles[0]!.content = "x".repeat(MAX_RAW_FILE_BYTES + 1);

    expect(isUploadRequest(request)).toBe(false);
  });

  test("rejects normalized source mismatches", () => {
    const request = validUploadRequest();
    request.normalized.source = "claude-code";

    expect(isUploadRequest(request)).toBe(false);
  });

  test("rejects normalized stats mismatches", () => {
    const request = validUploadRequest();
    request.normalized.stats.eventCount = 1;

    expect(isUploadRequest(request)).toBe(false);
  });
});

describe("upload failure formatting", () => {
  test("turns HTML 404 responses into a server URL hint", async () => {
    const response = new Response("<!DOCTYPE html><html><title>Page not found</title></html>", {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });

    const message = await formatUploadFailure(response, new URL("/api/uploads", "https://agent-thread.amalshaji.workers.dev"));

    expect(message).toContain("Export failed (404) at https://agent-thread.amalshaji.workers.dev/api/uploads.");
    expect(message).toContain("not serving the agent-thread export API");
    expect(message).toContain("https://agent-thread.com");
  });

  test("prefers JSON API errors when available", async () => {
    const response = new Response(JSON.stringify({ error: "Invalid upload payload." }), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    });

    await expect(formatUploadFailure(response, new URL("/api/uploads", "https://agent-thread.com"))).resolves.toBe(
      "Export failed (400): Invalid upload payload.",
    );
  });
});

describe("upload URL formatting", () => {
  test("prints links from the resolved CLI server URL", () => {
    expect(buildPublicThreadUrl("http://127.0.0.1:3000", "abc123")).toBe("http://127.0.0.1:3000/t/abc123");
    expect(buildPublicThreadUrl("http://127.0.0.1:3000/", "abc123")).toBe("http://127.0.0.1:3000/t/abc123");
  });
});
