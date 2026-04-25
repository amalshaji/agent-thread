import type { ContentBlock, NormalizedEvent } from "../../shared/contracts";

const LOCAL_COMMAND_PREFIXES = ["<local-command-caveat>", "<command-name>", "<local-command-stdout>"];

function isLocalCommandText(text: string): boolean {
  return LOCAL_COMMAND_PREFIXES.some((prefix) => text.startsWith(prefix));
}

function hasLocalCommandBlock(blocks: ContentBlock[]): boolean {
  return blocks.some((block) => block.kind === "text" && isLocalCommandText(block.text.trim()));
}

export function isMetadataEvent(event: NormalizedEvent): boolean {
  return (
    event.flags.isMeta ||
    event.displayKind === "meta" ||
    event.meta.subtype === "local_command" ||
    hasLocalCommandBlock(event.blocks)
  );
}
