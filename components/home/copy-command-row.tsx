"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type CopyCommandRowProps = {
  command: string;
};

export function CopyCommandRow({ command }: CopyCommandRowProps) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    await navigator.clipboard?.writeText(command);
    setCopied(true);
    toast("Command copied");
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-secondary px-3 py-2.5">
      <code className="truncate font-mono text-[13px] text-secondary-foreground">{command}</code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        className="h-7 px-2 font-mono text-[11px] text-muted-foreground hover:bg-background hover:text-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        <span>{copied ? "copied" : "copy"}</span>
      </Button>
    </div>
  );
}
