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
}

export const DEFAULT_STARTERS: ConversationStarter[] = [
  {
    displayText: "Build me an app",
    prompt:
      "Build me a small app I can use right now. Pick something useful and ship a working version with sample data.",
  },
  {
    displayText: "Set up a daily digest",
    prompt:
      "Create a cron job that runs every morning at 8am and summarises my recent activity into a notification.",
  },
  {
    displayText: "Pull data from a website",
    prompt:
      "Fetch some data from a public website and turn it into a clean table I can browse.",
  },
  {
    displayText: "What can you do?",
    prompt:
      "Give me a short tour of what you can do — tools, apps, artifacts, cron jobs — with one example of each.",
  },
];
