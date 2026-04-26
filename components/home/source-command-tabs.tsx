"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { CopyCommandRow } from "./copy-command-row";

type SourceId = "claude" | "codex";

const sources: Array<{
  id: SourceId;
  label: string;
  icon: string;
  commands: string[];
}> = [
  {
    id: "claude",
    label: "Claude Code",
    icon: "/claudecode-color.svg",
    commands: ["bunx agent-thread@latest", "npx agent-thread@latest", "pnpx agent-thread@latest"],
  },
  {
    id: "codex",
    label: "Codex",
    icon: "/codex-color.svg",
    commands: [
      "bunx agent-thread@latest --codex",
      "npx agent-thread@latest --codex",
      "pnpx agent-thread@latest --codex",
    ],
  },
];

export function SourceCommandTabs() {
  const [activeSource, setActiveSource] = React.useState<SourceId>("claude");
  const selected = sources.find((source) => source.id === activeSource) ?? sources[0]!;

  return (
    <div className="grid gap-3">
      <div
        role="tablist"
        aria-label="Session source"
        className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary p-1"
      >
        {sources.map((source) => {
          const active = source.id === activeSource;

          return (
            <button
              key={source.id}
              id={`source-tab-${source.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`source-panel-${source.id}`}
              onClick={() => setActiveSource(source.id)}
              className={cn(
                "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active && "bg-background text-foreground shadow-sm",
              )}
            >
              <img src={source.icon} alt="" aria-hidden="true" className="size-4.5 shrink-0" />
              <span className="truncate">{source.label}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`source-panel-${selected.id}`}
        role="tabpanel"
        aria-labelledby={`source-tab-${selected.id}`}
        className="grid gap-2"
      >
        {selected.commands.map((command) => (
          <CopyCommandRow key={command} command={command} />
        ))}
      </div>
    </div>
  );
}
