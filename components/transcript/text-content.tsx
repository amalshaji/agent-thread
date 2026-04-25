import { extractPatch, renderDiffBlock } from "@/src/worker/view/diff";
import { renderMarkdownInner } from "@/src/worker/view/markdown";

function isStandalonePatchText(value: string): boolean {
  const trimmed = value.trimStart();
  return (
    trimmed.startsWith("diff --git ") ||
    trimmed.startsWith("--- ") ||
    /^```(?:diff|patch)\s*\n/i.test(trimmed)
  );
}

export async function TextContent({ text }: { text: string }) {
  const patch = isStandalonePatchText(text) ? extractPatch(text) : null;

  if (patch) {
    const diffHtml = await renderDiffBlock(patch);
    if (diffHtml) {
      // renderDiffBlock returns a <pre> element; inject it directly
      return <div dangerouslySetInnerHTML={{ __html: diffHtml }} />;
    }
  }

  const innerHtml = await renderMarkdownInner(text);
  return <div className="block markdown" dangerouslySetInnerHTML={{ __html: innerHtml }} />;
}
