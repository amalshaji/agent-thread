import * as React from "react";

import { Thread } from "@/components/transcript/thread";
import { loadSessionByPublicId } from "@/lib/storage";
import { getSourceInfo } from "@/lib/thread-source";
import { resetDiffBudget } from "@/lib/transcript/diff";
import {
  parseTranscriptCursor,
  sliceSessionForEventPage,
  TRANSCRIPT_EVENT_PAGE_SIZE,
  type TranscriptEventPage,
} from "@/lib/transcript/pagination";

type RenderedEventsPage = Omit<TranscriptEventPage, "session">;

function responsePage(page: TranscriptEventPage): RenderedEventsPage {
  return {
    cursor: page.cursor,
    limit: page.limit,
    totalEvents: page.totalEvents,
    renderedEventCount: page.renderedEventCount,
    startEventNumber: page.startEventNumber,
    endEventNumber: page.endEventNumber,
    previousCursor: page.previousCursor,
    nextCursor: page.nextCursor,
  };
}

async function renderToHtml(element: React.ReactElement): Promise<string> {
  const { renderToReadableStream } = await import("react-dom/server");
  const stream = await renderToReadableStream(element);
  await stream.allReady;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let html = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    html += decoder.decode(value, { stream: true });
  }

  html += decoder.decode();
  return html;
}

export async function buildSessionEventsResponse(
  env: { DB: D1Database; SESSIONS_BUCKET: R2Bucket },
  publicId: string,
  cursorValue?: string | string[] | null,
): Promise<Response> {
  const result = await loadSessionByPublicId(env, publicId);

  if (!result) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const cursor = parseTranscriptCursor(cursorValue ?? undefined);
  const fullSession = result.session;
  const page = sliceSessionForEventPage(fullSession, cursor, TRANSCRIPT_EVENT_PAGE_SIZE);
  const assistantLabel = getSourceInfo(fullSession).assistantLabel;
  const hasMultipleThreads = fullSession.threads.length > 1;

  resetDiffBudget();

  const html = await renderToHtml(
    React.createElement(
      React.Fragment,
      null,
      page.session.threads.map((thread) =>
        React.createElement(Thread, {
          key: thread.id,
          thread,
          showHeader: hasMultipleThreads || thread.kind !== "main",
          assistantLabel,
          startedAt: fullSession.root.startedAt,
        }),
      ),
    ),
  );

  return Response.json({
    html,
    page: responsePage(page),
  });
}
