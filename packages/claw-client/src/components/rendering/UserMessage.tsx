"use client";

import { separateContentAndContext } from "@/lib/content-parser";
import { extractMessageUploadIds, sessionUploadPreviewId } from "@/lib/session-workspace";
import { useUploadMeta, useUploadPreview } from "@/lib/uploads-context";
import type { UserMessage as UserMsg } from "@openuidev/react-headless";
import { useArtifactStore } from "@openuidev/react-headless";
import { ArtifactPanel } from "@openuidev/react-ui";
import { ChevronDown, FileArchive, FileCode2, FileImage, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";

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
        <pre className="openui-genui-user-message__form-state-content text-sm overflow-auto">
          {pretty}
        </pre>
      )}
    </div>
  );
}

function kindIcon(kind: string | undefined) {
  switch (kind) {
    case "code":
    case "html":
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
  if (mimeType === "text/html") return "html";
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript"
  )
    return "text";
  return "file";
}

function decodeBase64Text(dataUrl: string): string {
  try {
    const base64 = dataUrl.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function InlineUploadChip({ remoteId }: { remoteId: string }) {
  const meta = useUploadMeta(remoteId);
  const dataUrl = useUploadPreview(remoteId);
  const kind = inferKindFromMime(meta?.mimeType);
  const Icon = kindIcon(kind);
  const name = meta?.name ?? "Attachment";
  const artifactStore = useArtifactStore();
  const previewId = sessionUploadPreviewId(remoteId);
  const openArtifact = () => artifactStore.getState().openArtifact(previewId);
  const closeArtifact = () => artifactStore.getState().closeArtifact(previewId);

  // If this chip unmounts (message scrolls out of a virtualised list, thread
  // swap, etc.) while its preview is open, the artifactStore would otherwise
  // hold on to a previewId pointing at a now-gone panel — the next time the
  // store opens *anything*, the orphaned id can race the new one. Forcibly
  // close on unmount so the store stays consistent with the DOM.
  useEffect(() => {
    return () => {
      const state = artifactStore.getState();
      if (state.activeArtifactId === previewId) {
        state.closeArtifact(previewId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId]);

  // Co-located ArtifactPanel registration: data comes from the same hooks the
  // thumbnail uses, so the fullscreen preview is available the instant the
  // user picks the file — no race with thread-workspace state during the
  // first streaming run.
  const panel = (
    <ArtifactPanel artifactId={previewId} title={name} header={false}>
      <div className="flex h-full flex-col bg-background dark:bg-sunk">
        <div className="flex items-center justify-between border-b border-border-default/60 px-ml py-s">
          <span className="truncate font-label text-md font-medium text-text-neutral-primary">
            {name}
          </span>
          <button
            type="button"
            onClick={closeArtifact}
            className="rounded-m p-2xs text-text-neutral-tertiary hover:bg-sunk-light hover:text-text-neutral-primary"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-stretch justify-stretch overflow-auto bg-sunk-light dark:bg-sunk-deep">
          {!dataUrl ? (
            <div className="m-auto p-l text-sm text-text-neutral-tertiary">Loading preview…</div>
          ) : kind === "image" ? (
            <div className="m-auto p-l">
              <img src={dataUrl} alt={name} className="max-h-full max-w-full object-contain" />
            </div>
          ) : kind === "pdf" ? (
            <iframe src={dataUrl} title={name} className="h-full w-full border-0 bg-background" />
          ) : kind === "html" ? (
            // Sandbox the iframe so uploaded HTML can't run scripts or
            // navigate the parent. `srcdoc` is preferred over `src=dataUrl`
            // because Chrome strips data: URL navigation in some setups.
            <iframe
              srcDoc={decodeBase64Text(dataUrl)}
              title={name}
              sandbox=""
              className="h-full w-full border-0 bg-white"
            />
          ) : kind === "text" ? (
            <pre className="m-0 h-full w-full overflow-auto whitespace-pre p-l font-code text-sm leading-body text-text-neutral-primary">
              {decodeBase64Text(dataUrl)}
            </pre>
          ) : (
            <div className="m-auto p-l text-sm text-text-neutral-tertiary">
              {meta?.mimeType ?? "Attachment"} — preview not available
            </div>
          )}
        </div>
      </div>
    </ArtifactPanel>
  );

  if (kind === "image" && dataUrl) {
    return (
      <>
        <button
          type="button"
          className="group relative overflow-hidden rounded-xl border border-border-default bg-background shadow-sm transition-transform hover:scale-[1.02]"
          onClick={openArtifact}
          title={name}
        >
          <img src={dataUrl} alt={name} className="block h-24 w-24 object-cover" />
        </button>
        {panel}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-sunk-light"
        onClick={openArtifact}
        title={name}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-text-neutral-secondary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex max-w-[180px] flex-col">
          <span className="truncate text-sm font-medium text-text-neutral-primary">
            {name}
          </span>
          {meta?.mimeType ? (
            <span className="truncate text-sm uppercase tracking-wide text-text-neutral-tertiary">
              {meta.mimeType}
            </span>
          ) : null}
        </span>
      </button>
      {panel}
    </>
  );
}

function InlineUploads({ remoteIds }: { remoteIds: string[] }) {
  if (remoteIds.length === 0) return null;
  // `mr-auto` + `justify-start` pin the chip row to the left edge of the
  // message column. The user-message bubble itself is left-aligned via
  // globals.css overrides; without these, the openui-shell parent's
  // default flex layout can drift the upload preview toward center.
  return (
    <div className="mb-2 mr-auto flex flex-wrap justify-start gap-2">
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
