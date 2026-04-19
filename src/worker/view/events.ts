import type { ContentBlock, NormalizedEvent } from "../../shared/contracts";
import { renderBlock } from "./blocks";
import { isMetadataEvent } from "./event-classification";
import type { ToolResultBlock, ToolUseBlock } from "./tool-inline";
import { isInlineToolPreviewTool } from "./tool-inline";
import { escapeHtml, formatTimestamp, titleCase } from "./utils";

export type EventLane = "user" | "assistant" | "system" | "activity";

export function getEventLane(event: NormalizedEvent): EventLane {
  if (isMetadataEvent(event) || event.displayKind === "snapshot") {
    return "activity";
  }

  if (event.displayKind === "system") {
    return "system";
  }

  if (
    event.role === "assistant" ||
    event.displayKind === "thinking" ||
    event.displayKind === "tool_use" ||
    event.displayKind === "tool_result"
  ) {
    return "assistant";
  }

  if (event.role === "user") {
    return "user";
  }

  return "activity";
}

export function getConversationLaneLabel(lane: Extract<EventLane, "user" | "assistant">): string {
  return lane === "user" ? "User" : "Assistant";
}

export function getConversationLaneAvatar(_lane: Extract<EventLane, "user" | "assistant">): string {
  return "";
}

function getEventSpeaker(event: NormalizedEvent, lane: EventLane): string {
  if (lane === "user") {
    return "User";
  }

  if (lane === "assistant") {
    return "Assistant";
  }

  if (event.displayKind === "tool_result") {
    return "Tool Result";
  }

  if (event.displayKind === "tool_use") {
    return "Tool Call";
  }

  if (event.displayKind === "snapshot") {
    return "Snapshot";
  }

  if (isMetadataEvent(event)) {
    return "Activity";
  }

  return titleCase(event.role ?? event.topLevelType);
}

function getEventKindLabel(event: NormalizedEvent): string | null {
  switch (event.displayKind) {
    case "message":
      return null;
    case "tool_use":
      return "Tool Call";
    case "tool_result":
      return "Tool Result";
    case "snapshot":
      return "Snapshot";
    case "meta":
      return "Meta";
    default:
      return titleCase(event.displayKind);
  }
}

function fallbackMessageForEvent(event: NormalizedEvent): string {
  if (event.displayKind === "thinking") {
    return "Thinking was captured without displayable text.";
  }

  if (event.displayKind === "snapshot") {
    return "Workspace snapshot captured.";
  }

  if (isMetadataEvent(event)) {
    return "Session metadata event.";
  }

  return "(no content)";
}

function getMessageFootnote(event: NormalizedEvent, kind: string | null, timestamp: string | null): string | null {
  const parts: string[] = [];

  if (kind && kind !== "Message" && event.displayKind !== "tool_use" && event.displayKind !== "tool_result") {
    parts.push(kind);
  }

  if (timestamp) {
    parts.push(timestamp);
  }

  return parts.length > 0 ? parts.join(" • ") : null;
}

function isCompactUserEvent(event: NormalizedEvent, lane: EventLane): boolean {
  return lane === "user" && event.displayKind === "message" && event.blocks.length === 1 && event.blocks[0]?.kind === "text";
}

function getUserBlockBubbleClass(block: ContentBlock): string {
  return block.kind === "text" ? "message-bubble bubble-user" : "message-bubble bubble-user-rich";
}

function isInlineToolUseEvent(event: NormalizedEvent): boolean {
  if (event.displayKind !== "tool_use") {
    return false;
  }

  return event.blocks.some((block) => block.kind === "tool_use" && isInlineToolPreviewTool(block.name));
}

async function renderUserEventBody(event: NormalizedEvent): Promise<string> {
  const renderedBlocks = (
    await Promise.all(
      event.blocks.map(async (block) => {
        const html = await renderBlock(block);
        if (html.length === 0) {
          return "";
        }

        return `<article class="${getUserBlockBubbleClass(block)}">${html}</article>`;
      }),
    )
  ).filter((block) => block.length > 0);

  if (renderedBlocks.length > 0) {
    return renderedBlocks.join("");
  }

  return `<article class="message-bubble bubble-user"><p class="empty-note">${escapeHtml(fallbackMessageForEvent(event))}</p></article>`;
}

interface RenderEventContext {
  toolUseMap?: Map<string, ToolUseBlock>;
  toolResultMap?: Map<string, ToolResultBlock>;
  grouped?: boolean;
}

export async function renderEvent(event: NormalizedEvent, context: RenderEventContext = {}): Promise<string> {
  const lane = getEventLane(event);
  const grouped = context.grouped ?? false;
  const eventClassName = `event-${event.displayKind.replaceAll("_", "-")}`;
  const speaker = getEventSpeaker(event, lane);
  const kind = getEventKindLabel(event);
  const timestamp = event.timestamp ? formatTimestamp(event.timestamp) : null;

  // Activity / system events: always render with their own simple row
  if (lane === "activity" || lane === "system") {
    const renderedBlocks = (
      await Promise.all(
        event.blocks.map((block) =>
          renderBlock(block, { toolUseMap: context.toolUseMap, toolResultMap: context.toolResultMap }),
        ),
      )
    ).filter((block) => block.length > 0);
    const body =
      renderedBlocks.length > 0
        ? renderedBlocks.join("")
        : `<p class="empty-note">${escapeHtml(fallbackMessageForEvent(event))}</p>`;

    const metaParts = [
      `<span class="activity-badge">${escapeHtml(speaker)}</span>`,
      kind && kind !== speaker ? `<span>${escapeHtml(kind)}</span>` : "",
      timestamp ? `<span>${escapeHtml(timestamp)}</span>` : "",
    ].filter((part) => part.length > 0);

    return `
      <div class="message-row lane-${lane} ${eventClassName}">
        <article class="activity-card">
          <header class="activity-meta">
            ${metaParts.join("")}
          </header>
          <div class="activity-body">
            ${body}
          </div>
        </article>
      </div>
    `;
  }

  // When grouped inside a .msg cluster, just return the block content —
  // the cluster wrapper handles the avatar and role label.
  if (grouped) {
    const compactUserEvent = isCompactUserEvent(event, lane);
    const richUserEvent = lane === "user" && !compactUserEvent;

    if (richUserEvent) {
      return await renderUserEventBody(event);
    }

    const renderedBlocks = (
      await Promise.all(
        event.blocks.map((block) =>
          renderBlock(block, { toolUseMap: context.toolUseMap, toolResultMap: context.toolResultMap }),
        ),
      )
    ).filter((block) => block.length > 0);

    return renderedBlocks.length > 0
      ? renderedBlocks.join("")
      : `<p class="empty-note">${escapeHtml(fallbackMessageForEvent(event))}</p>`;
  }

  // Ungrouped fallback (shouldn't normally happen for user/assistant)
  const compactUserEvent = isCompactUserEvent(event, lane);
  const richUserEvent = lane === "user" && !compactUserEvent;
  const footnote = getMessageFootnote(event, kind, timestamp);
  const rowClassNames = ["message-row", `lane-${lane}`, eventClassName];

  if (richUserEvent) {
    rowClassNames.push("event-user-rich");
    return `
      <div class="${rowClassNames.join(" ")}">
        <div class="message-stack">
          ${await renderUserEventBody(event)}
          ${footnote ? `<div class="message-footnote">${escapeHtml(footnote)}</div>` : ""}
        </div>
      </div>
    `;
  }

  const renderedBlocks = (
    await Promise.all(
      event.blocks.map((block) =>
        renderBlock(block, { toolUseMap: context.toolUseMap, toolResultMap: context.toolResultMap }),
      ),
    )
  ).filter((block) => block.length > 0);
  const body =
    renderedBlocks.length > 0
      ? renderedBlocks.join("")
      : `<p class="empty-note">${escapeHtml(fallbackMessageForEvent(event))}</p>`;

  if (isInlineToolUseEvent(event)) {
    rowClassNames.push("event-tool-inline");
  }

  return `
    <div class="${rowClassNames.join(" ")}">
      <div class="message-stack">
        <article class="message-bubble bubble-${lane}">
          ${body}
        </article>
        ${footnote ? `<div class="message-footnote">${escapeHtml(footnote)}</div>` : ""}
      </div>
    </div>
  `;
}
