"use client";

import * as React from "react";

import { TRANSCRIPT_CONTENT_APPENDED_EVENT } from "./client-enhancements";

type InfiniteLoaderProps = {
  publicId: string;
  initialNextCursor: number | null;
};

type EventsResponse = {
  html: string;
  page: {
    nextCursor: number | null;
  };
};

type LoadState = "idle" | "loading" | "error" | "done";

function isEventsResponse(value: unknown): value is EventsResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const page = record.page as Record<string, unknown> | undefined;
  return (
    typeof record.html === "string" &&
    Boolean(page) &&
    (typeof page?.nextCursor === "number" || page?.nextCursor === null)
  );
}

export function TranscriptInfiniteLoader({ publicId, initialNextCursor }: InfiniteLoaderProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const loadingRef = React.useRef(false);
  const [nextCursor, setNextCursor] = React.useState<number | null>(initialNextCursor);
  const [state, setState] = React.useState<LoadState>(initialNextCursor === null ? "done" : "idle");

  const loadNext = React.useCallback(async () => {
    if (nextCursor === null || loadingRef.current || !containerRef.current) {
      return;
    }

    loadingRef.current = true;
    setState("loading");

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(publicId)}/events?cursor=${nextCursor}`, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Failed to load transcript events: ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (!isEventsResponse(payload)) {
        throw new Error("Unexpected transcript events response.");
      }

      containerRef.current.insertAdjacentHTML("beforeend", payload.html);
      setNextCursor(payload.page.nextCursor);
      setState(payload.page.nextCursor === null ? "done" : "idle");
      window.dispatchEvent(new CustomEvent(TRANSCRIPT_CONTENT_APPENDED_EVENT));
    } catch {
      setState("error");
    } finally {
      loadingRef.current = false;
    }
  }, [nextCursor, publicId]);

  React.useEffect(() => {
    if (nextCursor === null || state === "error") {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNext();
        }
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNext, nextCursor, state]);

  return (
    <>
      <div ref={containerRef} />
      <div ref={sentinelRef} className="transcript-infinite-sentinel" aria-hidden="true" />
      <div className="transcript-load-state" aria-live="polite">
        {state === "loading" ? <span>Loading more events...</span> : null}
        {state === "error" ? (
          <button type="button" className="transcript-retry-button" onClick={() => void loadNext()}>
            Retry loading events
          </button>
        ) : null}
        {state === "done" ? (
          <div className="chat-end">
            <div className="chat-end-dot" />
            <span>Conversation ended</span>
          </div>
        ) : null}
      </div>
    </>
  );
}
