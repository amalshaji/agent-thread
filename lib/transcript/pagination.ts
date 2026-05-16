import type { NormalizedEvent, NormalizedSession, NormalizedThread } from "@/src/shared/contracts";

export const TRANSCRIPT_EVENT_PAGE_SIZE = 120;

export type TranscriptEventPage = {
  session: NormalizedSession;
  cursor: number;
  limit: number;
  totalEvents: number;
  renderedEventCount: number;
  startEventNumber: number;
  endEventNumber: number;
  previousCursor: number | null;
  nextCursor: number | null;
};

export function parseTranscriptCursor(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 0;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function cursorForEventIndex(eventIndex: number, limit = TRANSCRIPT_EVENT_PAGE_SIZE): number {
  if (!Number.isFinite(eventIndex) || eventIndex <= 0) return 0;
  return Math.floor(eventIndex / limit) * limit;
}

export function buildCursorHref(publicId: string, cursor: number, anchorId?: string): string {
  const base = `/t/${encodeURIComponent(publicId)}`;
  const query = cursor > 0 ? `?cursor=${cursor}` : "";
  const hash = anchorId ? `#${encodeURIComponent(anchorId)}` : "";
  return `${base}${query}${hash}`;
}

function countEvents(session: NormalizedSession): number {
  return session.threads.reduce((total, thread) => total + thread.events.length, 0);
}

function sliceThread(thread: NormalizedThread, start: number, limit: number): NormalizedThread | null {
  const events = thread.events.slice(start, start + limit);
  if (events.length === 0) return null;

  return {
    ...thread,
    rootEventIds: filterRootEventIds(thread.rootEventIds, events),
    events,
  };
}

function filterRootEventIds(rootEventIds: string[], events: NormalizedEvent[]): string[] {
  const renderedEventIds = new Set(events.map((event) => event.id));
  return rootEventIds.filter((id) => renderedEventIds.has(id));
}

export function sliceSessionForEventPage(
  session: NormalizedSession,
  requestedCursor: number,
  limit = TRANSCRIPT_EVENT_PAGE_SIZE,
): TranscriptEventPage {
  const totalEvents = countEvents(session);
  const safeLimit = Math.max(1, Math.floor(limit));
  const maxCursor = Math.max(totalEvents - 1, 0);
  const cursor = totalEvents === 0 ? 0 : Math.min(Math.max(0, Math.floor(requestedCursor)), maxCursor);

  const renderedThreads: NormalizedThread[] = [];
  let eventsToSkip = cursor;
  let eventsToTake = safeLimit;
  let renderedEventCount = 0;

  for (const thread of session.threads) {
    if (eventsToTake <= 0) break;

    if (eventsToSkip >= thread.events.length) {
      eventsToSkip -= thread.events.length;
      continue;
    }

    const slicedThread = sliceThread(thread, eventsToSkip, eventsToTake);
    eventsToSkip = 0;

    if (!slicedThread) {
      continue;
    }

    renderedThreads.push(slicedThread);
    renderedEventCount += slicedThread.events.length;
    eventsToTake -= slicedThread.events.length;
  }

  const nextCursor = cursor + renderedEventCount < totalEvents ? cursor + renderedEventCount : null;
  const previousCursor = cursor > 0 ? Math.max(cursor - safeLimit, 0) : null;

  return {
    session: {
      ...session,
      threads: renderedThreads,
    },
    cursor,
    limit: safeLimit,
    totalEvents,
    renderedEventCount,
    startEventNumber: renderedEventCount > 0 ? cursor + 1 : 0,
    endEventNumber: cursor + renderedEventCount,
    previousCursor,
    nextCursor,
  };
}
