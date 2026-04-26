import { isCancel, select } from "@clack/prompts";

import { formatSessionHint, formatSessionLabel, type DisplaySession } from "./display";
import type { ImportTarget } from "../shared/imports";

const SESSION_PAGE_SIZE = 10;

type SessionPromptValue =
  | { kind: "session"; session: DisplaySession }
  | { kind: "previous-page" }
  | { kind: "next-page" };

type SessionPromptOption = {
  value: SessionPromptValue;
  label: string;
  hint?: string;
};

type SessionSelectPrompt = (options: {
  message: string;
  options: SessionPromptOption[];
  maxItems?: number;
}) => Promise<SessionPromptValue | symbol>;

type CancelDetector = (value: unknown) => boolean;

interface SessionPromptDeps {
  prompt: SessionSelectPrompt;
  isPromptCancel: CancelDetector;
  isInteractive?: boolean;
}

const DEFAULT_PROMPT_DEPS: SessionPromptDeps = {
  prompt: select as SessionSelectPrompt,
  isPromptCancel: isCancel,
};

function clampPageIndex(pageIndex: number, pageCount: number): number {
  return Math.min(Math.max(pageIndex, 0), Math.max(pageCount - 1, 0));
}

function buildSessionPrompt<T extends DisplaySession>(
  sessions: T[],
  pageIndex: number,
  providerLabel: string,
  action: string,
): {
  message: string;
  options: SessionPromptOption[];
  nextPageIndex: number;
} {
  const pageCount = Math.max(Math.ceil(sessions.length / SESSION_PAGE_SIZE), 1);
  const nextPageIndex = clampPageIndex(pageIndex, pageCount);
  const startIndex = nextPageIndex * SESSION_PAGE_SIZE;
  const endIndex = Math.min(startIndex + SESSION_PAGE_SIZE, sessions.length);

  const options: SessionPromptOption[] = sessions.slice(startIndex, endIndex).map((session) => ({
    value: { kind: "session", session },
    label: formatSessionLabel(session),
    hint: formatSessionHint(session),
  }));

  if (nextPageIndex > 0) {
    const previousStart = Math.max(startIndex - SESSION_PAGE_SIZE, 0) + 1;
    const previousEnd = startIndex;
    options.push({
      value: { kind: "previous-page" },
      label: "Newer sessions",
      hint: `${previousStart}-${previousEnd} of ${sessions.length}`,
    });
  }

  if (nextPageIndex < pageCount - 1) {
    const nextStart = endIndex + 1;
    const nextEnd = Math.min(endIndex + SESSION_PAGE_SIZE, sessions.length);
    options.push({
      value: { kind: "next-page" },
      label: "Older sessions",
      hint: `${nextStart}-${nextEnd} of ${sessions.length}`,
    });
  }

  return {
    message:
      pageCount === 1
        ? `Select a ${providerLabel} session to ${action}`
        : `Select a ${providerLabel} session to ${action} (Page ${nextPageIndex + 1} of ${pageCount}, ${startIndex + 1}-${endIndex} of ${sessions.length})`,
    options,
    nextPageIndex,
  };
}

export async function chooseSession<T extends DisplaySession>(
  sessions: T[],
  latest: boolean,
  deps: SessionPromptDeps = DEFAULT_PROMPT_DEPS,
  providerLabel = "Claude",
  action = "upload",
): Promise<T | null> {
  if (sessions.length === 0) {
    return null;
  }

  const isInteractive = deps.isInteractive ?? process.stdout.isTTY;

  if (latest || !isInteractive) {
    return sessions[0] ?? null;
  }

  let pageIndex = 0;

  while (true) {
    const prompt = buildSessionPrompt(sessions, pageIndex, providerLabel, action);
    const value = await deps.prompt({
      message: prompt.message,
      options: prompt.options,
      maxItems: prompt.options.length,
    });

    if (deps.isPromptCancel(value)) {
      return null;
    }

    if (typeof value === "symbol") {
      return null;
    }

    switch (value.kind) {
      case "session":
        return value.session as T;
      case "previous-page":
        pageIndex = prompt.nextPageIndex - 1;
        break;
      case "next-page":
        pageIndex = prompt.nextPageIndex + 1;
        break;
    }
  }
}

export async function chooseImportTarget(
  deps: {
    prompt: (options: {
      message: string;
      options: Array<{ value: ImportTarget; label: string; hint?: string }>;
    }) => Promise<ImportTarget | symbol>;
    isPromptCancel: CancelDetector;
    isInteractive?: boolean;
  } = {
    prompt: select as (options: {
      message: string;
      options: Array<{ value: ImportTarget; label: string; hint?: string }>;
    }) => Promise<ImportTarget | symbol>,
    isPromptCancel: isCancel,
  },
): Promise<ImportTarget | null> {
  const isInteractive = deps.isInteractive ?? process.stdout.isTTY;

  if (!isInteractive) {
    return null;
  }

  const value = await deps.prompt({
    message: "Import into which app?",
    options: [
      { value: "claude", label: "Claude Code", hint: "Write JSONL into ~/.claude/projects" },
      { value: "codex", label: "Codex", hint: "Write JSONL into ~/.codex/sessions" },
    ],
  });

  if (deps.isPromptCancel(value) || typeof value === "symbol") {
    return null;
  }

  return value;
}
