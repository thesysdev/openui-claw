"use client";

import { useThread } from "@openuidev/react-headless";
import { Shell } from "@openuidev/react-ui";
import { Sparkles } from "lucide-react";

import { DEFAULT_STARTERS } from "@/lib/conversation-starters";
import { usePreferences } from "@/lib/preferences";

/**
 * Shown above `<Shell.Messages>` when a chat has no messages yet.
 *
 * react-ui ships `Shell.WelcomeScreen`, but it's a full-page replacement
 * that bakes in its own composer — incompatible with our chat shell, where
 * the `SessionComposer` is always mounted below the message list. So we
 * render the welcome content *and* `Shell.ConversationStarter` together as
 * a single centered block, taking up the whole empty scroll area so the
 * starters sit visually attached to the greeting (not orphaned at the
 * bottom of the page).
 *
 * Self-gates on `messages.length === 0 && !isLoadingMessages`. Returns
 * `null` once the conversation has any messages — including optimistic
 * user-side ones — so the welcome content disappears as soon as the user
 * sends or picks a starter. `Shell.ConversationStarter` self-gates the
 * same way, so its click handlers route through `useThread.processMessage`
 * with zero extra plumbing.
 */
export function EmptyChatWelcome({ agentName }: { agentName?: string }) {
  const messages = useThread((s) => s.messages);
  const isLoadingMessages = useThread((s) => s.isLoadingMessages);
  const { assistantName } = usePreferences();
  if (isLoadingMessages || messages.length > 0) return null;

  // User-customized assistantName wins over the agent's own name; fall
  // back to the generic greeting if neither is set.
  const displayName = assistantName.trim() || agentName;
  const greeting = displayName ? `Hi from ${displayName}` : "Hi there";

  return (
    <div className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center px-ml py-3xl">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <div className="mb-ml flex h-14 w-14 items-center justify-center rounded-full bg-info-background text-text-info-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-center font-heading text-2xl font-bold text-text-neutral-primary">
          {greeting} <span aria-hidden>👋</span>
        </h2>
        <p className="mt-s max-w-md text-center font-body text-md text-text-neutral-secondary">
          Ask me to build an app, schedule a recurring task, or pull data from a website. I can also
          write artifacts (notes, tables, docs) and run them on a schedule.
        </p>

        <div className="mt-2xl w-full">
          <Shell.ConversationStarter starters={DEFAULT_STARTERS} variant="long" />
        </div>
      </div>
    </div>
  );
}
