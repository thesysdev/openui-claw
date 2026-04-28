/**
 * Default starter prompts shown on an empty chat. Kept here (not in the
 * component) so future per-agent / per-route customization can pick a set
 * by id without touching the chat shell.
 *
 * `displayText` is what the user sees. `prompt` is what gets sent to the
 * model when clicked — `Shell.ConversationStarter` calls `processMessage`
 * with `{ role: "user", content: prompt }`.
 */
export interface ConversationStarter {
  displayText: string;
  prompt: string;
  /** Visual accent — drives the icon + tile color on the empty-state list. */
  accent?: "info" | "accent" | "success" | "alert";
  /** Lucide icon key picked by the renderer; falls back to Lightbulb. */
  iconKey?: "newspaper" | "radar" | "trending-up" | "search-check";
}

export const DEFAULT_STARTERS: ConversationStarter[] = [
  {
    displayText: "Build me a daily news page that fetches the latest news in AI",
    prompt:
      "Build me a daily news page that fetches the latest news in AI. Pull from a few reputable sources, group by topic, and let me click into each headline.",
    accent: "info",
    iconKey: "newspaper",
  },
  {
    displayText: "Build me a social monitoring page that tracks mentions of my product",
    prompt:
      "Build me a social monitoring page that tracks mentions of my product. Surface volume, sentiment, and the top loud voices, with a feed of recent posts.",
    accent: "accent",
    iconKey: "radar",
  },
  {
    displayText: "Build me a finance dashboard that tracks my portfolio and market alerts",
    prompt:
      "Build me a finance dashboard that tracks my portfolio and market alerts. Show holdings, P/L, watchlist, and a feed of price/news triggers.",
    accent: "success",
    iconKey: "trending-up",
  },
  {
    displayText: "Build me an SEO dashboard that tracks rankings and finds content opportunities",
    prompt:
      "Build me an SEO dashboard that tracks rankings and finds content opportunities. Include keyword positions, competitor gaps, and a backlog of topics to write about.",
    accent: "alert",
    iconKey: "search-check",
  },
];
