import type { Metadata } from "next";

import { AppHeader } from "@/components/app-shell";
import { CopyButton } from "@/components/copy-button";
import { SessionNotFound } from "@/components/session-not-found";
import { TranscriptClientEnhancements } from "@/components/transcript/client-enhancements";
import { TranscriptControls } from "@/components/transcript/transcript-controls";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAgentThreadEnv } from "@/lib/cloudflare";
import { buildThreadOgImageUrl, buildThreadUrl, OG_IMAGE_SIZE, resolvePublicBaseUrl } from "@/lib/og";
import { loadSessionByPublicId } from "@/lib/storage";
import { getSourceInfo } from "@/lib/thread-source";
import type { NormalizedSession } from "@/src/shared/contracts";
import { Thread } from "@/components/transcript/thread";
import { ImportCard } from "@/components/transcript/import-card";
import { resetDiffBudget } from "@/lib/transcript/diff";
import {
  buildCursorHref,
  cursorForEventIndex,
  parseTranscriptCursor,
  sliceSessionForEventPage,
  TRANSCRIPT_EVENT_PAGE_SIZE,
  type TranscriptEventPage,
} from "@/lib/transcript/pagination";
import { formatShortDate, formatShortTime } from "@/lib/transcript/utils";
import { DEFAULT_SERVER_URL } from "@/src/cli/args";

export const dynamic = "force-dynamic";

type ThreadPageProps = {
  params: Promise<{ publicId: string }>;
  searchParams?: Promise<{ cursor?: string | string[] }>;
};

type OutlineItem = {
  id: string;
  index: string;
  label: string;
  role: "user" | "assistant";
  displayRole: string;
  href: string;
};

function getAssistantLabel(session: NormalizedSession): string {
  return getSourceInfo(session).assistantLabel;
}

function buildOutlineItems(session: NormalizedSession, publicId: string): OutlineItem[] {
  const mainThread = session.threads.find((thread) => thread.kind === "main") ?? session.threads[0];
  const assistantLabel = getAssistantLabel(session);

  if (!mainThread) {
    return [];
  }

  let mainThreadOffset = 0;
  for (const thread of session.threads) {
    if (thread.id === mainThread.id) break;
    mainThreadOffset += thread.events.length;
  }
  const items: OutlineItem[] = [];

  for (let eventIndex = 0; eventIndex < mainThread.events.length; eventIndex += 1) {
    const event = mainThread.events[eventIndex]!;
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
      href: buildCursorHref(
        publicId,
        cursorForEventIndex(mainThreadOffset + eventIndex, TRANSCRIPT_EVENT_PAGE_SIZE),
        event.id,
      ),
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

function TranscriptPageNav({ publicId, page }: { publicId: string; page: TranscriptEventPage }) {
  if (page.totalEvents <= page.limit) {
    return null;
  }

  const rangeLabel =
    page.renderedEventCount > 0
      ? `Showing events ${page.startEventNumber.toLocaleString("en-US")}-${page.endEventNumber.toLocaleString("en-US")} of ${page.totalEvents.toLocaleString("en-US")}`
      : `No events to show out of ${page.totalEvents.toLocaleString("en-US")}`;

  return (
    <nav className="transcript-page-nav" aria-label="Transcript event pages">
      <div>
        <div className="transcript-page-label">Large transcript</div>
        <div className="transcript-page-range">{rangeLabel}</div>
      </div>
      <div className="transcript-page-actions">
        {page.previousCursor === null ? (
          <span className="transcript-page-button transcript-page-button-disabled">Previous</span>
        ) : (
          <a className="transcript-page-button" href={buildCursorHref(publicId, page.previousCursor)}>
            Previous
          </a>
        )}
        {page.nextCursor === null ? (
          <span className="transcript-page-button transcript-page-button-disabled">Next</span>
        ) : (
          <a className="transcript-page-button" href={buildCursorHref(publicId, page.nextCursor)}>
            Next
          </a>
        )}
      </div>
    </nav>
  );
}

async function loadThreadPageData(publicId: string) {
  return loadSessionByPublicId(getAgentThreadEnv(), publicId);
}

export async function generateMetadata({ params }: ThreadPageProps): Promise<Metadata> {
  const { publicId } = await params;
  const env = getAgentThreadEnv();
  const result = await loadSessionByPublicId(env, publicId);

  if (!result) {
    return {
      title: "Session not found • agent thread",
    };
  }

  const title = result.session.root.title ?? result.session.root.sessionId;
  const sourceInfo = getSourceInfo(result.session);
  const description = `A shared ${sourceInfo.label} session transcript.`;
  const publicBaseUrl = resolvePublicBaseUrl(env.PUBLIC_BASE_URL ?? env.AGENT_THREAD_SERVER_URL, DEFAULT_SERVER_URL);
  const threadUrl = buildThreadUrl(publicBaseUrl, publicId);
  const ogImageUrl = buildThreadOgImageUrl(publicBaseUrl, publicId);
  const imageAlt = `${title} • agent thread`;

  return {
    title: `${title} • agent thread`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: threadUrl,
      siteName: "agent thread",
      images: [
        {
          url: ogImageUrl,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ThreadPage({ params, searchParams }: ThreadPageProps) {
  const { publicId } = await params;
  const cursor = parseTranscriptCursor((await searchParams)?.cursor);
  const result = await loadThreadPageData(publicId);

  if (!result) {
    return <SessionNotFound />;
  }

  const fullSession = result.session;
  const eventPage = sliceSessionForEventPage(fullSession, cursor, TRANSCRIPT_EVENT_PAGE_SIZE);
  const { session } = eventPage;
  resetDiffBudget();

  const hasMultipleThreads = fullSession.threads.length > 1;
  const title = fullSession.root.title ?? fullSession.root.sessionId;
  const outlineItems = buildOutlineItems(fullSession, publicId);
  const metaItems = buildMetaItems(fullSession);
  const cwd = fullSession.root.cwd ?? fullSession.root.projectPath ?? "";
  const sourceInfo = getSourceInfo(fullSession);
  const assistantLabel = sourceInfo.assistantLabel;
  const env = getAgentThreadEnv();
  const publicBaseUrl = resolvePublicBaseUrl(env.PUBLIC_BASE_URL ?? env.AGENT_THREAD_SERVER_URL, DEFAULT_SERVER_URL);

  return (
    <>
      <AppHeader publicId={publicId} />
      <div key={publicId} className="chat-shell" data-transcript>
        <aside className="chat-side">
          <ScrollArea className="chat-outline">
            <nav aria-label="Conversation outline">
              <div className="outline-head">Turns</div>
              <ol className="outline-list">
                {outlineItems.length > 0 ? (
                  outlineItems.map((item) => (
                    <li key={item.id} className={`outline-item outline-${item.role}`}>
                      <a href={item.href}>
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
            <TranscriptControls />
          </header>

          <div className="chat-stream">
            <ImportCard publicId={publicId} serverUrl={publicBaseUrl} source={session.source} />
            <TranscriptPageNav publicId={publicId} page={eventPage} />
            <div>
              {session.threads.map((thread) => (
                <Thread
                  key={thread.id}
                  thread={thread}
                  showHeader={hasMultipleThreads || thread.kind !== "main"}
                  assistantLabel={assistantLabel}
                  startedAt={session.root.startedAt}
                />
              ))}
            </div>
            <TranscriptPageNav publicId={publicId} page={eventPage} />
            {eventPage.nextCursor === null ? (
              <div className="chat-end">
                <div className="chat-end-dot" />
                <span>Conversation ended</span>
              </div>
            ) : null}
          </div>
        </main>
      </div>
      <TranscriptClientEnhancements key={publicId} />
    </>
  );
}
