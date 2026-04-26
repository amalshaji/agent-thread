import type { NormalizedEvent, NormalizedThread } from "@/src/shared/contracts";
import { Block } from "./block";
import { isMetadataEvent } from "@/lib/transcript/event-classification";
import { shouldHideRedundantToolResult } from "@/lib/transcript/tool-inline";
import type { ToolResultBlock, ToolUseBlock } from "@/lib/transcript/tool-inline";
import { splitThreadEvents } from "@/lib/transcript/visibility";
import { formatShortTime, titleCase } from "@/lib/transcript/utils";

type EventLane = "user" | "assistant" | "system" | "activity";
type ConversationLane = "user" | "assistant";
type ParallelToolPair = {
  toolUseEvent: NormalizedEvent;
  toolUseBlock: ToolUseBlock;
  toolResultEvent: NormalizedEvent;
  toolResultBlock: ToolResultBlock;
};
type EventSegment =
  | { kind: "event"; event: NormalizedEvent }
  | { kind: "parallel-tools"; id: string; pairs: ParallelToolPair[] };

function getEventLane(event: NormalizedEvent): EventLane {
  if (isMetadataEvent(event) || event.displayKind === "snapshot") return "activity";
  if (event.displayKind === "system") return "system";
  if (
    event.role === "assistant" ||
    event.displayKind === "thinking" ||
    event.displayKind === "tool_use" ||
    event.displayKind === "tool_result"
  ) {
    return "assistant";
  }
  if (event.role === "user") return "user";
  return "activity";
}

function isConversationLane(lane: EventLane): lane is ConversationLane {
  return lane === "user" || lane === "assistant";
}

function buildToolUseMap(thread: NormalizedThread): Map<string, ToolUseBlock> {
  const map = new Map<string, ToolUseBlock>();
  for (const event of thread.events) {
    for (const block of event.blocks) {
      if (block.kind === "tool_use") map.set(block.id, block);
    }
  }
  return map;
}

function buildToolResultMap(thread: NormalizedThread): Map<string, ToolResultBlock> {
  const map = new Map<string, ToolResultBlock>();
  for (const event of thread.events) {
    for (const block of event.blocks) {
      if (block.kind === "tool_result" && block.toolUseId && !map.has(block.toolUseId)) {
        map.set(block.toolUseId, block);
      }
    }
  }
  return map;
}

function shouldSkipEvent(
  event: NormalizedEvent,
  toolUseMap: Map<string, ToolUseBlock>,
): boolean {
  if (event.displayKind !== "tool_result") return false;
  const resultBlocks = event.blocks.filter((b): b is ToolResultBlock => b.kind === "tool_result");
  if (resultBlocks.length === 0) return false;
  return resultBlocks.every((b) =>
    shouldHideRedundantToolResult(toolUseMap.get(b.toolUseId ?? ""), b),
  );
}

function onlyToolUseBlocks(event: NormalizedEvent): ToolUseBlock[] | null {
  if (event.displayKind !== "tool_use") return null;
  const blocks = event.blocks.filter((block): block is ToolUseBlock => block.kind === "tool_use");
  return blocks.length === event.blocks.length && blocks.length > 0 ? blocks : null;
}

function onlyToolResultBlocks(event: NormalizedEvent): ToolResultBlock[] | null {
  if (event.displayKind !== "tool_result") return null;
  const blocks = event.blocks.filter((block): block is ToolResultBlock => block.kind === "tool_result");
  return blocks.length === event.blocks.length && blocks.length > 0 ? blocks : null;
}

function buildConversationSegments(events: NormalizedEvent[]): EventSegment[] {
  const segments: EventSegment[] = [];

  for (let index = 0; index < events.length; ) {
    const toolEvents: Array<{ event: NormalizedEvent; block: ToolUseBlock }> = [];
    let cursor = index;

    while (cursor < events.length) {
      const blocks = onlyToolUseBlocks(events[cursor]!);
      if (!blocks) break;
      for (const block of blocks) {
        if (block.id) {
          toolEvents.push({ event: events[cursor]!, block });
        }
      }
      cursor += 1;
    }

    if (toolEvents.length < 2) {
      segments.push({ kind: "event", event: events[index]! });
      index += 1;
      continue;
    }

    const expectedIds = new Set(toolEvents.map(({ block }) => block.id));
    const resultsById = new Map<string, { event: NormalizedEvent; block: ToolResultBlock }>();
    let resultCursor = cursor;

    while (resultCursor < events.length && resultsById.size < expectedIds.size) {
      const blocks = onlyToolResultBlocks(events[resultCursor]!);
      if (!blocks) break;

      let matchedAny = false;
      for (const block of blocks) {
        const id = block.toolUseId;
        if (id && expectedIds.has(id) && !resultsById.has(id)) {
          resultsById.set(id, { event: events[resultCursor]!, block });
          matchedAny = true;
        }
      }

      if (!matchedAny) break;
      resultCursor += 1;
    }

    if (resultsById.size !== expectedIds.size) {
      segments.push({ kind: "event", event: events[index]! });
      index += 1;
      continue;
    }

    segments.push({
      kind: "parallel-tools",
      id: `parallel-${toolEvents[0]!.block.id}`,
      pairs: toolEvents.map(({ event, block }) => {
        const result = resultsById.get(block.id)!;
        return {
          toolUseEvent: event,
          toolUseBlock: block,
          toolResultEvent: result.event,
          toolResultBlock: result.block,
        };
      }),
    });
    index = resultCursor;
  }

  return segments;
}

const USER_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="8" cy="6" r="2.5" />
    <path d="M3 13c.8-2.2 2.7-3.5 5-3.5s4.2 1.3 5 3.5" />
  </svg>
);

const ASSISTANT_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 2v5M8 9v5M2 8h5M9 8h5" />
  </svg>
);

function fallbackText(event: NormalizedEvent): string {
  if (event.displayKind === "thinking") return "Thinking was captured without displayable text.";
  if (event.displayKind === "snapshot") return "Workspace snapshot captured.";
  if (isMetadataEvent(event)) return "Session metadata event.";
  return "(no content)";
}

function getEventSpeaker(event: NormalizedEvent, lane: EventLane): string {
  if (lane === "user") return "User";
  if (lane === "assistant") return "Assistant";
  if (event.displayKind === "tool_result") return "Tool Result";
  if (event.displayKind === "tool_use") return "Tool Call";
  if (event.displayKind === "snapshot") return "Snapshot";
  if (isMetadataEvent(event)) return "Activity";
  return titleCase(event.role ?? event.topLevelType);
}

interface BlocksProps {
  event: NormalizedEvent;
  toolUseMap: Map<string, ToolUseBlock>;
  toolResultMap: Map<string, ToolResultBlock>;
}

async function EventBlocks({ event, toolUseMap, toolResultMap }: BlocksProps) {
  const context = { toolUseMap, toolResultMap };
  const blocks = await Promise.all(
    event.blocks.map(async (block, i) => {
      const el = await Block({ block, context });
      return el ? <div key={i}>{el}</div> : null;
    }),
  );
  const visible = blocks.filter(Boolean);
  if (visible.length > 0) return <>{visible}</>;
  return <p className="empty-note">{fallbackText(event)}</p>;
}

async function ActivityRow({ event, toolUseMap, toolResultMap }: BlocksProps) {
  const lane = getEventLane(event);
  const speaker = getEventSpeaker(event, lane);
  const timestamp = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={`message-row lane-${lane} event-${event.displayKind.replaceAll("_", "-")}`}>
      <article className="activity-card">
        <header className="activity-meta">
          <span className="activity-badge">{speaker}</span>
          {timestamp ? <span>{timestamp}</span> : null}
        </header>
        <div className="activity-body">
          <EventBlocks event={event} toolUseMap={toolUseMap} toolResultMap={toolResultMap} />
        </div>
      </article>
    </div>
  );
}

async function ParallelToolBatch({
  segment,
  toolUseMap,
  toolResultMap,
}: {
  segment: Extract<EventSegment, { kind: "parallel-tools" }>;
  toolUseMap: Map<string, ToolUseBlock>;
  toolResultMap: Map<string, ToolResultBlock>;
}) {
  const context = { toolUseMap, toolResultMap };
  const renderedPairs = await Promise.all(
    segment.pairs.map(async (pair, index) => {
      const toolUse = await Block({ block: pair.toolUseBlock, context });
      const showResult = !shouldHideRedundantToolResult(pair.toolUseBlock, pair.toolResultBlock);
      const toolResult = showResult ? await Block({ block: pair.toolResultBlock, context }) : null;

      return (
        <div className="parallel-tool-pair" key={`${pair.toolUseBlock.id}-${index}`}>
          {toolUse ? <div>{toolUse}</div> : <p className="empty-note">{fallbackText(pair.toolUseEvent)}</p>}
          {toolResult ? <div className="parallel-tool-result">{toolResult}</div> : null}
        </div>
      );
    }),
  );

  return (
    <details className="block parallel-tool-batch" open>
      <summary>
        <span className="parallel-tool-title">Parallel tool calls</span>
        <span className="parallel-tool-count">{segment.pairs.length} calls</span>
      </summary>
      <div className="parallel-tool-list">{renderedPairs}</div>
    </details>
  );
}

interface ClusterProps {
  lane: ConversationLane;
  events: NormalizedEvent[];
  toolUseMap: Map<string, ToolUseBlock>;
  toolResultMap: Map<string, ToolResultBlock>;
  assistantLabel: string;
}

async function ConversationCluster({ lane, events, toolUseMap, toolResultMap, assistantLabel }: ClusterProps) {
  const isUser = lane === "user";
  const firstEvent = events[0];
  const timeStr = firstEvent?.timestamp ? formatShortTime(firstEvent.timestamp) : null;
  const clusterId = firstEvent?.id ?? undefined;

  const segments = lane === "assistant" ? buildConversationSegments(events) : events.map((event) => ({ kind: "event" as const, event }));
  const blocksHtml = await Promise.all(
    segments.map(async (segment, ei) => {
      if (segment.kind === "parallel-tools") {
        return (
          <ParallelToolBatch
            key={segment.id}
            segment={segment}
            toolUseMap={toolUseMap}
            toolResultMap={toolResultMap}
          />
        );
      }

      const event = segment.event;
      const context = { toolUseMap, toolResultMap };
      const blocks = await Promise.all(
        event.blocks.map(async (block, bi) => {
          const el = await Block({ block, context });
          return el ? <div key={`${ei}-${bi}`}>{el}</div> : null;
        }),
      );
      const visible = blocks.filter(Boolean);
      if (visible.length > 0) return <>{visible}</>;
      return <p key={ei} className="empty-note">{fallbackText(event)}</p>;
    }),
  );

  return (
    <div className={`msg msg-${lane}`} id={clusterId}>
      <div className="msg-gutter">
        <div className={`avatar avatar-${lane}`}>{isUser ? USER_ICON : ASSISTANT_ICON}</div>
        <div className="msg-rail" />
      </div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-role">{isUser ? "You" : assistantLabel}</span>
          {timeStr ? <span className="msg-time">{timeStr}</span> : null}
        </div>
        <div className="msg-blocks">
          {blocksHtml.map((content, i) => (
            <div key={i}>{content}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface FeedProps {
  events: NormalizedEvent[];
  toolUseMap: Map<string, ToolUseBlock>;
  toolResultMap: Map<string, ToolResultBlock>;
  hideRedundant?: boolean;
  assistantLabel: string;
}

async function EventFeed({ events, toolUseMap, toolResultMap, hideRedundant, assistantLabel }: FeedProps) {
  type ClusterAcc = { lane: ConversationLane; events: NormalizedEvent[] } | null;
  const sections: React.ReactNode[] = [];
  let cluster: ClusterAcc = null;

  const flushCluster = async () => {
    if (!cluster) return;
    sections.push(
      <ConversationCluster
        key={`cluster-${sections.length}`}
        lane={cluster.lane}
        events={cluster.events}
        toolUseMap={toolUseMap}
        toolResultMap={toolResultMap}
        assistantLabel={assistantLabel}
      />,
    );
    cluster = null;
  };

  for (const event of events) {
    if (hideRedundant && shouldSkipEvent(event, toolUseMap)) continue;

    const lane = getEventLane(event);

    if (!isConversationLane(lane)) {
      await flushCluster();
      sections.push(
        <ActivityRow
          key={event.id}
          event={event}
          toolUseMap={toolUseMap}
          toolResultMap={toolResultMap}
        />,
      );
      continue;
    }

    if (cluster && cluster.lane === lane) {
      cluster.events.push(event);
    } else {
      await flushCluster();
      cluster = { lane, events: [event] };
    }
  }

  await flushCluster();
  return <>{sections}</>;
}

export async function Thread({
  thread,
  showHeader,
  assistantLabel = "Claude",
}: {
  thread: NormalizedThread;
  showHeader: boolean;
  assistantLabel?: string;
}) {
  const { primaryEvents, hiddenEvents } = splitThreadEvents(thread.events);
  const toolUseMap = buildToolUseMap(thread);
  const toolResultMap = buildToolResultMap(thread);

  return (
    <section className="thread" id={thread.id}>
      {showHeader ? (
        <header className="thread-header">
          <span className="thread-badge">
            {thread.kind === "main" ? "Main Thread" : "Side Thread"}
          </span>
          <h2>{thread.kind === "main" ? "Conversation" : `Agent ${thread.agentId ?? thread.id}`}</h2>
        </header>
      ) : null}

      <div className="events conversation-feed">
        <EventFeed
          events={primaryEvents}
          toolUseMap={toolUseMap}
          toolResultMap={toolResultMap}
          hideRedundant
          assistantLabel={assistantLabel}
        />
      </div>

      {hiddenEvents.length > 0 ? (
        <details className="thread-extras">
          <summary>
            {`Show ${hiddenEvents.length} hidden activity ${hiddenEvents.length === 1 ? "item" : "items"}`}
          </summary>
          <div className="events thread-extras-feed">
            <EventFeed
              events={hiddenEvents}
              toolUseMap={toolUseMap}
              toolResultMap={toolResultMap}
              assistantLabel={assistantLabel}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}
