import { expect, test } from "bun:test";

import { chooseSession } from "../src/cli/prompt";
import type { DiscoveredClaudeSession } from "../src/shared/claude";

function buildSession(index: number): DiscoveredClaudeSession {
  const startedAt = `2026-04-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`;
  const latestTimestamp = `2026-04-${String((index % 28) + 1).padStart(2, "0")}T00:05:00.000Z`;

  return {
    sessionId: `session-${index + 1}`,
    projectKey: "project-1",
    projectPath: "/tmp/project-1",
    cwd: "/tmp/project-1",
    gitBranch: "main",
    title: `Session ${index + 1}`,
    startedAt,
    latestTimestamp,
    eventCount: index + 1,
    sidechainCount: 0,
    mainThread: null,
    sidechains: [],
    transcripts: [],
  };
}

test("chooseSession bypasses the prompt when latest is requested", async () => {
  const sessions = [buildSession(0), buildSession(1)];
  let promptCalls = 0;

  const selected = await chooseSession(sessions, true, {
    prompt: async () => {
      promptCalls += 1;
      throw new Error("prompt should not be called");
    },
    isPromptCancel: () => false,
    isInteractive: true,
  });

  expect(selected).toBe(sessions[0]!);
  expect(promptCalls).toBe(0);
});

test("chooseSession returns the selected session from a single page", async () => {
  const sessions = Array.from({ length: 5 }, (_, index) => buildSession(index));
  const seenMessages: string[] = [];

  const selected = await chooseSession(sessions, false, {
    prompt: async (config) => {
      seenMessages.push(config.message);
      expect(config.options).toHaveLength(5);
      expect(config.maxItems).toBe(5);
      return config.options[2]!.value;
    },
    isPromptCancel: () => false,
    isInteractive: true,
  });

  expect(selected).toBe(sessions[2]!);
  expect(seenMessages).toEqual(["Select a Claude session to export"]);
});

test("chooseSession pages forward to older sessions", async () => {
  const sessions = Array.from({ length: 25 }, (_, index) => buildSession(index));
  const seenMessages: string[] = [];
  let promptStep = 0;

  const selected = await chooseSession(sessions, false, {
    prompt: async (config) => {
      seenMessages.push(config.message);
      promptStep += 1;

      if (promptStep === 1) {
        expect(config.maxItems).toBe(11);
        expect(config.options.at(-1)?.label).toBe("Older sessions");
        return config.options.at(-1)!.value;
      }

      expect(config.options.some((option) => option.label === "Newer sessions")).toBe(true);
      return config.options[3]!.value;
    },
    isPromptCancel: () => false,
    isInteractive: true,
  });

  expect(selected).toBe(sessions[13]!);
  expect(seenMessages).toEqual([
    "Select a Claude session to export (Page 1 of 3, 1-10 of 25)",
    "Select a Claude session to export (Page 2 of 3, 11-20 of 25)",
  ]);
});

test("chooseSession pages back to newer sessions", async () => {
  const sessions = Array.from({ length: 21 }, (_, index) => buildSession(index));
  let promptStep = 0;

  const selected = await chooseSession(sessions, false, {
    prompt: async (config) => {
      promptStep += 1;

      if (promptStep === 1) {
        return config.options.at(-1)!.value;
      }

      if (promptStep === 2) {
        return config.options.find((option) => option.label === "Newer sessions")!.value;
      }

      expect(config.message).toBe("Select a Claude session to export (Page 1 of 3, 1-10 of 21)");
      return config.options[0]!.value;
    },
    isPromptCancel: () => false,
    isInteractive: true,
  });

  expect(selected).toBe(sessions[0]!);
});

test("chooseSession returns null when the prompt is cancelled", async () => {
  const sessions = Array.from({ length: 3 }, (_, index) => buildSession(index));
  const cancelled = Symbol("cancelled");

  const selected = await chooseSession(sessions, false, {
    prompt: async () => cancelled,
    isPromptCancel: (value) => value === cancelled,
    isInteractive: true,
  });

  expect(selected).toBeNull();
});
