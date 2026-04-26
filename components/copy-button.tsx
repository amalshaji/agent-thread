"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value?: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  size?: "sm" | "default";
};

export function CopyButton({ value, label = "Copy", copiedLabel = "Copied", className, size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    await navigator.clipboard?.writeText(value ?? location.href);
    setCopied(true);
    toast(copiedLabel);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      title={copied ? copiedLabel : label}
      onClick={copy}
      className={cn("border-border bg-card text-foreground hover:bg-secondary", className)}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span>{copied ? copiedLabel : label}</span>
    </Button>
  );
}
