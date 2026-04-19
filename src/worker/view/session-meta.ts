import type { NormalizedSession } from "../../shared/contracts";
import { formatTimestamp, escapeHtml } from "./utils";
import { splitThreadEvents } from "./visibility";

export function renderSidebarMeta(session: NormalizedSession, publicId: string): string {
  const hiddenEventCount = session.threads.reduce(
    (total, thread) => total + splitThreadEvents(thread.events).hiddenEvents.length,
    0,
  );
  const startedAt = session.root.startedAt ? formatTimestamp(session.root.startedAt) : null;
  const project = session.root.projectPath;
  const visibleCount = session.stats.eventCount - hiddenEventCount;

  const rows: string[] = [];

  rows.push(`<div class="sidebar-row"><span class="sidebar-label">ID</span><span class="sidebar-value sidebar-value-path">${escapeHtml(publicId)}</span></div>`);
  if (startedAt) {
    rows.push(`<div class="sidebar-row"><span class="sidebar-label">Started</span><span class="sidebar-value">${escapeHtml(startedAt)}</span></div>`);
  }
  if (project) {
    rows.push(`<div class="sidebar-row"><span class="sidebar-label">Project</span><span class="sidebar-value sidebar-value-path">${escapeHtml(project)}</span></div>`);
  }
  rows.push(`<div class="sidebar-row"><span class="sidebar-label">Events</span><span class="sidebar-value">${visibleCount + hiddenEventCount}</span></div>`);
  if (session.stats.threadCount > 1) {
    rows.push(`<div class="sidebar-row"><span class="sidebar-label">Threads</span><span class="sidebar-value">${session.stats.threadCount}</span></div>`);
  }

  const threadRows = session.threads.length > 1
    ? session.threads.map((thread) => {
        const { primaryEvents } = splitThreadEvents(thread.events);
        const label = thread.kind === "main" ? "Main thread" : `Side thread ${thread.agentId ?? thread.id}`;
        return `<a class="sidebar-thread-link" href="#${escapeHtml(thread.id)}">${escapeHtml(label)}<span class="sidebar-thread-count">${primaryEvents.length}</span></a>`;
      }).join("")
    : "";

  return `
    <div class="sidebar-meta">
      ${rows.join("")}
      ${threadRows ? `<div class="sidebar-section-label">Threads</div><div class="sidebar-threads">${threadRows}</div>` : ""}
    </div>
  `;
}
