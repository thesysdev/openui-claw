"use client";

import { wrapContent, wrapContext } from "@/lib/content-parser";
import { BuiltinActionType, type ActionEvent } from "@openuidev/react-lang";

/**
 * Shared handlers for `Renderer.onAction` events. Both the inline assistant-
 * message renderer and the standalone `AppDetail` renderer want identical
 * behavior for built-in action types; this module keeps them in sync.
 *
 * Only two AG-UI built-in action types reach `onAction`:
 *   - `BuiltinActionType.OpenUrl`              → `window.open`
 *   - `BuiltinActionType.ContinueConversation` → post a user message to chat
 * `@Run` / `@Set` / `@Reset` are resolved inside the Renderer and never
 * surface here.
 */

/**
 * Open the URL from an `OpenUrl` action in a new tab.
 * Returns `true` when the event was handled, `false` otherwise so callers can
 * fall through to other handlers.
 */
export function handleOpenUrlAction(event: ActionEvent): boolean {
  if (event.type !== BuiltinActionType.OpenUrl) return false;
  const url = event.params?.["url"] as string | undefined;
  if (typeof window !== "undefined" && url) {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocker rejected — fall back to anchor click so the browser
      // treats it as a first-party navigation from the same user gesture.
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }
  return true;
}

/**
 * Build the chat-message payload for a `ContinueConversation` action.
 *
 * The renderer emits a `humanFriendlyMessage` plus an optional `formState`.
 * We wrap both into the same `<content>` / `<context>` envelope that the
 * rest of the chat pipeline expects, so continuations from apps look
 * indistinguishable from continuations triggered by inline chat UI.
 *
 * Pass `fallbackFormState` when the caller has a context-derived default
 * (e.g. an assistant message's `initialState`) to fall back to when the
 * action itself didn't carry `formState` — apps don't have that concept
 * and should omit it.
 */
export function buildContinueConversationPayload(
  event: ActionEvent,
  fallbackFormState?: Record<string, unknown>,
): { role: "user"; content: string } | null {
  if (event.type !== BuiltinActionType.ContinueConversation) return null;

  const contentPart = wrapContent(event.humanFriendlyMessage);
  const ctx: unknown[] = [`User clicked: ${event.humanFriendlyMessage}`];

  const formState =
    event.formState ??
    (fallbackFormState && typeof fallbackFormState === "object"
      ? fallbackFormState
      : undefined);
  if (formState) ctx.push(formState);

  return {
    role: "user",
    content: contentPart + wrapContext(JSON.stringify(ctx)),
  };
}
