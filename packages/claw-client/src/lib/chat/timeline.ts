"use client";

export type AssistantTimelineSegment =
  | {
      type: "reasoning";
      text: string;
    }
  | {
      type: "assistant_update";
      text: string;
    }
  | {
      type: "tool_call";
      toolCallId: string;
      toolName?: string;
      args?: string;
    }
  | {
      type: "tool_result";
      toolCallId: string;
      output: string;
      isError?: boolean;
      durationMs?: number;
    };

export type AssistantTimelinePart =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "timeline";
      segment: AssistantTimelineSegment;
    };

const TIMELINE_MARKER_PREFIX = "<!--OPENUI_TIMELINE:";
const TIMELINE_MARKER_SUFFIX = "-->";
const TIMELINE_MARKER_REGEX = /<!--OPENUI_TIMELINE:([\s\S]*?)-->/g;

function isTimelineSegment(value: unknown): value is AssistantTimelineSegment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    type?: string;
    text?: unknown;
    toolCallId?: unknown;
    toolName?: unknown;
    args?: unknown;
    output?: unknown;
    isError?: unknown;
    durationMs?: unknown;
  };

  if (candidate.type === "reasoning") {
    return typeof candidate.text === "string";
  }

  if (candidate.type === "assistant_update") {
    return typeof candidate.text === "string";
  }

  if (candidate.type === "tool_call") {
    return (
      typeof candidate.toolCallId === "string" &&
      (candidate.toolName === undefined || typeof candidate.toolName === "string") &&
      (candidate.args === undefined || typeof candidate.args === "string")
    );
  }

  if (candidate.type === "tool_result") {
    return (
      typeof candidate.toolCallId === "string" &&
      typeof candidate.output === "string" &&
      (candidate.isError === undefined || typeof candidate.isError === "boolean") &&
      (candidate.durationMs === undefined || typeof candidate.durationMs === "number")
    );
  }

  return false;
}

export function encodeAssistantTimelineSegment(segment: AssistantTimelineSegment): string {
  return `${TIMELINE_MARKER_PREFIX}${encodeURIComponent(
    JSON.stringify(segment),
  )}${TIMELINE_MARKER_SUFFIX}`;
}

export function serializeAssistantTimelineContent(params: {
  text?: string | null;
  timeline?: AssistantTimelineSegment[];
}): string {
  const markers = (params.timeline ?? [])
    .map((segment) => encodeAssistantTimelineSegment(segment))
    .join("");

  return `${markers}${params.text ?? ""}`;
}

export function extractAssistantTimeline(raw: string): {
  visibleText: string;
  timeline: AssistantTimelineSegment[];
  interleavedParts: AssistantTimelinePart[];
} {
  const timelineMarkerRegex = new RegExp(TIMELINE_MARKER_REGEX.source, "g");
  const timeline: AssistantTimelineSegment[] = [];
  const parts: AssistantTimelinePart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushTextPart = (text: string) => {
    if (!text) return;
    parts.push({ kind: "text", text });
  };

  const pushTimelinePart = (segment: AssistantTimelineSegment) => {
    const previousPart = parts[parts.length - 1];
    if (
      (segment.type === "reasoning" || segment.type === "assistant_update") &&
      previousPart?.kind === "timeline" &&
      previousPart.segment.type === segment.type
    ) {
      previousPart.segment.text += segment.text;
      return;
    }

    parts.push({ kind: "timeline", segment });
    timeline.push(segment);
  };

  while ((match = timelineMarkerRegex.exec(raw)) !== null) {
    pushTextPart(raw.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;

    try {
      const parsed = JSON.parse(decodeURIComponent(match[1] ?? ""));
      if (!isTimelineSegment(parsed)) continue;
      pushTimelinePart(parsed);
    } catch {
      // Ignore malformed timeline markers and continue rendering visible text.
    }
  }

  pushTextPart(raw.slice(lastIndex));

  if (timeline.length === 0) {
    return {
      visibleText: raw,
      timeline,
      interleavedParts: [],
    };
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart?.kind === "text") {
    return {
      visibleText: lastPart.text,
      timeline,
      interleavedParts: parts.slice(0, -1),
    };
  }

  return {
    visibleText: "",
    timeline,
    interleavedParts: parts,
  };
}
