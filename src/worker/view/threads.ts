import type { NormalizedThread } from "../../shared/contracts";
import {
  getEventLane,
  renderEvent,
  type EventLane,
} from "./events";
import { shouldHideRedundantToolResult, type ToolResultBlock, type ToolUseBlock } from "./tool-inline";
import { escapeHtml, formatShortTime } from "./utils";
import { splitThreadEvents } from "./visibility";

interface RenderThreadOptions {
  showHeader: boolean;
}

type ConversationLane = Extract<EventLane, "user" | "assistant">;

function renderHiddenEventToggle(hiddenCount: number, hiddenEventsHtml: string): string {
  if (hiddenCount === 0) {
    return "";
  }

  return `
    <details class="thread-extras">
      <summary>Show ${hiddenCount} hidden activity ${hiddenCount === 1 ? "item" : "items"}</summary>
      <div class="events thread-extras-feed">
        ${hiddenEventsHtml}
      </div>
    </details>
  `;
}

function buildToolUseMap(thread: NormalizedThread): Map<string, ToolUseBlock> {
  const toolUseMap = new Map<string, ToolUseBlock>();

  for (const event of thread.events) {
    for (const block of event.blocks) {
      if (block.kind === "tool_use") {
        toolUseMap.set(block.id, block);
      }
    }
  }

  return toolUseMap;
}

function buildToolResultMap(thread: NormalizedThread): Map<string, ToolResultBlock> {
  const toolResultMap = new Map<string, ToolResultBlock>();

  for (const event of thread.events) {
    for (const block of event.blocks) {
      if (block.kind === "tool_result" && block.toolUseId && !toolResultMap.has(block.toolUseId)) {
        toolResultMap.set(block.toolUseId, block);
      }
    }
  }

  return toolResultMap;
}

function shouldSkipPrimaryEvent(event: NormalizedThread["events"][number], toolUseMap: Map<string, ToolUseBlock>): boolean {
  if (event.displayKind !== "tool_result") {
    return false;
  }

  const toolResultBlocks = event.blocks.filter((block): block is ToolResultBlock => block.kind === "tool_result");
  if (toolResultBlocks.length === 0) {
    return false;
  }

  return toolResultBlocks.every((block) => shouldHideRedundantToolResult(toolUseMap.get(block.toolUseId ?? ""), block));
}

function isConversationLane(lane: EventLane): lane is ConversationLane {
  return lane === "user" || lane === "assistant";
}


const USER_AVATAR_SVG = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="2.5"/><path d="M3 13c.8-2.2 2.7-3.5 5-3.5s4.2 1.3 5 3.5"/></svg>`;
const ASSISTANT_AVATAR_SVG = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v5M8 9v5M2 8h5M9 8h5"/></svg>`;

function renderConversationCluster(
  lane: ConversationLane,
  events: NormalizedThread["events"],
  contentHtml: string,
): string {
  const isUser = lane === "user";
  const icon = isUser ? USER_AVATAR_SVG : ASSISTANT_AVATAR_SVG;
  const role = isUser ? "You" : "Claude";
  const firstEvent = events[0];
  const timeStr = firstEvent?.timestamp ? formatShortTime(firstEvent.timestamp) : "";
  const clusterId = firstEvent?.id ? ` id="${escapeHtml(firstEvent.id)}"` : "";

  return `
    <div class="msg msg-${lane}"${clusterId}>
      <div class="msg-gutter">
        <div class="avatar avatar-${lane}">${icon}</div>
        <div class="msg-rail"></div>
      </div>
      <div class="msg-body">
        <div class="msg-head">
          <span class="msg-role">${role}</span>
          ${timeStr ? `<span class="msg-time">${escapeHtml(timeStr)}</span>` : ""}
        </div>
        <div class="msg-blocks">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;
}

async function renderEventFeed(
  events: NormalizedThread["events"],
  toolUseMap: Map<string, ToolUseBlock>,
  toolResultMap: Map<string, ToolResultBlock>,
  options: { hideRedundantToolResults?: boolean } = {},
): Promise<string> {
  const renderedSections: string[] = [];
  let activeCluster: { lane: ConversationLane; events: NormalizedThread["events"]; html: string[] } | null = null;

  const flushActiveCluster = () => {
    if (!activeCluster) {
      return;
    }

    renderedSections.push(renderConversationCluster(activeCluster.lane, activeCluster.events, activeCluster.html.join("")));
    activeCluster = null;
  };

  for (const event of events) {
    if (options.hideRedundantToolResults && shouldSkipPrimaryEvent(event, toolUseMap)) {
      continue;
    }

    const lane = getEventLane(event);
    const html = await renderEvent(event, {
      toolUseMap,
      toolResultMap,
      grouped: isConversationLane(lane),
    });

    if (!isConversationLane(lane)) {
      flushActiveCluster();
      renderedSections.push(html);
      continue;
    }

    if (activeCluster && activeCluster.lane === lane) {
      activeCluster.events.push(event);
      activeCluster.html.push(html);
      continue;
    }

    flushActiveCluster();
    activeCluster = {
      lane,
      events: [event],
      html: [html],
    };
  }

  flushActiveCluster();
  return renderedSections.join("");
}

export async function renderThread(thread: NormalizedThread, options: RenderThreadOptions): Promise<string> {
  const { primaryEvents, hiddenEvents } = splitThreadEvents(thread.events);
  const toolUseMap = buildToolUseMap(thread);
  const toolResultMap = buildToolResultMap(thread);
  const renderedEvents = await renderEventFeed(primaryEvents, toolUseMap, toolResultMap, {
    hideRedundantToolResults: true,
  });
  const renderedHiddenEvents = await renderEventFeed(hiddenEvents, toolUseMap, toolResultMap);
  const hiddenToggle = renderHiddenEventToggle(hiddenEvents.length, renderedHiddenEvents);
  const header = options.showHeader
    ? `
      <header class="thread-header">
        <span class="thread-badge">${escapeHtml(thread.kind === "main" ? "Main Thread" : "Side Thread")}</span>
        <h2>${escapeHtml(thread.kind === "main" ? "Conversation" : `Agent ${thread.agentId ?? thread.id}`)}</h2>
      </header>
    `
    : "";

  return `
    <section class="thread" id="${escapeHtml(thread.id)}">
      ${header}
      <div class="events conversation-feed">
        ${renderedEvents}
      </div>
      ${hiddenToggle}
    </section>
  `;
}
