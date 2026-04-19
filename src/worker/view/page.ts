import type { NormalizedSession } from "../../shared/contracts";
import { renderThemeBootScript, renderViewClientScript } from "./client";
import { resetDiffBudget } from "./diff";
import { renderImageLightbox } from "./lightbox";
import { pageStyles } from "./styles";
import { renderThread } from "./threads";
import { escapeHtml, formatShortDate, formatShortTime } from "./utils";

const SPARKLE_SVG = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v5M8 9v5M2 8h5M9 8h5"/></svg>`;

function buildOutlineItems(session: NormalizedSession): string {
  const mainThread = session.threads.find((t) => t.kind === "main") ?? session.threads[0];
  if (!mainThread) return "";

  const items: string[] = [];
  let idx = 0;

  for (const event of mainThread.events) {
    if (event.role !== "user" && event.role !== "assistant") continue;
    if (event.displayKind === "tool_result" || event.displayKind === "tool_use" || event.displayKind === "thinking") continue;

    const textBlock = event.blocks.find((b) => b.kind === "text");
    if (!textBlock || textBlock.kind !== "text" || !textBlock.text.trim()) continue;

    const firstLine = textBlock.text.split("\n").find((l) => l.trim()) ?? "";
    if (!firstLine.trim()) continue;

    const label = firstLine.length > 54 ? firstLine.slice(0, 54) + "…" : firstLine;
    const role = event.role === "user" ? "user" : "assistant";
    const displayRole = role === "user" ? "You" : "Claude";
    idx++;

    items.push(`
      <li class="outline-item outline-${role}">
        <a href="#${escapeHtml(event.id)}">
          <span class="outline-idx">${String(idx).padStart(2, "0")}</span>
          <span class="outline-role">${escapeHtml(displayRole)}</span>
          <span class="outline-label">${escapeHtml(label)}</span>
        </a>
      </li>
    `);
  }

  return items.join("");
}

function buildMetaHtml(session: NormalizedSession): string {
  const parts: string[] = [];

  if (session.root.startedAt) {
    const dateStr = formatShortDate(session.root.startedAt);
    const timeStr = formatShortTime(session.root.startedAt);
    if (dateStr && timeStr) {
      parts.push(`<span class="chat-meta-item">${escapeHtml(dateStr)} · ${escapeHtml(timeStr)}</span>`);
    }
  }

  if (session.stats.messageCount > 0) {
    parts.push(`<span class="chat-meta-item">${session.stats.messageCount} messages</span>`);
  }

  if (session.root.gitBranch) {
    parts.push(`<span class="chat-meta-item">&#8282; ${escapeHtml(session.root.gitBranch)}</span>`);
  }

  return parts
    .map((item, i) => (i < parts.length - 1 ? item + `<span class="chat-meta-sep"></span>` : item))
    .join("");
}

export async function renderSessionPage(publicId: string, session: NormalizedSession): Promise<string> {
  resetDiffBudget();
  const hasMultipleThreads = session.threads.length > 1;
  const renderedThreads = await Promise.all(
    session.threads.map((thread) =>
      renderThread(thread, {
        showHeader: hasMultipleThreads || thread.kind !== "main",
      }),
    ),
  );

  const title = session.root.title ?? session.root.sessionId;
  const outlineItems = buildOutlineItems(session);
  const metaHtml = buildMetaHtml(session);
  const cwd = session.root.cwd ?? session.root.projectPath ?? "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} • agent thread</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <script>${renderThemeBootScript()}</script>
    <style>
${pageStyles}
    </style>
  </head>
  <body>

    <!-- App switcher bar -->
    <header class="app-switcher">
      <div class="switcher-brand">
        <div class="switcher-mark">${SPARKLE_SVG}</div>
        <b>agent thread</b>
        <span class="switcher-dim">/ ${escapeHtml(publicId)}</span>
      </div>
      <div class="switcher-right">
        <span class="switcher-dot"></span>
        <span>public · anyone with the link</span>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch theme">
          <span class="theme-toggle-icon" aria-hidden="true">◐</span>
          <span class="theme-toggle-label" data-theme-toggle-label>Theme</span>
        </button>
      </div>
    </header>

    <!-- Chat shell -->
    <div class="chat-shell">

      <!-- Left sidebar -->
      <aside class="chat-side">
        <nav class="chat-outline" aria-label="Conversation outline">
          <div class="outline-head">Turns</div>
          <ol class="outline-list">
            ${outlineItems || `<li style="font-size:12px;color:var(--faint);padding:4px 8px;">No messages</li>`}
          </ol>
        </nav>
        <div class="chat-side-footer">
          ${cwd ? `<div class="mini-card"><div class="mini-card-label">Working dir</div><div class="mini-card-value mono">${escapeHtml(cwd)}</div></div>` : ""}
          <div class="mini-card"><div class="mini-card-label">Events</div><div class="mini-card-value">${session.stats.eventCount}</div></div>
        </div>
      </aside>

      <!-- Main content -->
      <main class="chat-main">
        <header class="chat-header">
          <div class="chat-header-top">
            <div class="chat-crumbs">
              <span class="crumb">threads</span>
              <span class="crumb-sep">›</span>
              <span class="crumb crumb-active">${escapeHtml(publicId)}</span>
            </div>
            <div class="chat-header-actions">
              <button class="btn-share" onclick="navigator.clipboard?.writeText(location.href)">
                Copy link
              </button>
            </div>
          </div>
          <h1 class="chat-title">${escapeHtml(title)}</h1>
          <div class="chat-meta">
            ${metaHtml}
          </div>
        </header>

        <div class="chat-stream">
          ${renderedThreads.join("")}
          <div class="chat-end">
            <div class="chat-end-dot"></div>
            <span>Conversation ended</span>
          </div>
        </div>
      </main>

    </div>

    ${renderImageLightbox()}
    <script>${renderViewClientScript()}</script>
  </body>
</html>`;
}
