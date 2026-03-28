"use client";

import { Renderer, BuiltinActionType } from "@openuidev/react-lang";
import type { ActionEvent } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { Shell } from "@openuidev/react-ui";
import { useThread } from "@openuidev/react-headless";
import type { AssistantMessage as AssistantMsg } from "@openuidev/react-headless";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCallback, useMemo } from "react";
import { detectFormat } from "@/lib/detection";
import { separateContentAndContext, wrapContent, wrapContext } from "@/lib/content-parser";

interface Props {
  message: AssistantMsg;
}

export function AssistantMessage({ message }: Props) {
  const messages = useThread((s) => s.messages);
  const isRunning = useThread((s) => s.isRunning);
  const processMessage = useThread((s) => s.processMessage);
  const updateMessage = useThread((s) => s.updateMessage);

  // Only mark isStreaming for the last assistant message currently streaming
  const isStreaming = useMemo(() => {
    if (!isRunning) return false;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") {
        return messages[i]?.id === message.id;
      }
    }
    return false;
  }, [isRunning, messages, message.id]);

  // Separate openui-lang code from persisted <context> form state
  const { content: openuiCode, contextString } = useMemo(() => {
    if (!message.content) return { content: null, contextString: null };
    return separateContentAndContext(message.content);
  }, [message.content]);

  const initialState = useMemo(() => {
    if (!contextString) return undefined;
    try {
      const parsed = JSON.parse(contextString);
      if (Array.isArray(parsed) && typeof parsed[0] === "object") return parsed[0];
      if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      return undefined;
    } catch {
      return undefined;
    }
  }, [contextString]);

  // Persist form state back into the message content
  const handleStateUpdate = useCallback(
    (state: Record<string, unknown>) => {
      const code = openuiCode ?? "";
      const fullMessage = code + "\n" + wrapContext(JSON.stringify([state]));
      updateMessage({ ...message, content: fullMessage });
    },
    [updateMessage, message, openuiCode]
  );

  // Send humanFriendlyMessage as user bubble; wrap LLM context separately
  const handleAction = useCallback(
    (event: ActionEvent) => {
      if (event.type === BuiltinActionType.ContinueConversation) {
        const contentPart = wrapContent(event.humanFriendlyMessage);
        const ctx: unknown[] = [`User clicked: ${event.humanFriendlyMessage}`];
        if (event.formState) ctx.push(event.formState);
        processMessage({ role: "user", content: contentPart + wrapContext(JSON.stringify(ctx)) });
      } else if (event.type === BuiltinActionType.OpenUrl) {
        const url = event.params?.["url"] as string | undefined;
        if (typeof window !== "undefined" && url) window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [processMessage]
  );

  const rawContent = message.content ?? "";
  const format = detectFormat(openuiCode ?? rawContent);

  return (
    <Shell.AssistantMessageContainer>
      {format === "openui" ? (
        <Renderer
          library={openuiChatLibrary}
          response={openuiCode}
          isStreaming={isStreaming}
          onAction={handleAction}
          onStateUpdate={handleStateUpdate}
          initialState={initialState}
        />
      ) : (
        <div className="px-1 py-0.5 prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-code:text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{rawContent}</ReactMarkdown>
        </div>
      )}
    </Shell.AssistantMessageContainer>
  );
}
