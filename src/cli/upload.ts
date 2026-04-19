import { buildUploadRequest, type DiscoveredClaudeSession } from "../shared/claude";
import type { UploadResponse } from "../shared/contracts";

export async function uploadSelection(
  serverUrl: string,
  session: DiscoveredClaudeSession,
  claudeHome?: string,
): Promise<UploadResponse> {
  const request = await buildUploadRequest(session, claudeHome);
  const response = await fetch(new URL("/api/uploads", serverUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upload failed (${response.status}): ${body}`);
  }

  return (await response.json()) as UploadResponse;
}
