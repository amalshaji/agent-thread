import { describe, expect, test } from "bun:test";

import { DEFAULT_SERVER_URL, parseArgs, resolveServerUrl } from "../src/cli/args";
import { formatUploadFailure } from "../src/cli/upload";
import { isUploadRequest } from "../lib/validation";

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
});

describe("upload validation", () => {
  test("accepts Codex as a persisted upload source", () => {
    expect(
      isUploadRequest({
        schemaVersion: 1,
        source: "codex",
        sessionId: "session-1",
        rawFiles: [],
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
      }),
    ).toBe(true);
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

    expect(message).toContain("Upload failed (404) at https://agent-thread.amalshaji.workers.dev/api/uploads.");
    expect(message).toContain("not serving the agent-thread upload API");
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
      "Upload failed (400): Invalid upload payload.",
    );
  });
});
