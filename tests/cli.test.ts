import { describe, expect, test } from "bun:test";

import { DEFAULT_SERVER_URL, parseArgs, resolveServerUrl } from "../src/cli/args";
import { resolveLocalConversionTarget } from "../src/cli/local";
import { buildPublicThreadUrl, formatUploadFailure } from "../src/cli/upload";
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

  test("parses import flags and keeps workspace independent from cwd", () => {
    const options = parseArgs([
      "--import",
      "abc123",
      "--to",
      "codex",
      "--cwd",
      "/tmp/upload-scope",
      "--workspace",
      "/tmp/import-workspace",
      "--dry-run",
      "--force",
    ]);

    expect(options.importRef).toBe("abc123");
    expect(options.importTarget).toBe("codex");
    expect(options.cwd).toBe("/tmp/upload-scope");
    expect(options.workspace).toBe("/tmp/import-workspace");
    expect(options.dryRun).toBe(true);
    expect(options.force).toBe(true);
  });

  test("defaults import workspace to the current process cwd", () => {
    expect(parseArgs(["--import", "abc123"]).workspace).toBe(process.cwd());
  });

  test("parses local conversion flags", () => {
    const options = parseArgs(["--codex", "--local", "--to", "claude", "--latest", "--dry-run"]);

    expect(options.provider).toBe("codex");
    expect(options.local).toBe(true);
    expect(options.importTarget).toBe("claude");
    expect(options.latest).toBe(true);
    expect(options.dryRun).toBe(true);
  });

  test("rejects combining local conversion with shared import", () => {
    expect(() => parseArgs(["--local", "--import", "abc123"])).toThrow("--local cannot be combined with --import.");
  });
});

describe("local conversion target resolution", () => {
  test("defaults to the opposite app", () => {
    expect(resolveLocalConversionTarget("claude")).toBe("codex");
    expect(resolveLocalConversionTarget("codex")).toBe("claude");
  });

  test("rejects same-source local targets", () => {
    expect(() => resolveLocalConversionTarget("claude", "claude")).toThrow(
      "Local conversion from Claude Code can only target Codex.",
    );
    expect(() => resolveLocalConversionTarget("codex", "codex")).toThrow(
      "Local conversion from Codex can only target Claude Code.",
    );
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

describe("upload URL formatting", () => {
  test("prints links from the resolved CLI server URL", () => {
    expect(buildPublicThreadUrl("http://127.0.0.1:3000", "abc123")).toBe("http://127.0.0.1:3000/t/abc123");
    expect(buildPublicThreadUrl("http://127.0.0.1:3000/", "abc123")).toBe("http://127.0.0.1:3000/t/abc123");
  });
});
