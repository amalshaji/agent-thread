import type { ContentBlock } from "../../shared/contracts";
import { renderRawBlock } from "./raw-blocks";
import { renderTextContent } from "./text-content";
import type { ToolResultBlock, ToolUseBlock } from "./tool-inline";
import { renderToolBlock, renderToolUseBlock } from "./tool-blocks";
import { escapeHtml } from "./utils";

interface RenderBlockContext {
  toolUseMap?: Map<string, ToolUseBlock>;
  toolResultMap?: Map<string, ToolResultBlock>;
}

export async function renderBlock(block: ContentBlock, context: RenderBlockContext = {}): Promise<string> {
  switch (block.kind) {
    case "text": {
      return renderTextContent(block.text);
    }
    case "thinking":
      if (block.text.trim().length === 0) {
        return "";
      }

      return `<details class="block thinking"><summary>Thinking</summary><pre class="tool-payload">${escapeHtml(block.text)}</pre></details>`;
    case "tool_use": {
      return renderToolUseBlock(block, context.toolResultMap?.get(block.id));
    }
    case "tool_result": {
      return renderToolBlock(block, context.toolUseMap?.get(block.toolUseId ?? ""));
    }
    case "raw": {
      return renderRawBlock(block);
    }
  }
}
