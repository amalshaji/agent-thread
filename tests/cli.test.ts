import { describe, expect, test } from "bun:test";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../src/cli/args";
import { formatUploadFailure } from "../src/cli/upload";

describe("CLI server URL resolution", () => {
  test("defaults to the deployed custom domain", () => {
    expect(resolveServerUrl({})).toBe(DEFAULT_SERVER_URL);
  });

  test("respects AGENT_THREAD_SERVER_URL overrides", () => {
    expect(resolveServerUrl({ AGENT_THREAD_SERVER_URL: "https://127.0.0.1:8787" })).toBe("https://127.0.0.1:8787");
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
