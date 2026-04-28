"use client";

import {
  CornerDownLeft,
  Cpu,
  Lightbulb,
  Newspaper,
  Radar,
  SearchCheck,
  TrendingUp,
} from "lucide-react";
import { useThread } from "@openuidev/react-headless";
import type { ComponentType } from "react";

import { DEFAULT_STARTERS } from "@/lib/conversation-starters";
import type { ConversationStarter } from "@/lib/conversation-starters";
import { usePreferences } from "@/lib/preferences";

interface Props {
  agentName?: string;
  /** Composer JSX rendered between header and starters. */
  composer: React.ReactNode;
}

const ICON_BY_KEY: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  newspaper: Newspaper,
  radar: Radar,
  "trending-up": TrendingUp,
  "search-check": SearchCheck,
};

/** Per-row icon color — tile is always neutral-white, icon picks up the accent. */
const ACCENT_ICON: Record<NonNullable<ConversationStarter["accent"]>, string> = {
  info: "text-text-info-primary",
  accent: "text-text-accent-primary",
  success: "text-text-success-primary",
  alert: "text-text-alert-primary",
};

/** Hover-fill class per accent — tile picks up the accent tint when the row is hovered. */
const ACCENT_HOVER_FILL: Record<NonNullable<ConversationStarter["accent"]>, string> = {
  info: "group-hover:bg-info-background group-hover:border-border-info",
  accent: "group-hover:bg-highlight-subtle group-hover:border-border-accent",
  success: "group-hover:bg-success-background group-hover:border-border-success",
  alert: "group-hover:bg-alert-background group-hover:border-border-alert",
};

/** Sidebar-spec tile: h-l w-l (20×20), white surface, subtle border + shadow. */
const TILE_BASE =
  "flex h-l w-l shrink-0 items-center justify-center rounded-m border border-border-default/70 bg-background shadow-sm transition-colors dark:border-border-default/16 dark:bg-elevated-light";

/**
 * Empty-state hero for a fresh agent: small square icon tile + agent name +
 * description, the composer centered below, then a list of conversation
 * starters that route through `useThread.processMessage` on click.
 *
 * Self-gates on `messages.length === 0 && !isLoadingMessages`. Returns null
 * once the conversation has any messages so the chat surface flips back to
 * the standard scroll layout.
 */
export function EmptyAgentHero({ agentName, composer }: Props) {
  const messages = useThread((s) => s.messages);
  const isLoadingMessages = useThread((s) => s.isLoadingMessages);
  const processMessage = useThread((s) => s.processMessage);
  const { assistantName } = usePreferences();
  if (isLoadingMessages || messages.length > 0) return null;

  const displayName = assistantName.trim() || agentName || "your agent";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-ml py-3xl">
      <div className="flex w-full max-w-2xl flex-col items-center">
        {/* Header: small square icon tile + name + description */}
        <div className="flex w-full flex-col items-center gap-s">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-default/70 bg-background text-text-info-primary shadow-sm dark:border-border-default/16 dark:bg-elevated-light">
            <Cpu size={16} />
          </div>
          <h2 className="text-center font-heading text-lg font-bold text-text-neutral-primary">
            Hi, I&apos;m {displayName}
          </h2>
          <p className="max-w-md text-center font-body text-sm text-text-neutral-tertiary">
            Ask me to build an app, schedule tasks, pull data from a site, and
            run everything automatically.
          </p>
        </div>

        {/* Composer in the middle */}
        <div className="mt-xl w-full">{composer}</div>

        {/* Conversation starters — bare rows, 80px narrower than the composer. */}
        <div className="mt-ml flex w-full flex-col px-[40px]">
          {DEFAULT_STARTERS.map((s) => {
            const Icon = (s.iconKey && ICON_BY_KEY[s.iconKey]) ?? Lightbulb;
            const iconColor = s.accent ? ACCENT_ICON[s.accent] : "text-text-neutral-tertiary";
            const hoverFill = s.accent ? ACCENT_HOVER_FILL[s.accent] : "";
            return (
              <button
                key={s.displayText}
                type="button"
                onClick={() => {
                  void processMessage({ role: "user", content: s.prompt });
                }}
                className="group flex w-full items-center gap-m rounded-lg p-s text-left transition-colors hover:bg-sunk-light dark:hover:bg-elevated-light"
              >
                <span className={`${TILE_BASE} ${hoverFill}`}>
                  <Icon size={11} className={iconColor} />
                </span>
                <span className="flex-1 truncate font-body text-sm text-text-neutral-secondary group-hover:text-text-neutral-primary">
                  {s.displayText}
                </span>
                <CornerDownLeft
                  size={13}
                  className="shrink-0 text-text-neutral-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
