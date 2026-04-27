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
import { CornerDownLeft, Plus, RotateCw, Square, X } from "lucide-react";
import { IconButton } from "@/components/layout/sidebar/IconButton";
import type { ModelChoice } from "@/types/gateway-responses";
import { qualifyModel } from "@/lib/models";
import { ContextRing, type ContextBreakdownItem } from "@/components/ui/ContextRing";
import { MobileSwitcherSheet } from "@/components/mobile/MobileSwitcherSheet";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

const THINKING_LEVELS = [
  { value: "", label: "Default" },
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
] as const;

/**
 * Text-button dropdown — renders the current label as a borderless Button; on
 * click, reveals a small panel of options above the trigger (composer sits at
 * the bottom of the page, so the panel opens upward).
 */
function TextButtonSelect({
  value,
  options,
  onChange,
  title,
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string; description?: string }>;
  onChange: (value: string) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || isMobile) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <Button
        variant="borderless"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        title={title}
        className="!font-normal"
      >
        {current?.label ?? "Default"}
      </Button>
      {isMobile ? (
        <MobileSwitcherSheet
          open={open}
          onClose={() => setOpen(false)}
          title={title ?? "Select"}
          activeId={value}
          options={options.map((o) => ({
            id: o.value,
            label: o.label,
            description: o.description,
          }))}
          onSelect={(id) => onChange(id)}
        />
      ) : open ? (
        <div className="absolute bottom-full right-0 z-50 mb-2xs min-w-[160px] rounded-lg border border-border-default bg-popover-background p-3xs shadow-xl dark:bg-elevated">
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-m px-s py-xs text-left font-body text-sm transition-colors ${
                  isActive
                    ? "bg-sunk-light text-text-neutral-primary dark:bg-highlight-subtle"
                    : "text-text-neutral-secondary hover:bg-sunk-light dark:hover:bg-highlight-subtle"
                }`}
              >
                <span
                  className={
                    isActive ? "font-medium" : "font-regular"
                  }
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

function UploadChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border-default bg-foreground px-2.5 py-1 text-sm font-medium text-text-neutral-secondary">
      <span className="max-w-[180px] truncate sm:max-w-none">{label}</span>
      {onRemove ? (
        <button
          type="button"
          className="rounded-full p-0.5 text-text-neutral-tertiary transition-colors hover:bg-sunk hover:text-text-neutral-secondary"
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
    <div className="mx-3 mb-2 overflow-hidden rounded-2xl border border-border-default bg-background shadow-lg">
      {entries.map((entry, index) => (
        <button
          key={`${entry.source}:${entry.name}`}
          type="button"
          onClick={() => onSelect(entry)}
          onMouseEnter={() => onHover(index)}
          className={`flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors ${
            index === activeIndex
              ? "bg-info-background"
              : "hover:bg-sunk-light"
          }`}
        >
          <span className="font-mono text-sm font-semibold text-text-info-primary">
            /{entry.name}
          </span>
          <span className="flex-1 text-sm text-text-neutral-secondary">
            {entry.description}
            {entry.argHint ? (
              <span className="ml-1 text-text-neutral-tertiary">{entry.argHint}</span>
            ) : null}
          </span>
          {entry.source === "gateway" ? (
            <span className="rounded-full bg-foreground px-2 py-0.5 text-sm uppercase tracking-wide text-text-neutral-tertiary">
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
  models = [],
  currentModel = "",
  currentEffort = "",
  onModelChange,
  onEffortChange,
  contextTokens,
  contextLimit,
  contextBreakdown,
}: {
  uploads: ThreadUpload[];
  linkedApp: LinkedAppContext | null;
  onPickFiles: () => void;
  onRemoveUpload: (uploadId: string) => void;
  onUploadsSent: (uploadIds: string[]) => void;
  commandContext?: () => CommandContext;
  gatewayCommands?: GatewayCommand[];
  models?: ModelChoice[];
  /** Qualified model id (provider/id) currently selected, or "" for default. */
  currentModel?: string;
  /** Current thinking/effort level, or "" for default. */
  currentEffort?: string;
  onModelChange?: (value: string) => void;
  onEffortChange?: (value: string) => void;
  /** Tokens used / total context-window for the active model. */
  contextTokens?: number;
  contextLimit?: number;
  contextBreakdown?: ContextBreakdownItem[];
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

  // Auto-grow the textarea: reset height then pin to scrollHeight. Capped by
  // the `max-h-48` class on the element itself (which enables scrolling after
  // the cap is hit).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [textContent]);

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
    <div className="openui-claw-session-composer mb-1 w-full rounded-xl bg-sunk-light p-[2px] dark:bg-foreground sm:mb-3">
      {slashMatches.length > 0 && (
        <SlashMenu
          entries={slashMatches}
          activeIndex={slashActiveIndex}
          onSelect={applySlashCompletion}
          onHover={setSlashActiveIndex}
        />
      )}

      {/* Bordered input card — only the textarea + send/stop button live here. */}
      <div className="overflow-hidden rounded-lg border border-border-default/40 bg-background shadow-md dark:border-border-default/20">
        {(pendingUploads.length > 0 || linkedApp) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border-default px-4 py-3">
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

        <div className="flex items-center gap-2 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={textContent}
            onChange={(event) => setTextContent(event.target.value)}
            rows={1}
            placeholder={isCommandInput ? "" : "Type / for commands"}
            className="max-h-48 flex-1 resize-none bg-transparent py-1 text-sm leading-6 text-text-neutral-primary outline-none placeholder:text-text-neutral-tertiary"
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
            <IconButton
              icon={RotateCw}
              variant="tertiary"
              size="md"
              title="Regenerate last response"
              onClick={() => void handleRegenerate()}
            />
          ) : null}
          <IconButton
            icon={isRunning ? Square : CornerDownLeft}
            variant="primary"
            size="lg"
            title={
              isRunning ? "Stop" : parsedCommand ? `Run /${parsedCommand.command.name}` : "Send"
            }
            disabled={!isRunning && isDisabled}
            onClick={isRunning ? cancelMessage : () => void handleSubmit()}
          />
        </div>
      </div>

      {/* Controls row — lives OUTSIDE the bordered card, no fill. */}
      <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-3 px-1">
        <div className="flex items-center gap-xs">
          <IconButton
            icon={Plus}
            variant="tertiary"
            size="md"
            title="Add context / attach files"
            onClick={onPickFiles}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3xs font-body text-sm text-text-neutral-tertiary">
          {contextTokens != null && contextLimit && contextLimit > 0 ? (
            <>
              <ContextRing
                used={contextTokens}
                limit={contextLimit}
                breakdown={contextBreakdown}
              />
              <span aria-hidden="true" className="ml-2xs text-text-neutral-tertiary/60">
                ·
              </span>
            </>
          ) : null}
          {onModelChange ? (
            <TextButtonSelect
              value={currentModel}
              onChange={onModelChange}
              title="Model"
              options={[
                { value: "", label: "Default" },
                ...models.map((m) => ({
                  value: qualifyModel(m.id, m.provider),
                  label: m.name,
                })),
              ]}
            />
          ) : null}
          {onModelChange && onEffortChange ? (
            <span aria-hidden="true" className="text-text-neutral-tertiary/60">
              ·
            </span>
          ) : null}
          {onEffortChange ? (
            <TextButtonSelect
              value={currentEffort}
              onChange={onEffortChange}
              title="Reasoning effort"
              options={THINKING_LEVELS.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
