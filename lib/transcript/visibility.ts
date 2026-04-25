import type { NormalizedEvent } from "@/src/shared/contracts";
import { isMetadataEvent } from "./event-classification";

export function isPrimaryEvent(event: NormalizedEvent): boolean {
  if (isMetadataEvent(event)) {
    return false;
  }

  if (event.displayKind === "tool_use" || event.displayKind === "tool_result") {
    return true;
  }

  return event.displayKind === "message" && (event.role === "user" || event.role === "assistant");
}

export function splitThreadEvents(events: NormalizedEvent[]): {
  primaryEvents: NormalizedEvent[];
  hiddenEvents: NormalizedEvent[];
} {
  const primaryEvents: NormalizedEvent[] = [];
  const hiddenEvents: NormalizedEvent[] = [];

  for (const event of events) {
    if (isPrimaryEvent(event)) {
      primaryEvents.push(event);
    } else {
      hiddenEvents.push(event);
    }
  }

  if (primaryEvents.length === 0 && hiddenEvents.length > 0) {
    primaryEvents.push(hiddenEvents.shift()!);
  }

  return { primaryEvents, hiddenEvents };
}
