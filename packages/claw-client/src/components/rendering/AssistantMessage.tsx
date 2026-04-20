"use client";

import { ERROR_SENTINEL } from "@/lib/chat/history-merger";
import { extractAssistantTimeline } from "@/lib/chat/timeline";
import { separateContentAndContext, wrapContent, wrapContext } from "@/lib/content-parser";
import { parseInlineResponse } from "@/lib/detection";
import type { AssistantMessage as AssistantMsg } from "@openuidev/react-headless";
import { useThread } from "@openuidev/react-headless";
import type { ActionEvent } from "@openuidev/react-lang";
import { BuiltinActionType, Renderer } from "@openuidev/react-lang";
import { BehindTheScenes, Callout, Shell } from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, SquareTerminal } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  message: AssistantMsg;
}

type ResolvedToolTrace = {
  id: string;
  name: string;
  request: string | null;
  output: string | null;
  isError: boolean;
  durationMs: number | null;
};

type ResolvedTimelineItem =
  | {
      kind: "assistant_update";
      key: string;
      text: string;
    }
  | {
      kind: "reasoning";
      key: string;
      text: string;
    }
  | {
      kind: "tool";
      key: string;
      traceId: string;
    };

function prettyPayload(value: string | null): string | null {
  if (!value) return null;

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatDuration(durationMs: number | null): string | null {
  if (durationMs == null || !Number.isFinite(durationMs)) return null;
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)}s`;
}

const ASSISTANT_MARKDOWN_CLASSES =
  "prose prose-base max-w-none dark:prose-invert prose-p:leading-relaxed prose-p:text-[15px] prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-li:text-[15px] prose-strong:font-semibold prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:text-sm prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-a:text-primary prose-a:underline-offset-2 prose-table:text-sm";

const TRACE_MARKDOWN_CLASSES =
  "prose prose-sm max-w-none dark:prose-invert prose-p:my-0 prose-p:leading-relaxed prose-p:text-[14px] prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mb-2 prose-headings:mt-0 prose-li:text-[14px] prose-strong:font-semibold prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:text-sm prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-a:text-primary prose-a:underline-offset-2";

function TimelineFrame({
  marker,
  isLast,
  children,
}: {
  marker: ReactNode;
  isLast: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
      <div className="relative flex justify-center">
        {!isLast ? (
          <span className="absolute top-9 bottom-[-1rem] w-px bg-zinc-200/90 dark:bg-zinc-800" />
        ) : null}
        {marker}
      </div>
      <div className={`min-w-0 ${isLast ? "" : "pb-4"}`}>{children}</div>
    </div>
  );
}

function AssistantUpdateTimelineItem({ content, isLast }: { content: string; isLast: boolean }) {
  return (
    <TimelineFrame
      isLast={isLast}
      marker={
        <div className="relative z-10 mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-white shadow-sm dark:border-sky-500/30 dark:bg-zinc-950">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500 dark:bg-sky-400" />
        </div>
      }
    >
      <div className="w-full rounded-[22px] border border-sky-100/90 bg-white/92 px-4 py-3 shadow-[0_18px_45px_-38px_rgba(14,165,233,0.45)] dark:border-sky-500/20 dark:bg-zinc-900/72">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
          Assistant message
        </p>
        <div className={TRACE_MARKDOWN_CLASSES}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </TimelineFrame>
  );
}

function ReasoningTimelineItem({
  content,
  isStreaming,
  isLast,
}: {
  content: string;
  isStreaming: boolean;
  isLast: boolean;
}) {
  return (
    <TimelineFrame
      isLast={isLast}
      marker={
        <div className="relative z-10 mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-violet-200 bg-white shadow-sm dark:border-violet-500/30 dark:bg-zinc-950">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isStreaming
                ? "animate-pulse bg-violet-500 dark:bg-violet-400"
                : "bg-violet-400 dark:bg-violet-300"
            }`}
          />
        </div>
      }
    >
      <div className="w-full rounded-[22px] border border-violet-100/90 bg-zinc-50/90 px-4 py-3 shadow-[0_18px_45px_-38px_rgba(139,92,246,0.35)] dark:border-violet-500/20 dark:bg-zinc-900/72">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
            {isStreaming ? "Thinking" : "Reasoning"}
          </span>
        </div>
        <div className="text-sm leading-6 text-zinc-700 dark:text-zinc-200">{content}</div>
      </div>
    </TimelineFrame>
  );
}

function ToolPayloadBlock({
  label,
  content,
  defaultExpanded = false,
}: {
  label: string;
  content: string;
  defaultExpanded?: boolean;
}) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const formatted = useMemo(() => prettyPayload(content) ?? content, [content]);
  const isExpanded = userExpanded ?? defaultExpanded;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/92 dark:border-zinc-800 dark:bg-zinc-950/70">
      <div
        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
          isExpanded ? "border-b border-zinc-200/80 dark:border-zinc-800" : ""
        }`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        <button
          type="button"
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          onClick={() => setUserExpanded((value) => !(value ?? isExpanded))}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {isExpanded ? (
        <div className="px-3 py-2.5">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-700 dark:text-zinc-200">
            {formatted}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function ToolTraceItem({
  trace,
  isStreaming,
  isLast,
}: {
  trace: ResolvedToolTrace;
  isStreaming: boolean;
  isLast: boolean;
}) {
  const isPending = isStreaming && !trace.output;
  const duration = formatDuration(trace.durationMs);

  return (
    <TimelineFrame
      isLast={isLast}
      marker={
        <div
          className={`relative z-10 mt-1 flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm dark:bg-zinc-950 ${
            isPending
              ? "border-sky-200 text-sky-700 dark:border-sky-500/30 dark:text-sky-300"
              : trace.isError
                ? "border-rose-200 text-rose-600 dark:border-rose-500/30 dark:text-rose-300"
                : "border-emerald-200 text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-300"
          }`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : trace.isError ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </div>
      }
    >
      <div className="w-full rounded-[22px] border border-zinc-200/80 bg-zinc-50/88 p-4 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.22)] dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <SquareTerminal className="h-4 w-4 shrink-0 text-zinc-400" />
              <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {trace.name}
              </p>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {isPending ? "Running" : trace.isError ? "Failed" : "Completed"}
              {duration ? ` in ${duration}` : ""}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
              isPending
                ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                : trace.isError
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            }`}
          >
            {isPending ? "Running" : trace.isError ? "Error" : "Done"}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {trace.request ? <ToolPayloadBlock label="Input" content={trace.request} /> : null}
          {trace.output ? (
            <ToolPayloadBlock
              label={trace.isError ? "Output (error)" : "Output"}
              content={trace.output}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200/80 px-3 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Waiting for tool output...
            </div>
          )}
        </div>
      </div>
    </TimelineFrame>
  );
}

export function AssistantMessage({ message }: Props) {
  const messages = useThread((s) => s.messages);
  const isRunning = useThread((s) => s.isRunning);
  const processMessage = useThread((s) => s.processMessage);
  const updateMessage = useThread((s) => s.updateMessage);

  const isStreaming = useMemo(() => {
    if (!isRunning) return false;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") {
        return messages[i]?.id === message.id;
      }
    }
    return false;
  }, [isRunning, messages, message.id]);

  // Parse <context> suffix out of content; remaining is the response body.
  const { content: responseBody, contextString } = useMemo(() => {
    if (!message.content) return { content: null, contextString: null };
    return separateContentAndContext(message.content);
  }, [message.content]);

  const initialState = useMemo(() => {
    if (!contextString) return undefined;
    try {
      const parsed = JSON.parse(contextString);
      if (Array.isArray(parsed)) {
        for (let i = parsed.length - 1; i >= 0; i -= 1) {
          const candidate = parsed[i];
          if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
            return candidate;
          }
        }
      }
      if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      return undefined;
    } catch {
      return undefined;
    }
  }, [contextString]);

  const toolCalls = message.toolCalls ?? [];
  const toolCallById = useMemo(
    () => new Map(toolCalls.map((toolCall) => [toolCall.id, toolCall])),
    [toolCalls],
  );

  const handleStateUpdate = useCallback(
    (state: Record<string, unknown>) => {
      const code = responseBody ?? "";
      const fullMessage = code + "\n" + wrapContext(JSON.stringify([state]));
      updateMessage({ ...message, content: fullMessage });
    },
    [updateMessage, message, responseBody],
  );

  const handleAction = useCallback(
    (event: ActionEvent) => {
      if (event.type === BuiltinActionType.ContinueConversation) {
        const contentPart = wrapContent(event.humanFriendlyMessage);
        const ctx: unknown[] = [`User clicked: ${event.humanFriendlyMessage}`];
        const formState =
          event.formState ??
          (initialState && typeof initialState === "object" ? initialState : undefined);
        if (formState) ctx.push(formState);
        processMessage({ role: "user", content: contentPart + wrapContext(JSON.stringify(ctx)) });
      } else if (event.type === BuiltinActionType.OpenUrl) {
        const url = event.params?.["url"] as string | undefined;
        if (typeof window !== "undefined" && url) window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [initialState, processMessage],
  );

  const rawContent = responseBody ?? message.content ?? "";
  const { visibleText, interleavedParts } = useMemo(
    () => extractAssistantTimeline(rawContent),
    [rawContent],
  );

  const { timelineItems, toolTraceMap } = useMemo(() => {
    const traceMap = new Map<string, ResolvedToolTrace>();
    const items: ResolvedTimelineItem[] = [];
    const orderedToolIds = new Set<string>();

    const ensureTrace = (toolCallId: string): ResolvedToolTrace => {
      const existing = traceMap.get(toolCallId);
      if (existing) return existing;

      const fallbackToolCall = toolCallById.get(toolCallId);
      const trace: ResolvedToolTrace = {
        id: toolCallId,
        name: fallbackToolCall?.function.name ?? "Tool",
        request: fallbackToolCall?.function.arguments ?? null,
        output: null,
        isError: false,
        durationMs: null,
      };
      traceMap.set(toolCallId, trace);
      return trace;
    };

    interleavedParts.forEach((part, index) => {
      if (part.kind === "text") {
        if (part.text.trim()) {
          items.push({
            kind: "assistant_update",
            key: `assistant-update-${index}`,
            text: part.text,
          });
        }
        return;
      }

      const segment = part.segment;
      if (segment.type === "assistant_update") {
        if (segment.text.trim()) {
          items.push({
            kind: "assistant_update",
            key: `assistant-update-segment-${index}`,
            text: segment.text,
          });
        }
        return;
      }

      if (segment.type === "reasoning") {
        if (segment.text.trim()) {
          items.push({
            kind: "reasoning",
            key: `reasoning-${index}`,
            text: segment.text,
          });
        }
        return;
      }

      if (segment.type === "tool_call") {
        const trace = ensureTrace(segment.toolCallId);
        if (segment.toolName) trace.name = segment.toolName;
        if (segment.args) trace.request = segment.args;
      } else {
        const trace = ensureTrace(segment.toolCallId);
        trace.output = segment.output;
        trace.isError = segment.isError ?? false;
        trace.durationMs = segment.durationMs ?? trace.durationMs;
      }

      if (!orderedToolIds.has(segment.toolCallId)) {
        orderedToolIds.add(segment.toolCallId);
        items.push({
          kind: "tool",
          key: `tool-${segment.toolCallId}`,
          traceId: segment.toolCallId,
        });
      }
    });

    toolCalls.forEach((toolCall) => {
      if (orderedToolIds.has(toolCall.id)) {
        const existingTrace = traceMap.get(toolCall.id);
        if (existingTrace) {
          if (!existingTrace.request) existingTrace.request = toolCall.function.arguments;
          if (existingTrace.name === "Tool") existingTrace.name = toolCall.function.name;
        }
        return;
      }

      const trace = ensureTrace(toolCall.id);
      if (!trace.request) trace.request = toolCall.function.arguments;
      if (!trace.name) trace.name = toolCall.function.name;
      orderedToolIds.add(toolCall.id);
      items.push({
        kind: "tool",
        key: `tool-fallback-${toolCall.id}`,
        traceId: toolCall.id,
      });
    });

    if (!isStreaming) {
      traceMap.forEach((trace) => {
        if (!trace.output) {
          trace.output = "Tool finished without output.";
        }
      });
    }

    return {
      timelineItems: items,
      toolTraceMap: traceMap,
    };
  }, [interleavedParts, isStreaming, toolCallById, toolCalls]);

  const errorIdx = visibleText.indexOf(ERROR_SENTINEL);
  const isError = errorIdx !== -1;
  const textContent = isError ? visibleText.slice(0, errorIdx) : visibleText;
  const finalAssistantText = textContent;
  const errorMessage = isError ? visibleText.slice(errorIdx + ERROR_SENTINEL.length) : null;

  const { segments } = useMemo(() => parseInlineResponse(finalAssistantText), [finalAssistantText]);

  const renderedSegments = segments.map((segment, i) =>
    segment.type === "openui" ? (
      <Renderer
        key={`openui-${i}`}
        library={openuiLibrary}
        response={segment.content}
        isStreaming={isStreaming}
        onAction={handleAction}
        onStateUpdate={handleStateUpdate}
        initialState={initialState}
      />
    ) : (
      <div
        key={`text-${i}`}
        className="openui-claw-assistant-markdown mr-auto w-full max-w-3xl rounded-[26px] border border-zinc-200/80 bg-white/90 px-4 py-3 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/78"
      >
        <div className={ASSISTANT_MARKDOWN_CLASSES}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{segment.content}</ReactMarkdown>
        </div>
      </div>
    ),
  );

  return (
    <Shell.AssistantMessageContainer>
      {timelineItems.length > 0 ? (
        <BehindTheScenes isStreaming={isStreaming} toolCallsComplete={!isStreaming}>
          {timelineItems.map((item, index, items) => {
            const isLast = index === items.length - 1;

            if (item.kind === "assistant_update") {
              return (
                <AssistantUpdateTimelineItem key={item.key} content={item.text} isLast={isLast} />
              );
            }

            if (item.kind === "reasoning") {
              return (
                <ReasoningTimelineItem
                  key={item.key}
                  content={item.text}
                  isStreaming={isStreaming}
                  isLast={isLast}
                />
              );
            }

            const trace = toolTraceMap.get(item.traceId);
            if (!trace) return null;

            return (
              <ToolTraceItem
                key={item.key}
                trace={trace}
                isStreaming={isStreaming}
                isLast={isLast}
              />
            );
          })}
        </BehindTheScenes>
      ) : null}

      {renderedSegments}

      {errorMessage && (
        <Callout variant="danger" title="Something went wrong" description={errorMessage} />
      )}
    </Shell.AssistantMessageContainer>
  );
}
