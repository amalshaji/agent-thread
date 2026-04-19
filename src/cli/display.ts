import type { DiscoveredClaudeSession } from "../shared/claude";

function formatDate(value: string | null): string {
  if (!value) {
    return "unknown";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function formatSessionLabel(session: DiscoveredClaudeSession, maxLength = 60): string {
  const label = session.title ?? session.sessionId;
  return label.length > maxLength ? label.slice(0, maxLength - 1) + "…" : label;
}

export function formatSessionHint(session: DiscoveredClaudeSession): string {
  const pieces = [
    formatDate(session.latestTimestamp),
    `${session.eventCount} events`,
    `${session.sidechainCount} side thread${session.sidechainCount === 1 ? "" : "s"}`,
  ];

  if (session.gitBranch) {
    pieces.push(session.gitBranch);
  }

  return pieces.join(" | ");
}
