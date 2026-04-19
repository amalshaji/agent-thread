import { extractPatch, renderDiffBlock } from "./diff";
import { renderMarkdownBlock } from "./markdown";

function isStandalonePatchText(value: string): boolean {
  const trimmed = value.trimStart();

  return (
    trimmed.startsWith("diff --git ") ||
    trimmed.startsWith("--- ") ||
    /^```(?:diff|patch)\s*\n/i.test(trimmed)
  );
}

export async function renderTextContent(value: string): Promise<string> {
  const patch = isStandalonePatchText(value) ? extractPatch(value) : null;

  if (patch) {
    const diffHtml = await renderDiffBlock(patch);
    if (diffHtml) {
      return diffHtml;
    }
  }

  return renderMarkdownBlock(value);
}
