import { isCancel, select } from "@clack/prompts";

import type { DiscoveredClaudeSession } from "../shared/claude";
import { formatSessionHint, formatSessionLabel } from "./display";

export async function chooseSession(
  sessions: DiscoveredClaudeSession[],
  latest: boolean,
): Promise<DiscoveredClaudeSession | null> {
  if (sessions.length === 0) {
    return null;
  }

  if (latest || !process.stdout.isTTY) {
    return sessions[0] ?? null;
  }

  const value = await select<DiscoveredClaudeSession>({
    message: "Select a Claude session to upload",
    options: sessions.map((session) => ({
      value: session,
      label: formatSessionLabel(session),
      hint: formatSessionHint(session),
    })),
  });

  if (isCancel(value)) {
    return null;
  }

  return value;
}
