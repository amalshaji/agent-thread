import { buildUploadRequest as buildClaudeUploadRequest, type DiscoveredClaudeSession } from "../shared/claude";
import { buildUploadRequest as buildCodexUploadRequest, type DiscoveredCodexSession } from "../shared/codex";
import type { UploadResponse } from "../shared/contracts";

type UploadSelection =
  | {
      provider: "claude";
      session: DiscoveredClaudeSession;
      claudeHome?: string;
    }
  | {
      provider: "codex";
      session: DiscoveredCodexSession;
      codexHome?: string;
    };

function summarizeBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  const maxLength = 240;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

export async function formatUploadFailure(response: Response, uploadUrl: URL): Promise<string> {
  const body = await response.text();
  const trimmed = body.trim();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json") && trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown };

      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return `Upload failed (${response.status}): ${parsed.error.trim()}`;
      }
    } catch {
      // Fall through to the plain text formatter below.
    }
  }

  if (contentType.includes("text/html") || /^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed)) {
    const details =
      response.status === 404
        ? "The configured server URL is not serving the agent-thread upload API."
        : "Received an HTML page instead of the upload API response.";

    return [
      `Upload failed (${response.status}) at ${uploadUrl.toString()}.`,
      details,
      "Set AGENT_THREAD_SERVER_URL or pass --server with the Worker base URL, for example https://agent-thread.com.",
    ].join(" ");
  }

  if (trimmed) {
    return `Upload failed (${response.status}): ${summarizeBody(trimmed)}`;
  }

  return `Upload failed (${response.status}) at ${uploadUrl.toString()}.`;
}

export async function uploadSelection(
  serverUrl: string,
  selection: UploadSelection,
): Promise<UploadResponse> {
  const request =
    selection.provider === "codex"
      ? await buildCodexUploadRequest(selection.session, selection.codexHome)
      : await buildClaudeUploadRequest(selection.session, selection.claudeHome);
  const uploadUrl = new URL("/api/uploads", serverUrl);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await formatUploadFailure(response, uploadUrl));
  }

  return (await response.json()) as UploadResponse;
}
