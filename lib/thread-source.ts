import type { UploadSource } from "@/src/shared/contracts";

export type SourceInfo = {
  label: string;
  assistantLabel: string;
  logoSrc: string;
};

export function getSourceInfo(session: { source: UploadSource }): SourceInfo {
  if (session.source === "codex") {
    return {
      label: "Codex",
      assistantLabel: "Codex",
      logoSrc: "/codex-color.svg",
    };
  }

  return {
    label: "Claude Code",
    assistantLabel: "Claude",
    logoSrc: "/claudecode-color.svg",
  };
}
