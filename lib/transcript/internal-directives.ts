const INTERNAL_DIRECTIVE_RE = /^::(?:archive|code-comment|git-[a-z-]+)\{.*\}$/;

function fenceMarker(line: string): "`" | "~" | null {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("```")) return "`";
  if (trimmed.startsWith("~~~")) return "~";
  return null;
}

export function stripInternalTranscriptDirectives(value: string): string {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let fence: "`" | "~" | null = null;
  let inMemoryCitation = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const marker = fenceMarker(line);

    if (fence === null && marker !== null) {
      fence = marker;
      kept.push(line);
      continue;
    }

    if (fence !== null) {
      kept.push(line);
      if (marker === fence) {
        fence = null;
      }
      continue;
    }

    if (inMemoryCitation) {
      if (trimmed === "</oai-mem-citation>") {
        inMemoryCitation = false;
      }
      continue;
    }

    if (trimmed === "<oai-mem-citation>") {
      inMemoryCitation = true;
      continue;
    }

    if (INTERNAL_DIRECTIVE_RE.test(trimmed)) {
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function hasVisibleTranscriptText(value: string): boolean {
  return stripInternalTranscriptDirectives(value).trim().length > 0;
}
