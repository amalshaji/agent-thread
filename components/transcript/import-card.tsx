"use client";

import { CopyButton } from "@/components/copy-button";
import { getSourceInfo } from "@/lib/thread-source";
import type { UploadSource } from "@/src/shared/contracts";

type ImportCardProps = {
  publicId: string;
  serverUrl: string;
  source: UploadSource;
};

export function ImportCard({ publicId, serverUrl, source }: ImportCardProps) {
  const sourceInfo = getSourceInfo({ source });
  const command = `bunx agent-thread --import ${serverUrl}/t/${publicId}`;

  return (
    <div className="import-card">
      <div className="import-card-copy">
        <div className="import-card-heading">Import into {sourceInfo.label}</div>
        <p className="import-card-subtitle">Restore this shared session back into the same local app it came from.</p>
      </div>
      <div className="import-command">
        <img className="import-command-icon" src={sourceInfo.logoSrc} alt="" aria-hidden="true" />
        <code className="import-command-text">{command}</code>
        <CopyButton value={command} label="Copy" copiedLabel="Copied" className="import-copy-button" size="sm" />
      </div>
    </div>
  );
}
