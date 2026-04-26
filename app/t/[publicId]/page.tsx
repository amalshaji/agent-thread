import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/app-shell";
import { CopyButton } from "@/components/copy-button";
import { TranscriptClientEnhancements } from "@/components/transcript/client-enhancements";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAgentThreadEnv } from "@/lib/cloudflare";
import { loadSessionByPublicId } from "@/lib/storage";
import type { NormalizedSession } from "@/src/shared/contracts";
import { Thread } from "@/components/transcript/thread";
import { resetDiffBudget } from "@/lib/transcript/diff";
import { formatShortDate, formatShortTime } from "@/lib/transcript/utils";

export const dynamic = "force-dynamic";

type ThreadPageProps = {
  params: Promise<{ publicId: string }>;
};

type OutlineItem = {
  id: string;
  index: string;
  label: string;
  role: "user" | "assistant";
  displayRole: string;
};

type SourceInfo = {
  label: string;
  assistantLabel: string;
  logoSrc: string;
};

function getSourceInfo(session: NormalizedSession): SourceInfo {
  if (session.source === "codex") {
    return {
      label: "Codex",
      assistantLabel: "Codex",
      logoSrc: "/codex-color.svg",
    };
  }

  return {
    label: "Claude Code",
    assistantLabel: "Claude",
    logoSrc: "/claudecode-color.svg",
  };
}

function getAssistantLabel(session: NormalizedSession): string {
  return getSourceInfo(session).assistantLabel;
}

function buildOutlineItems(session: NormalizedSession): OutlineItem[] {
  const mainThread = session.threads.find((thread) => thread.kind === "main") ?? session.threads[0];
  const assistantLabel = getAssistantLabel(session);

  if (!mainThread) {
    return [];
  }

  const items: OutlineItem[] = [];

  for (const event of mainThread.events) {
    if (event.role !== "user" && event.role !== "assistant") {
      continue;
    }

    if (event.displayKind === "tool_result" || event.displayKind === "tool_use" || event.displayKind === "thinking") {
      continue;
    }

    const textBlock = event.blocks.find((block) => block.kind === "text");
    if (!textBlock || textBlock.kind !== "text" || !textBlock.text.trim()) {
      continue;
    }

    const firstLine = textBlock.text.split("\n").find((line) => line.trim()) ?? "";
    if (!firstLine.trim()) {
      continue;
    }

    const role = event.role === "user" ? "user" : "assistant";
    const label = firstLine.length > 54 ? `${firstLine.slice(0, 54)}...` : firstLine;

    items.push({
      id: event.id,
      index: String(items.length + 1).padStart(2, "0"),
      label,
      role,
      displayRole: role === "user" ? "You" : assistantLabel,
    });
  }

  return items;
}

function buildMetaItems(session: NormalizedSession): string[] {
  const parts: string[] = [];

  if (session.root.startedAt) {
    const dateStr = formatShortDate(session.root.startedAt);
    const timeStr = formatShortTime(session.root.startedAt);
    if (dateStr && timeStr) {
      parts.push(`${dateStr} · ${timeStr}`);
    }
  }

  if (session.stats.messageCount > 0) {
    parts.push(`${session.stats.messageCount} messages`);
  }

  if (session.root.gitBranch) {
    parts.push(`⁂ ${session.root.gitBranch}`);
  }

  return parts;
}

async function loadThreadPageData(publicId: string) {
  return loadSessionByPublicId(getAgentThreadEnv(), publicId);
}

export async function generateMetadata({ params }: ThreadPageProps): Promise<Metadata> {
  const { publicId } = await params;
  const result = await loadThreadPageData(publicId);

  if (!result) {
    return {
      title: "Session not found • agent thread",
    };
  }

  const title = result.session.root.title ?? result.session.root.sessionId;
  const sourceInfo = getSourceInfo(result.session);
  return {
    title: `${title} • agent thread`,
    description: `A shared ${sourceInfo.label} session transcript.`,
    openGraph: {
      title,
      description: `A shared ${sourceInfo.label} session transcript.`,
      type: "article",
    },
  };
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { publicId } = await params;
  const result = await loadThreadPageData(publicId);

  if (!result) {
    notFound();
  }

  const { session } = result;
  resetDiffBudget();

  const hasMultipleThreads = session.threads.length > 1;
  const title = session.root.title ?? session.root.sessionId;
  const outlineItems = buildOutlineItems(session);
  const metaItems = buildMetaItems(session);
  const cwd = session.root.cwd ?? session.root.projectPath ?? "";
  const sourceInfo = getSourceInfo(session);
  const assistantLabel = sourceInfo.assistantLabel;

  return (
    <>
      <AppHeader publicId={publicId} />
      <div className="chat-shell" data-transcript>
        <aside className="chat-side">
          <ScrollArea className="chat-outline">
            <nav aria-label="Conversation outline">
              <div className="outline-head">Turns</div>
              <ol className="outline-list">
                {outlineItems.length > 0 ? (
                  outlineItems.map((item) => (
                    <li key={item.id} className={`outline-item outline-${item.role}`}>
                      <a href={`#${item.id}`}>
                        <span className="outline-idx">{item.index}</span>
                        <span className="outline-role">{item.displayRole}</span>
                        <span className="outline-label">{item.label}</span>
                      </a>
                    </li>
                  ))
                ) : (
                  <li className="px-2 py-1 text-xs text-muted-foreground">No messages</li>
                )}
              </ol>
            </nav>
          </ScrollArea>
          <div className="chat-side-footer">
            <div className="mini-card source-mini-card">
              <div className="mini-card-label">Source</div>
              <div className="mini-card-value source-mini-value">
                <img className="source-logo" src={sourceInfo.logoSrc} alt="" aria-hidden="true" />
                <span>{sourceInfo.label}</span>
              </div>
            </div>
            {cwd ? (
              <div className="mini-card">
                <div className="mini-card-label">Working dir</div>
                <div className="mini-card-value mono">{cwd}</div>
              </div>
            ) : null}
            <div className="mini-card">
              <div className="mini-card-label">Events</div>
              <div className="mini-card-value">{session.stats.eventCount}</div>
            </div>
          </div>
        </aside>

        <main className="chat-main">
          <header className="chat-header">
            <div className="chat-header-top">
              <div className="chat-crumbs">
                <span className="crumb">threads</span>
                <span className="crumb-sep">›</span>
                <span className="crumb crumb-active">{publicId}</span>
              </div>
              <div className="chat-header-actions">
                <span className="source-badge" aria-label={`Source: ${sourceInfo.label}`}>
                  <img className="source-logo" src={sourceInfo.logoSrc} alt="" aria-hidden="true" />
                  <span>{sourceInfo.label}</span>
                </span>
                <CopyButton label="Copy link" copiedLabel="Link copied" />
              </div>
            </div>
            <h1 className="chat-title">{title}</h1>
            <div className="chat-meta">
              {metaItems.map((item, index) => (
                <span className="chat-meta-item" key={item}>
                  {item}
                  {index < metaItems.length - 1 ? <span className="chat-meta-sep" /> : null}
                </span>
              ))}
            </div>
          </header>

          <div className="chat-stream">
            <div>
              {session.threads.map((thread) => (
                <Thread
                  key={thread.id}
                  thread={thread}
                  showHeader={hasMultipleThreads || thread.kind !== "main"}
                  assistantLabel={assistantLabel}
                />
              ))}
            </div>
            <div className="chat-end">
              <div className="chat-end-dot" />
              <span>Conversation ended</span>
            </div>
          </div>
        </main>
      </div>
      <TranscriptClientEnhancements />
    </>
  );
}
