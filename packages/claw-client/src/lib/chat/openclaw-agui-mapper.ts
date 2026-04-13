"use client";

/**
 * Maps OpenClaw gateway events to AG-UI events that @openuidev/react-headless understands.
 *
 * OpenClaw streams (event:agent payload):
 *   "assistant" → text delta        data: AssistantStreamData
 *   "thinking"  → reasoning tokens  data: ThinkingStreamData   (cap: "thinking-events")
 *   "tool"      → tool call phases  data: ToolStreamData        (cap: "tool-events")
 *
 * AG-UI events emitted (EventType from @ag-ui/core via @openuidev/react-headless):
 *   TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT / TEXT_MESSAGE_END
 *   TOOL_CALL_START / TOOL_CALL_ARGS / TOOL_CALL_END
 *   REASONING_MESSAGE_START / REASONING_MESSAGE_CONTENT / REASONING_MESSAGE_END
 *   RUN_FINISHED / RUN_ERROR
 *
 * Reasoning lifecycle: REASONING_MESSAGE_START is emitted on the first thinking delta,
 * REASONING_MESSAGE_END is emitted when the first tool or assistant delta arrives (via
 * ensureMessageStarted), closing the reasoning block before the assistant turn begins.
 */

import { EventType } from "@openuidev/react-headless";
import type { AgentEvent, ChatEvent } from "@/lib/gateway/types";
import { ERROR_SENTINEL } from "@/lib/chat/history-merger";

export function createOpenClawAGUIMapper(
  onEvent: (event: Record<string, unknown>) => void
): { onAgentEvent: (evt: AgentEvent) => void; onChatEvent: (evt: ChatEvent) => void } {
  let messageId: string | null = null;
  let reasoningMessageId: string | null = null;

  const closeReasoning = () => {
    if (reasoningMessageId) {
      onEvent({ type: EventType.REASONING_MESSAGE_END, messageId: reasoningMessageId });
      reasoningMessageId = null;
    }
  };

  const ensureMessageStarted = (runId: string) => {
    closeReasoning();
    if (!messageId) {
      messageId = runId;
      onEvent({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" });
    }
  };

  const emitErrorAsMessage = (runId: string, error: string) => {
    closeReasoning();
    ensureMessageStarted(runId);
    onEvent({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: `${ERROR_SENTINEL}${error}` });
    onEvent({ type: EventType.TEXT_MESSAGE_END, messageId });
    onEvent({ type: EventType.RUN_FINISHED });
  };

  return {
    onAgentEvent(evt: AgentEvent) {
      if (evt.stream === "thinking") {
        const delta = evt.data.delta || evt.data.text || "";
        if (delta) {
          if (!reasoningMessageId) {
            reasoningMessageId = crypto.randomUUID();
            onEvent({ type: EventType.REASONING_MESSAGE_START, messageId: reasoningMessageId, role: "reasoning" });
          }
          onEvent({ type: EventType.REASONING_MESSAGE_CONTENT, messageId: reasoningMessageId, delta });
        }
        return;
      }

      if (evt.stream === "tool") {
        if (evt.data.phase === "start") {
          ensureMessageStarted(evt.runId);
          const args = JSON.stringify(evt.data.args);
          onEvent({ type: EventType.TOOL_CALL_START, toolCallId: evt.data.toolCallId, toolCallName: evt.data.name, parentMessageId: messageId });
          onEvent({ type: EventType.TOOL_CALL_ARGS, toolCallId: evt.data.toolCallId, delta: args });
        } else if (evt.data.phase === "result") {
          onEvent({ type: EventType.TOOL_CALL_END, toolCallId: evt.data.toolCallId });
        }
        return;
      }

      if (evt.stream === "assistant") {
        if (evt.data.delta) {
          ensureMessageStarted(evt.runId);
          onEvent({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: evt.data.delta });
        }
        return;
      }

      if (evt.stream === "lifecycle") {
        const ld = evt.data as import("@/lib/gateway/types").LifecycleStreamData;
        if (ld.phase === "error") {
          emitErrorAsMessage(evt.runId, ld.error ?? "Agent error");
        }
        return;
      }
    },

    onChatEvent(evt: ChatEvent) {
      if (evt.state === "delta") {
        // Legacy text delivery via chat.delta frames
        if (typeof evt.message === "string" && evt.message) {
          ensureMessageStarted(evt.runId);
          onEvent({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: evt.message });
        }
      } else if (evt.state === "final" || evt.state === "aborted") {
        closeReasoning();
        ensureMessageStarted(evt.runId);
        onEvent({ type: EventType.TEXT_MESSAGE_END, messageId });
        onEvent({ type: EventType.RUN_FINISHED });
      } else if (evt.state === "error") {
        emitErrorAsMessage(evt.runId, evt.errorMessage ?? "Agent error");
      }
    },
  };
}
