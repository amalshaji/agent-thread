import type { ContentBlock } from "../../shared/contracts";
import { renderImageAttachment } from "./attachments";
import { renderToolBlock } from "./tool-blocks";

type RawBlock = Extract<ContentBlock, { kind: "raw" }>;

export async function renderRawBlock(block: RawBlock): Promise<string> {
  const image = renderImageAttachment(block.value, "Attached image");

  if (image) {
    return image;
  }

  return renderToolBlock(block);
}
