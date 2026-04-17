"use client";

import { useMemo, useState } from "react";
import { useThread } from "@openuidev/react-headless";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { wrapContent, wrapContext } from "@/lib/content-parser";
import type { LinkedAppContext, ThreadUpload } from "@/lib/session-workspace";
import { buildThreadContextPayload } from "@/lib/session-workspace";

function UploadChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      <span className="max-w-[180px] truncate sm:max-w-none">{label}</span>
      {onRemove ? (
        <button
          type="button"
          className="rounded-full p-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          onClick={onRemove}
          title={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

export function SessionComposer({
  uploads,
  linkedApp,
  onPickFiles,
  onRemoveUpload,
  onUploadsSent,
}: {
  uploads: ThreadUpload[];
  linkedApp: LinkedAppContext | null;
  onPickFiles: () => void;
  onRemoveUpload: (uploadId: string) => void;
  onUploadsSent: (uploadIds: string[]) => void;
}) {
  const processMessage = useThread((state) => state.processMessage);
  const cancelMessage = useThread((state) => state.cancelMessage);
  const isRunning = useThread((state) => state.isRunning);
  const isLoadingMessages = useThread((state) => state.isLoadingMessages);
  const [textContent, setTextContent] = useState("");

  const pendingUploads = useMemo(
    () => uploads.filter((upload) => upload.status === "pending"),
    [uploads],
  );

  const isDisabled =
    isRunning ||
    isLoadingMessages ||
    (!textContent.trim() && pendingUploads.length === 0);

  const handleSubmit = async () => {
    if (isDisabled) return;

    const humanText =
      textContent.trim() ||
      `Attached ${pendingUploads.length} file${pendingUploads.length === 1 ? "" : "s"}.`;
    const contextPayload = buildThreadContextPayload({
      linkedApp,
      uploads,
    });
    const contentParts = [wrapContent(humanText)];
    if (contextPayload.length > 0) {
      contentParts.push(wrapContext(JSON.stringify(contextPayload)));
    }

    const uploadIds = pendingUploads.map((upload) => upload.id);
    setTextContent("");

    const sendPromise = processMessage({
      role: "user",
      content: contentParts.join(""),
      attachments: pendingUploads.flatMap((upload) =>
        upload.attachment ? [upload.attachment] : [],
      ),
    } as any);

    if (uploadIds.length > 0) {
      onUploadsSent(uploadIds);
    }

    await sendPromise;
  };

  return (
    <div
      className="openui-claw-session-composer w-full px-3 pb-3 dark:text-zinc-100 sm:px-4 sm:pb-4"
    >
      <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {(pendingUploads.length > 0 || linkedApp) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            {linkedApp ? <UploadChip label={`Refining ${linkedApp.title}`} /> : null}
            {pendingUploads.map((upload) => (
              <UploadChip
                key={upload.id}
                label={upload.name}
                onRemove={() => onRemoveUpload(upload.id)}
              />
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 px-4 py-3">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            onClick={onPickFiles}
            title="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <textarea
            value={textContent}
            onChange={(event) => setTextContent(event.target.value)}
            rows={1}
            placeholder="Type your query here"
            className="max-h-48 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />

          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800"
            onClick={isRunning ? cancelMessage : () => void handleSubmit()}
            disabled={!isRunning && isDisabled}
            title={isRunning ? "Stop" : "Send"}
          >
            {isRunning ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
