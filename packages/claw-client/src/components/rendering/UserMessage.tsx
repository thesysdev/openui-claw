"use client";

import { separateContentAndContext } from "@/lib/content-parser";
import { extractMessageUploadIds, sessionUploadPreviewId } from "@/lib/session-workspace";
import { useUploadMeta, useUploadPreview } from "@/lib/uploads-context";
import type { UserMessage as UserMsg } from "@openuidev/react-headless";
import { useArtifactStore } from "@openuidev/react-headless";
import { ChevronDown, FileArchive, FileCode2, FileImage, FileText } from "lucide-react";
import { useState } from "react";

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

function kindIcon(kind: string | undefined) {
  switch (kind) {
    case "code":
      return FileCode2;
    case "image":
      return FileImage;
    case "markdown":
    case "pdf":
    case "text":
      return FileText;
    default:
      return FileArchive;
  }
}

function inferKindFromMime(mimeType: string | undefined): string {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("text/")) return "text";
  return "file";
}

function InlineUploadChip({ remoteId }: { remoteId: string }) {
  const meta = useUploadMeta(remoteId);
  const dataUrl = useUploadPreview(remoteId);
  const kind = inferKindFromMime(meta?.mimeType);
  const Icon = kindIcon(kind);
  const name = meta?.name ?? "Attachment";
  const artifactStore = useArtifactStore();
  const openArtifact = (previewId: string) => artifactStore.getState().openArtifact(previewId);

  if (kind === "image" && dataUrl) {
    return (
      <button
        type="button"
        className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-transform hover:scale-[1.02] dark:border-zinc-700 dark:bg-zinc-900"
        onClick={() => openArtifact(sessionUploadPreviewId(remoteId))}
        title={name}
      >
        <img src={dataUrl} alt={name} className="block h-24 w-24 object-cover" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-xs shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      onClick={() => openArtifact(sessionUploadPreviewId(remoteId))}
      title={name}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex max-w-[180px] flex-col">
        <span className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
          {name}
        </span>
        {meta?.mimeType ? (
          <span className="truncate text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {meta.mimeType}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function InlineUploads({ remoteIds }: { remoteIds: string[] }) {
  if (remoteIds.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {remoteIds.map((id) => (
        <InlineUploadChip key={id} remoteId={id} />
      ))}
    </div>
  );
}

interface Props {
  message: UserMsg;
}

export function UserMessage({ message }: Props) {
  const rawContent = typeof message.content === "string" ? message.content : "";
  const { content: humanText, contextString } = separateContentAndContext(rawContent);
  const uploadIds = extractMessageUploadIds(rawContent);

  // Anything non-upload (e.g. form_state) is still exposed via the accordion.
  let accordionContext: string | null = null;
  if (contextString) {
    try {
      const parsed = JSON.parse(contextString);
      if (Array.isArray(parsed)) {
        const remaining = parsed.filter(
          (entry) =>
            !entry ||
            typeof entry !== "object" ||
            (entry.type !== "thread_uploads" && entry.type !== "linked_app"),
        );
        if (remaining.length > 0) accordionContext = JSON.stringify(remaining);
      } else {
        accordionContext = contextString;
      }
    } catch {
      accordionContext = contextString;
    }
  }

  return (
    <div className="openui-shell-thread-message-user">
      <div className="openui-genui-user-message">
        <InlineUploads remoteIds={uploadIds} />
        {accordionContext && <FormDataAccordion contextString={accordionContext} />}
        <div className="openui-shell-thread-message-user__content">
          {humanText && <div>{humanText}</div>}
        </div>
      </div>
    </div>
  );
}
