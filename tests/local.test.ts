import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { convertLocalSelection } from "../src/cli/local";
import { discoverClaudeSessions, encodeClaudeProjectPath } from "../src/shared/claude";
import { discoverCodexSessions } from "../src/shared/codex";

async function createClaudeSession(sandbox: string): Promise<{
  claudeHome: string;
  projectPath: string;
  sessionId: string;
}> {
  const claudeHome = join(sandbox, ".claude");
  const projectPath = join(sandbox, "workspace", "claude-source");
  const projectKey = encodeClaudeProjectPath(projectPath);
  const transcriptDir = join(claudeHome, "projects", projectKey);
  const sessionId = "12345678-1234-4234-9234-123456789abc";

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
          content: "Convert this Claude session",
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
          content: [{ type: "text", text: "Converted." }],
        },
      }),
    ].join("\n"),
  );

  return { claudeHome, projectPath, sessionId };
}

async function createCodexSession(sandbox: string): Promise<{
  codexHome: string;
  projectPath: string;
  sessionId: string;
}> {
  const codexHome = join(sandbox, ".codex");
  const projectPath = join(sandbox, "workspace", "codex-source");
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
        timestamp: "2026-04-25T19:08:31.864Z",
        type: "event_msg",
        payload: {
          type: "thread_name_updated",
          thread_id: sessionId,
          thread_name: "Convert Codex session",
        },
      }),
      JSON.stringify({
        timestamp: "2026-04-25T19:08:32.100Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Convert this Codex session" }],
        },
      }),
      JSON.stringify({
        timestamp: "2026-04-25T19:08:33.100Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Converted." }],
        },
      }),
    ].join("\n"),
  );

  return { codexHome, projectPath, sessionId };
}

describe("local chat conversion", () => {
  test("converts a local Claude session to Codex on dry run", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-local-"));

    try {
      const { claudeHome, projectPath, sessionId } = await createClaudeSession(sandbox);
      const codexHome = join(sandbox, ".codex");
      const workspace = join(sandbox, "workspace", "codex-target");
      const sessions = await discoverClaudeSessions({ cwd: projectPath, claudeHome });
      const result = await convertLocalSelection(
        {
          provider: "claude",
          session: sessions[0]!,
          claudeHome,
        },
        {
          target: "codex",
          workspace,
          claudeHome,
          codexHome,
          dryRun: true,
        },
      );

      expect(sessions).toHaveLength(1);
      expect(result.source).toBe("claude-code");
      expect(result.target).toBe("codex");
      expect(result.transformed).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]!.written).toBe(false);
      expect(result.files[0]!.path).toBe(
        join(codexHome, "sessions", "2026", "03", "27", `rollout-2026-03-27T04-30-33-${sessionId}.jsonl`),
      );
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("converts a local Codex session to Claude for the requested workspace", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-local-"));

    try {
      const { codexHome, projectPath, sessionId } = await createCodexSession(sandbox);
      const claudeHome = join(sandbox, ".claude");
      const workspace = join(sandbox, "workspace", "claude-target");
      const sessions = await discoverCodexSessions({ cwd: projectPath, codexHome });
      const result = await convertLocalSelection(
        {
          provider: "codex",
          session: sessions[0]!,
          codexHome,
        },
        {
          target: "claude",
          workspace,
          claudeHome,
          codexHome,
          dryRun: true,
        },
      );

      expect(sessions).toHaveLength(1);
      expect(result.source).toBe("codex");
      expect(result.target).toBe("claude");
      expect(result.transformed).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.files[0]!.path).toBe(
        join(claudeHome, "projects", encodeClaudeProjectPath(workspace), `${sessionId}.jsonl`),
      );
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("requires force when a local conversion would overwrite files", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "agent-thread-local-"));

    try {
      const { codexHome, projectPath } = await createCodexSession(sandbox);
      const claudeHome = join(sandbox, ".claude");
      const workspace = join(sandbox, "workspace", "claude-target");
      const sessions = await discoverCodexSessions({ cwd: projectPath, codexHome });
      const selection = {
        provider: "codex" as const,
        session: sessions[0]!,
        codexHome,
      };
      const options = {
        target: "claude" as const,
        workspace,
        claudeHome,
        codexHome,
      };

      const first = await convertLocalSelection(selection, options);
      expect(first.files[0]!.written).toBe(true);

      await expect(convertLocalSelection(selection, options)).rejects.toThrow("Import would overwrite 1 existing file.");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});
