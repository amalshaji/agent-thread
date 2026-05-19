import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateUploadRequest } from "../lib/validation";
import { buildUploadRequest, discoverCodexSessions, encodeCodexProjectPath } from "../src/shared/codex";
import { MAX_TEXT_PREVIEW_BYTES } from "../src/shared/text-preview";

describe("Codex discovery", () => {
  test("finds scoped rollout files and normalizes visible transcript events", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-codex-"));
    const codexHome = join(sandbox, ".codex");
    const projectPath = join(sandbox, "workspace", "demo");
    const transcriptDir = join(codexHome, "sessions", "2026", "04", "26");
    const sessionId = "019dc60a-f5be-7932-9020-0b2fca226a15";

    await mkdir(projectPath, { recursive: true });
    await mkdir(transcriptDir, { recursive: true });

    await Bun.write(
      join(transcriptDir, `rollout-2026-04-26T00-38-20-${sessionId}.jsonl`),
      [
        JSON.stringify({
          timestamp: "2026-04-25T19:08:20.292Z",
          type: "session_meta",
          payload: {
            id: sessionId,
            timestamp: "2026-04-25T19:08:20.292Z",
            cwd: projectPath,
            originator: "codex_cli_rs",
            cli_version: "0.125.0-alpha.3",
            source: "cli",
            model_provider: "openai",
            git: { branch: "main" },
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:20.293Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "developer",
            content: [{ type: "input_text", text: "Hidden developer setup" }],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:20.294Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "# AGENTS.md instructions\n<environment_context>" }],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:20.295Z",
          type: "turn_context",
          payload: {
            cwd: projectPath,
            model: "gpt-5.5",
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:31.864Z",
          type: "event_msg",
          payload: {
            type: "thread_name_updated",
            thread_id: sessionId,
            thread_name: "Add Codex support",
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:32.100Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "Can you add Codex support?" }],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:33.100Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "I will inspect the format." }],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:33.500Z",
          type: "response_item",
          payload: {
            type: "reasoning",
            summary: [{ type: "summary_text", text: "Need to check the local transcript shape." }],
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:34.100Z",
          type: "response_item",
          payload: {
            type: "function_call",
            name: "exec_command",
            call_id: "call_123",
            arguments: JSON.stringify({ cmd: "pwd" }),
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:34.200Z",
          type: "response_item",
          payload: {
            type: "function_call_output",
            call_id: "call_123",
            output: projectPath,
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:34.300Z",
          type: "response_item",
          payload: {
            type: "function_call_output",
            call_id: "call_long",
            output: "x".repeat(2000),
          },
        }),
        JSON.stringify({
          timestamp: "2026-04-25T19:08:35.100Z",
          type: "event_msg",
          payload: {
            type: "token_count",
            info: {
              last_token_usage: {
                input_tokens: 148552,
                cached_input_tokens: 146816,
                output_tokens: 478,
                reasoning_output_tokens: 24,
                total_tokens: 149030,
              },
              total_token_usage: {
                input_tokens: 5002474,
                cached_input_tokens: 4726784,
                output_tokens: 43804,
                reasoning_output_tokens: 13780,
                total_tokens: 5046278,
              },
              model_context_window: 258400,
            },
            rate_limits: {
              plan_type: "plus",
              credits: { has_credits: false, balance: "0" },
            },
          },
        }),
      ].join("\n"),
    );

    const sessions = await discoverCodexSessions({
      cwd: projectPath,
      codexHome,
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionId).toBe(sessionId);
    expect(sessions[0]?.projectKey).toBe(encodeCodexProjectPath(projectPath));
    expect(sessions[0]?.title).toBe("Add Codex support");
    expect(sessions[0]?.gitBranch).toBe("main");

    const upload = await buildUploadRequest(sessions[0]!, codexHome);
    expect(upload.source).toBe("codex");
    expect(upload.rawFiles).toHaveLength(1);
    expect(upload.rawFiles[0]?.relativePath).toContain("sessions/2026/04/26");
    expect(upload.normalized.source).toBe("codex");
    expect(upload.normalized.threads).toHaveLength(1);

    const events = upload.normalized.threads[0]!.events;
    expect(events.some((event) => event.textPreview?.includes("Hidden developer setup"))).toBe(false);
    expect(events.some((event) => event.textPreview?.includes("AGENTS.md"))).toBe(false);
    expect(events.map((event) => event.displayKind)).toEqual([
      "message",
      "message",
      "thinking",
      "tool_use",
      "tool_result",
      "tool_result",
      "meta",
    ]);
    expect(events[2]?.blocks[0]).toMatchObject({
      kind: "thinking",
      text: "Need to check the local transcript shape.",
    });
    expect(events[3]?.blocks[0]).toMatchObject({
      kind: "tool_use",
      id: "call_123",
      name: "exec_command",
      input: { cmd: "pwd" },
    });
    const longOutputPreview = events[5]?.textPreview ?? "";
    expect(longOutputPreview.endsWith("...")).toBe(true);
    expect(new TextEncoder().encode(longOutputPreview).byteLength).toBeLessThanOrEqual(MAX_TEXT_PREVIEW_BYTES);
    expect(validateUploadRequest(upload).ok).toBe(true);
    expect(events[6]?.meta).toMatchObject({
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
    });
    expect(JSON.stringify(events[6]?.meta.usage)).not.toContain("rate_limits");
    expect(JSON.stringify(events[6]?.meta.usage)).not.toContain("credits");

    await rm(sandbox, { recursive: true, force: true });
  });
});
