"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantMessageData {
  role: "assistant";
  id: string;
  content: string | null;
}

interface Props {
  message: AssistantMessageData;
}

export function AssistantMessage({ message }: Props) {
  const content = message.content ?? "";

  return (
    <div className="px-1 py-0.5 prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-code:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
