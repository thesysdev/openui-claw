"use client";

import {
  dispatchSlashCommand,
  listCommands,
  matchCommands,
  parseSlashCommand,
  type CommandContext,
} from "@/lib/commands";
import { wrapContent, wrapContext } from "@/lib/content-parser";
import type { GatewayCommand } from "@/lib/engines/types";
import type { LinkedAppContext, ThreadUpload } from "@/lib/session-workspace";
import { buildThreadContextPayload } from "@/lib/session-workspace";
import { useThread } from "@openuidev/react-headless";
import { ArrowUp, Paperclip, RotateCw, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function UploadChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
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

/**
 * Shared display shape for the slash menu. Both our local commands (which run
 * client-side) and OpenClaw's gateway commands (which get intercepted by the
 * server when typed) project into this.
 */
type SlashEntry = {
  name: string;
  description: string;
  argHint?: string;
  source: "local" | "gateway";
};

function SlashMenu({
  entries,
  activeIndex,
  onSelect,
  onHover,
}: {
  entries: SlashEntry[];
  activeIndex: number;
  onSelect: (entry: SlashEntry) => void;
  onHover: (index: number) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="mx-3 mb-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {entries.map((entry, index) => (
        <button
          key={`${entry.source}:${entry.name}`}
          type="button"
          onClick={() => onSelect(entry)}
          onMouseEnter={() => onHover(index)}
          className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors ${
            index === activeIndex
              ? "bg-sky-50 dark:bg-sky-500/10"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
          }`}
        >
          <span className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-400">
            /{entry.name}
          </span>
          <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-300">
            {entry.description}
            {entry.argHint ? (
              <span className="ml-1 text-zinc-400 dark:text-zinc-500">{entry.argHint}</span>
            ) : null}
          </span>
          {entry.source === "gateway" ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              gateway
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function SessionComposer({
  uploads,
  linkedApp,
  onPickFiles,
  onRemoveUpload,
  onUploadsSent,
  commandContext,
  gatewayCommands = [],
  onDispatchGatewayCommand,
}: {
  uploads: ThreadUpload[];
  linkedApp: LinkedAppContext | null;
  onPickFiles: () => void;
  onRemoveUpload: (uploadId: string) => void;
  onUploadsSent: (uploadIds: string[]) => void;
  commandContext?: () => CommandContext;
  gatewayCommands?: GatewayCommand[];
  /**
   * Called when the user submits a slash command that matches a gateway
   * command we know how to intercept locally (e.g. `/reset` → `sessions.reset`
   * RPC). Return `true` if the command was handled and the message should NOT
   * be sent to the LLM. Return `false` to fall through to `chat.send`.
   */
  onDispatchGatewayCommand?: (name: string, args: string) => Promise<boolean>;
}) {
  const processMessage = useThread((state) => state.processMessage);
  const cancelMessage = useThread((state) => state.cancelMessage);
  const isRunning = useThread((state) => state.isRunning);
  const isLoadingMessages = useThread((state) => state.isLoadingMessages);
  const threadMessages = useThread((state) => state.messages);
  const [textContent, setTextContent] = useState("");
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const pendingUploads = useMemo(
    () => uploads.filter((upload) => upload.status === "pending"),
    [uploads],
  );

  const slashMatches = useMemo<SlashEntry[]>(() => {
    const trimmed = textContent.trimStart();
    if (!trimmed.startsWith("/")) return [];
    // Only show menu while the user is still composing the command token.
    const afterSlash = trimmed.slice(1);
    const hasSpace = /\s/.test(afterSlash);
    if (hasSpace) return [];

    const localEntries: SlashEntry[] = (
      afterSlash.length === 0 ? listCommands() : matchCommands(afterSlash)
    ).map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      argHint: cmd.argHint,
      source: "local",
    }));

    const gatewayEntries: SlashEntry[] = gatewayCommands
      .filter((cmd) => cmd.name.toLowerCase().startsWith(afterSlash.toLowerCase()))
      .map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        argHint: cmd.argHint,
        source: "gateway",
      }));

    // Local wins on name collisions so host-specific behavior can override
    // whatever the gateway registered under the same name.
    const seen = new Set(localEntries.map((entry) => entry.name));
    const filteredGateway = gatewayEntries.filter((entry) => !seen.has(entry.name));

    return [...localEntries, ...filteredGateway].sort((a, b) => a.name.localeCompare(b.name));
  }, [textContent, gatewayCommands]);

  useEffect(() => {
    if (slashActiveIndex >= slashMatches.length) {
      setSlashActiveIndex(Math.max(0, slashMatches.length - 1));
    }
  }, [slashActiveIndex, slashMatches.length]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      if (!detail?.text) return;
      setTextContent(detail.text);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    window.addEventListener("openui-claw:prime-composer", listener as EventListener);
    return () =>
      window.removeEventListener("openui-claw:prime-composer", listener as EventListener);
  }, []);

  const applySlashCompletion = (entry: SlashEntry) => {
    setTextContent(`/${entry.name}${entry.argHint ? " " : ""}`);
    setSlashActiveIndex(0);
    textareaRef.current?.focus();
  };

  // Find the last user message in the current thread — used to "regenerate"
  // (re-send the same text, let the model produce a fresh assistant turn).
  const lastUserMessage = useMemo(() => {
    for (let i = threadMessages.length - 1; i >= 0; i -= 1) {
      const msg = threadMessages[i] as { role?: string; content?: unknown };
      if (msg?.role === "user") return msg;
    }
    return null;
  }, [threadMessages]);

  const canRegenerate =
    !isRunning && !isLoadingMessages && lastUserMessage != null && textContent.length === 0;

  const handleRegenerate = async () => {
    if (!lastUserMessage) return;
    const content =
      typeof lastUserMessage.content === "string"
        ? lastUserMessage.content
        : Array.isArray(lastUserMessage.content)
          ? (lastUserMessage.content as Array<{ text?: unknown }>)
              .map((part) =>
                part && typeof part === "object" && typeof part.text === "string" ? part.text : "",
              )
              .join("")
          : "";
    if (!content.trim()) return;
    await processMessage({
      role: "user",
      content,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  };

  const isCommandInput = textContent.trimStart().startsWith("/");
  const parsedCommand = isCommandInput ? parseSlashCommand(textContent) : null;

  const isDisabled =
    isRunning ||
    isLoadingMessages ||
    (!textContent.trim() && pendingUploads.length === 0 && !parsedCommand);

  const handleSubmit = async () => {
    if (isDisabled) return;

    // Slash command path — short-circuit without sending to the LLM.
    if (parsedCommand && commandContext) {
      const context = commandContext();
      const result = await dispatchSlashCommand(textContent, context);
      if (result.handled) {
        setTextContent(result.replaceInput ?? "");
        return;
      }
    }

    // Gateway-command interception: for slash commands that map to a direct
    // RPC (e.g. /reset → sessions.reset), dispatch locally rather than routing
    // through `chat.send`. The gateway's webchat channel doesn't run the
    // slash-command handler on chat.send the way other channels do.
    if (onDispatchGatewayCommand) {
      const trimmed = textContent.trimStart();
      if (trimmed.startsWith("/")) {
        const spaceIdx = trimmed.search(/\s/);
        const name = (
          spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)
        ).toLowerCase();
        const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();
        const handled = await onDispatchGatewayCommand(name, args);
        if (handled) {
          setTextContent("");
          return;
        }
      }
    }

    const humanText =
      textContent.trim() ||
      `Attached ${pendingUploads.length} file${pendingUploads.length === 1 ? "" : "s"}.`;
    const contextPayload = buildThreadContextPayload({
      linkedApp,
      uploads: pendingUploads,
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
    <div className="openui-claw-session-composer w-full px-3 pb-3 dark:text-zinc-100 sm:px-4 sm:pb-4">
      {slashMatches.length > 0 && (
        <SlashMenu
          entries={slashMatches}
          activeIndex={slashActiveIndex}
          onSelect={applySlashCompletion}
          onHover={setSlashActiveIndex}
        />
      )}

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
            ref={textareaRef}
            value={textContent}
            onChange={(event) => setTextContent(event.target.value)}
            rows={1}
            placeholder={isCommandInput ? "" : "Type your query here or /command"}
            className="max-h-48 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            onKeyDown={(event) => {
              if (slashMatches.length > 0) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSlashActiveIndex((idx) => Math.min(slashMatches.length - 1, idx + 1));
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSlashActiveIndex((idx) => Math.max(0, idx - 1));
                  return;
                }
                if (event.key === "Tab") {
                  const chosen = slashMatches[slashActiveIndex];
                  if (chosen) {
                    event.preventDefault();
                    applySlashCompletion(chosen);
                    return;
                  }
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setTextContent("");
                  return;
                }
                // Enter falls through to submission — literal text wins.
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />

          {canRegenerate ? (
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              onClick={() => void handleRegenerate()}
              title="Regenerate last response"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800"
            onClick={isRunning ? cancelMessage : () => void handleSubmit()}
            disabled={!isRunning && isDisabled}
            title={
              isRunning ? "Stop" : parsedCommand ? `Run /${parsedCommand.command.name}` : "Send"
            }
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
