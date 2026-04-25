import type { ContentBlock } from "@/src/shared/contracts";
import { ImageAttachment } from "./image-attachment";
import { TextContent } from "./text-content";
import { ToolUseBlockComponent } from "./tool-use-block";
import { ToolResultBlockComponent } from "./tool-result-block";
import { getRenderableImage } from "@/lib/transcript/attachments";
import { prettyJson } from "@/lib/transcript/utils";
import type { ToolResultBlock, ToolUseBlock } from "@/lib/transcript/tool-inline";

interface BlockContext {
  toolUseMap?: Map<string, ToolUseBlock>;
  toolResultMap?: Map<string, ToolResultBlock>;
}

export async function Block({ block, context = {} }: { block: ContentBlock; context?: BlockContext }) {
  switch (block.kind) {
    case "text":
      return <TextContent text={block.text} />;

    case "thinking": {
      if (!block.text.trim()) return null;
      return (
        <details className="block thinking">
          <summary>
            <span className="thinking-chevron">▶</span>
            Thinking
          </summary>
          <pre className="tool-payload">{block.text}</pre>
        </details>
      );
    }

    case "tool_use": {
      const relatedResult = context.toolResultMap?.get(block.id);
      return <ToolUseBlockComponent block={block} relatedResult={relatedResult} />;
    }

    case "tool_result":
      return <ToolResultBlockComponent block={block} />;

    case "raw": {
      if (getRenderableImage(block.value)) {
        return <ImageAttachment value={block.value} alt="Attached image" />;
      }
      return <pre className="tool-payload">{prettyJson(block.value)}</pre>;
    }
  }
}
