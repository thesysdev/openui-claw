/**
 * Merges OpenClaw chat.history messages into UI-ready turns.
 *
 * A single assistant "turn" in OpenClaw history spans multiple messages:
 *   assistant(toolCall) → toolResult → assistant(toolCall) → toolResult → assistant(text)
 * This module collapses them into one message so the UI shows a single bubble
 * with tool calls + final content together.
 */

import type { ChatHistoryMessage } from "@/lib/gateway/types";

export type ToolCallOutput = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type MergedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string | null;
  toolCalls?: ToolCallOutput[];
};

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

export function mergeHistoryMessages(raw: ChatHistoryMessage[]): MergedMessage[] {
  const output: MergedMessage[] = [];
  let pending: MergedMessage | null = null;

  const flush = () => {
    if (pending) {
      output.push(pending);
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
      const text = extractText(m.content);
      const contentTools = extractToolCalls(m.content);
      const legacyTools: ToolCallOutput[] = (m.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
      const allTools = [...contentTools, ...legacyTools];

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
