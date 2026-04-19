import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildUploadRequest,
  discoverClaudeSessions,
  encodeClaudeProjectPath,
} from "../src/shared/claude";

describe("Claude discovery", () => {
  test("finds project sessions and groups sidechains", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-"));
    const claudeHome = join(sandbox, ".claude");
    const projectPath = join(sandbox, "workspace", "demo");
    const projectKey = encodeClaudeProjectPath(projectPath);
    const transcriptDir = join(claudeHome, "projects", projectKey);
    const sessionId = "12345678-1234-1234-1234-123456789abc";

    await mkdir(projectPath, { recursive: true });
    await mkdir(transcriptDir, { recursive: true });

    await Bun.write(
      join(transcriptDir, `${sessionId}.jsonl`),
      [
        JSON.stringify({
          uuid: "user-1",
          parentUuid: null,
          type: "user",
          sessionId,
          cwd: projectPath,
          gitBranch: "main",
          timestamp: "2026-03-27T04:30:33.382Z",
          message: {
            role: "user",
            content: "Build a session viewer",
          },
        }),
        JSON.stringify({
          uuid: "assistant-1",
          parentUuid: "user-1",
          type: "assistant",
          sessionId,
          cwd: projectPath,
          gitBranch: "main",
          timestamp: "2026-03-27T04:30:35.862Z",
          message: {
            role: "assistant",
            model: "claude-sonnet-4-6",
            content: [{ type: "text", text: "Sure." }],
          },
        }),
      ].join("\n"),
    );

    await Bun.write(
      join(transcriptDir, "agent-abc1234.jsonl"),
      JSON.stringify({
        uuid: "agent-user-1",
        parentUuid: null,
        type: "user",
        sessionId,
        cwd: projectPath,
        gitBranch: "main",
        timestamp: "2026-03-27T04:31:33.382Z",
        isSidechain: true,
        agentId: "abc1234",
        message: {
          role: "user",
          content: "Side task",
        },
      }),
    );

    const sessions = await discoverClaudeSessions({
      cwd: projectPath,
      claudeHome,
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionId).toBe(sessionId);
    expect(sessions[0]?.sidechainCount).toBe(1);
    expect(sessions[0]?.title).toBe("Build a session viewer");

    const upload = await buildUploadRequest(sessions[0]!, claudeHome);
    expect(upload.rawFiles).toHaveLength(2);
    expect(upload.normalized.threads).toHaveLength(2);
    expect(upload.normalized.stats.sidechainCount).toBe(1);
  });

  test("encodes project paths the same way Claude does on disk", () => {
    expect(encodeClaudeProjectPath("/Users/demo/project")).toBe("-Users-demo-project");
  });

  test("classifies local command payloads as metadata instead of user messages", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-"));
    const claudeHome = join(sandbox, ".claude");
    const projectPath = join(sandbox, "workspace", "demo");
    const projectKey = encodeClaudeProjectPath(projectPath);
    const transcriptDir = join(claudeHome, "projects", projectKey);
    const sessionId = "87654321-4321-4321-4321-cba987654321";

    await mkdir(projectPath, { recursive: true });
    await mkdir(transcriptDir, { recursive: true });

    await Bun.write(
      join(transcriptDir, `${sessionId}.jsonl`),
      [
        JSON.stringify({
          uuid: "user-1",
          parentUuid: null,
          type: "user",
          sessionId,
          cwd: projectPath,
          gitBranch: "main",
          timestamp: "2026-03-27T04:30:33.382Z",
          message: {
            role: "user",
            content: "Actual user request",
          },
        }),
        JSON.stringify({
          uuid: "command-1",
          parentUuid: "user-1",
          type: "user",
          sessionId,
          cwd: projectPath,
          gitBranch: "main",
          timestamp: "2026-03-27T04:30:34.382Z",
          message: {
            role: "user",
            content:
              "<command-name>/voice</command-name>\n            <command-message>voice</command-message>\n            <command-args></command-args>",
          },
        }),
        JSON.stringify({
          uuid: "system-1",
          parentUuid: "command-1",
          type: "system",
          subtype: "local_command",
          sessionId,
          cwd: projectPath,
          gitBranch: "main",
          timestamp: "2026-03-27T04:30:35.382Z",
          content: "<local-command-stdout>Voice mode enabled.</local-command-stdout>",
        }),
      ].join("\n"),
    );

    const sessions = await discoverClaudeSessions({
      cwd: projectPath,
      claudeHome,
    });
    const upload = await buildUploadRequest(sessions[0]!, claudeHome);
    const events = upload.normalized.threads[0]!.events;

    expect(events[0]?.displayKind).toBe("message");
    expect(events[1]?.displayKind).toBe("meta");
    expect(events[1]?.role).toBeNull();
    expect(events[2]?.displayKind).toBe("meta");
    expect(events[2]?.role).toBeNull();
    expect(upload.normalized.stats.messageCount).toBe(1);

    await rm(sandbox, { recursive: true, force: true });
  });
});
