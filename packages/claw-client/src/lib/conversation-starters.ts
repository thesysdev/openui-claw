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
    displayText: "Build a daily AI news digest",
    prompt:
      "Build a daily AI news digest. Pull the latest AI news every morning from a few high-signal sources (Hacker News, The Verge, and the Anthropic and OpenAI blogs). Cluster the stories by topic, dedupe write-ups of the same launch, and render a single-page digest with section headers per topic and a one-line summary under each headline.",
    accent: "info",
    iconKey: "newspaper",
  },
  {
    displayText: "Build a social monitoring board",
    prompt:
      "Build a social monitoring board. Track mentions of my product across Twitter/X, Reddit, and Hacker News. Show overall mention volume over time, a sentiment trend, the top voices driving the conversation, and a live feed of recent posts I can click through to the source.",
    accent: "accent",
    iconKey: "radar",
  },
  {
    displayText: "Build a finance dashboard with alerts",
    prompt:
      "Build a finance dashboard with alerts. Track my portfolio and surface market alerts. Show current holdings with P/L, a watchlist, today's movers, and a feed of price/news triggers I've configured. Refresh quotes during market hours and notify me when an alert fires.",
    accent: "success",
    iconKey: "trending-up",
  },
  {
    displayText: "Build an SEO dashboard with rankings",
    prompt:
      "Build an SEO dashboard with rankings. Track search rankings and surface content opportunities. Include keyword positions over time, top movers, competitor gaps, and a prioritized backlog of topics to write about — each with target keywords and an estimated traffic upside.",
    accent: "alert",
    iconKey: "search-check",
  },
];
