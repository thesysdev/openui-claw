/**
 * Merges OpenClaw chat.history messages into UI-ready turns.
 *
 * A single assistant "turn" in OpenClaw history spans multiple messages:
 *   assistant(toolCall) → toolResult → assistant(toolCall) → toolResult → assistant(text)
 * This module collapses them into one message so the UI shows a single bubble
 * with tool calls + final content together.
 *
 * Special cases:
 *   - assistant messages with type:"thinking" content blocks → emitted as standalone
 *     ReasoningMessage (role:"reasoning") before the assistant turn
 *   - aborted messages with only thinking (no text, no toolCalls) → reasoning only, no assistant bubble
 *   - model:"gateway-injected" messages (compaction summaries) → ActivityMessage (role:"activity")
 */

import type { ChatHistoryMessage } from "@/lib/gateway/types";

export type ToolCallOutput = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export const ERROR_SENTINEL = "<!--AGENT_ERROR-->";

export type MergedMessage =
  | { id: string; role: "user" | "assistant"; content: string | null; toolCalls?: ToolCallOutput[] }
  | { id: string; role: "reasoning"; content: string }
  | { id: string; role: "activity"; activityType: string; content: Record<string, unknown> };

function extractText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const parts = (content as Array<{ type?: string; text?: string }>)
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "");
  return parts.length ? parts.join("") : null;
}

function extractToolCalls(content: unknown): ToolCallOutput[] {
  if (!Array.isArray(content)) return [];
  return (content as Array<{ type?: string; id?: string; name?: string; arguments?: unknown }>)
    .filter((c) => c.type === "toolCall")
    .map((c) => ({
      id: c.id ?? crypto.randomUUID(),
      type: "function" as const,
      function: {
        name: c.name ?? "unknown",
        arguments: typeof c.arguments === "string" ? c.arguments : JSON.stringify(c.arguments ?? {}),
      },
    }));
}

function extractThinking(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const parts = (content as Array<{ type?: string; thinking?: string }>)
    .filter((c) => c.type === "thinking")
    .map((c) => c.thinking ?? "");
  return parts.length ? parts.join("") : null;
}

export function mergeHistoryMessages(raw: ChatHistoryMessage[]): MergedMessage[] {
  const output: MergedMessage[] = [];
  let pending: (MergedMessage & { role: "assistant" }) | null = null;

  const flush = () => {
    if (pending) {
      // Skip empty assistant bubbles (aborted thinking-only messages)
      if (pending.content !== null || (pending.toolCalls && pending.toolCalls.length > 0)) {
        output.push(pending);
      }
      pending = null;
    }
  };

  for (const m of raw) {
    if (m.role === "user") {
      flush();
      output.push({
        id: m.__openclaw?.id ?? m.id ?? crypto.randomUUID(),
        role: "user",
        content: extractText(m.content),
      });
      continue;
    }

    if (m.role === "assistant") {
      // Compaction summary messages injected by the gateway
      if ((m as unknown as { model?: string }).model === "gateway-injected") {
        flush();
        output.push({
          id: m.__openclaw?.id ?? m.id ?? crypto.randomUUID(),
          role: "activity",
          activityType: "compaction",
          content: { text: extractText(m.content) ?? "" },
        });
        continue;
      }

      const text = extractText(m.content);
      const thinking = extractThinking(m.content);
      const contentTools = extractToolCalls(m.content);
      const legacyTools: ToolCallOutput[] = (m.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
      const allTools = [...contentTools, ...legacyTools];

      // Emit reasoning message at the start of a new turn (before creating pending)
      if (thinking && !pending) {
        output.push({
          id: crypto.randomUUID(),
          role: "reasoning",
          content: thinking,
        });
      }

      if (!text && allTools.length === 0 && m.stopReason === "error" && m.errorMessage) {
        flush();
        pending = {
          id: m.__openclaw?.id ?? m.id ?? crypto.randomUUID(),
          role: "assistant",
          content: `${ERROR_SENTINEL}${m.errorMessage}`,
        };
        continue;
      }

      // Aborted/thinking-only: no text and no tool calls — skip creating an empty assistant bubble
      if (!text && allTools.length === 0) {
        continue;
      }

      if (!pending) {
        pending = {
          id: m.__openclaw?.id ?? m.id ?? crypto.randomUUID(),
          role: "assistant",
          content: text,
          ...(allTools.length ? { toolCalls: allTools } : {}),
        };
      } else {
        if (allTools.length) {
          pending.toolCalls = [...(pending.toolCalls ?? []), ...allTools];
        }
        if (text) {
          pending.content = text;
        }
      }
      continue;
    }
    // toolResult / system / etc. — skip (they sit between assistant messages in the same turn)
  }
  flush();
  return output;
}
