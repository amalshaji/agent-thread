"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";

type Target = "claude" | "codex";

const targets: Array<{ id: Target; label: string; icon: string }> = [
  { id: "claude", label: "Claude Code", icon: "/claudecode-color.svg" },
  { id: "codex", label: "Codex", icon: "/codex-color.svg" },
];

type ImportCardProps = {
  publicId: string;
  serverUrl: string;
  defaultTarget?: Target;
};

export function ImportCard({ publicId, serverUrl, defaultTarget = "claude" }: ImportCardProps) {
  const [active, setActive] = React.useState<Target>(defaultTarget);
  const command = `npx agent-thread --import ${serverUrl}/t/${publicId} --to ${active}`;

  return (
    <div className="import-card">
      <div className="import-card-heading">Continue where they left off</div>
      <div
        role="tablist"
        aria-label="Import target"
        className="import-card-tabs"
      >
        {targets.map((target) => (
          <button
            key={target.id}
            type="button"
            role="tab"
            aria-selected={active === target.id}
            onClick={() => setActive(target.id)}
            className={cn("import-tab", active === target.id && "import-tab-active")}
          >
            <img src={target.icon} alt="" aria-hidden="true" className="import-tab-icon" />
            {target.label}
          </button>
        ))}
      </div>
      <div className="import-command">
        <code className="import-command-text">{command}</code>
        <CopyButton value={command} label="Copy" copiedLabel="Copied" size="sm" />
      </div>
    </div>
  );
}
