"use client";

import * as React from "react";
import { Brain, ChevronsDownUp, Link, Search, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function detailsNodes(): HTMLDetailsElement[] {
  return Array.from(
    document.querySelectorAll<HTMLDetailsElement>(
      "details.tool-call-disclosure, details.tool-result-disclosure, details.parallel-tool-batch, details.block.thinking, details.codex-token-bubble",
    ),
  );
}

function setDetailsOpen(open: boolean) {
  for (const node of detailsNodes()) {
    node.open = open;
  }
}

function clearSearchMarks() {
  document.querySelectorAll<HTMLElement>(".search-match, .search-current").forEach((node) => {
    node.classList.remove("search-match", "search-current");
  });
}

export function TranscriptControls() {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [matches, setMatches] = React.useState<HTMLElement[]>([]);
  const [matchIndex, setMatchIndex] = React.useState(0);
  const [thinkingVisible, setThinkingVisible] = React.useState(true);

  React.useEffect(() => {
    document.documentElement.dataset.thinking = thinkingVisible ? "visible" : "hidden";
  }, [thinkingVisible]);

  React.useEffect(() => {
    clearSearchMarks();
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      setMatches([]);
      setMatchIndex(0);
      return;
    }

    const found = Array.from(document.querySelectorAll<HTMLElement>(".conversation-feed .msg, .activity-card")).filter((node) =>
      node.innerText.toLowerCase().includes(trimmed),
    );

    for (const node of found) {
      node.classList.add("search-match");
    }

    setMatches(found);
    setMatchIndex(0);
  }, [query]);

  React.useEffect(() => {
    document.querySelectorAll<HTMLElement>(".search-current").forEach((node) => node.classList.remove("search-current"));
    const current = matches[matchIndex];
    if (!current) return;
    current.classList.add("search-current");
    current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [matches, matchIndex]);

  const moveMatch = (delta: 1 | -1) => {
    if (matches.length === 0) return;
    setMatchIndex((index) => (index + delta + matches.length) % matches.length);
  };

  const collapseAll = () => {
    setDetailsOpen(false);
  };

  const share = async () => {
    const shareData = { title: document.title, url: location.href };
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard?.writeText(location.href);
    toast("Link copied");
  };

  return (
    <div className="chat-controls" aria-label="Transcript controls">
      <div className="chat-control-row">
        <div className="control-group">
          <Button type="button" variant="outline" size="sm" className="control-button" onClick={() => setSearchOpen((open) => !open)}>
            <Search className="size-3.5" aria-hidden="true" />
            <span>Search</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="control-button" onClick={collapseAll}>
            <ChevronsDownUp className="size-3.5" aria-hidden="true" />
            <span>Collapse all</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={thinkingVisible}
            className={cn("control-button", thinkingVisible && "is-active")}
            onClick={() => setThinkingVisible((value) => !value)}
          >
            <Brain className="size-3.5" aria-hidden="true" />
            <span>Thinking</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="control-button" onClick={share}>
            <Share2 className="size-3.5" aria-hidden="true" />
            <span>Share</span>
          </Button>
        </div>
      </div>

      {searchOpen ? (
        <div className="search-panel">
          <Search className="size-3.5" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search transcript"
            aria-label="Search transcript"
          />
          <span className="search-count">{query.trim() ? `${matches.length ? matchIndex + 1 : 0}/${matches.length}` : "0/0"}</span>
          <button type="button" onClick={() => moveMatch(-1)} disabled={matches.length === 0}>
            Prev
          </button>
          <button type="button" onClick={() => moveMatch(1)} disabled={matches.length === 0}>
            Next
          </button>
          <button
            type="button"
            className="search-link-button"
            onClick={() => {
              const id = matches[matchIndex]?.id;
              if (id) {
                void navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${id}`);
                toast("Message link copied");
              }
            }}
            disabled={!matches[matchIndex]?.id}
          >
            <Link className="size-3.5" aria-hidden="true" />
            Link
          </button>
        </div>
      ) : null}
    </div>
  );
}
