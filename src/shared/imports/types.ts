import type { RawUploadFile, UploadSource } from "../contracts";

export type ImportTarget = "claude" | "codex";

export interface ImportOptions {
  workspace: string;
  claudeHome?: string;
  codexHome?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface ImportPreparedFile {
  rawFile: RawUploadFile;
  targetPath: string;
  content: string;
}

export interface ImportResult {
  source: UploadSource;
  target: ImportTarget;
  workspace: string;
  dryRun: boolean;
  files: Array<{
    kind: "main" | "sidechain";
    threadId: string;
    path: string;
    bytes: number;
    existed: boolean;
    written: boolean;
  }>;
  warnings: string[];
}
