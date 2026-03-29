"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { UserMessage as UserMsg } from "@openuidev/react-headless";
import { separateContentAndContext } from "@/lib/content-parser";

function FormDataAccordion({ contextString }: { contextString: string }) {
  const [expanded, setExpanded] = useState(false);

  let pretty: string;
  try {
    pretty = JSON.stringify(JSON.parse(contextString), null, 2);
  } catch {
    pretty = contextString;
  }

  return (
    <div className="openui-genui-user-message__form-state">
      <button
        type="button"
        className="openui-genui-user-message__form-state-header"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="openui-genui-user-message__form-state-label">Form data</span>
        <ChevronDown
          size={14}
          className={`openui-genui-user-message__form-state-chevron${expanded ? " openui-genui-user-message__form-state-chevron--expanded" : ""}`}
        />
      </button>
      {expanded && (
        <pre className="openui-genui-user-message__form-state-content text-xs overflow-auto">
          {pretty}
        </pre>
      )}
    </div>
  );
}

interface Props {
  message: UserMsg;
}

export function UserMessage({ message }: Props) {
  const rawContent = typeof message.content === "string" ? message.content : "";
  const { content: humanText, contextString } = separateContentAndContext(rawContent);

  return (
    <div className="openui-shell-thread-message-user">
      <div className="openui-genui-user-message">
        {contextString && <FormDataAccordion contextString={contextString} />}
        <div className="openui-shell-thread-message-user__content">
          {humanText && <div>{humanText}</div>}
        </div>
      </div>
    </div>
  );
}
