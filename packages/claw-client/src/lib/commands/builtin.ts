import { registerCommand } from "./registry";
import type { CommandContext, CommandMessageSnapshot } from "./types";

function threadToMarkdown(title: string | undefined, messages: CommandMessageSnapshot[]): string {
  const lines: string[] = [];
  lines.push(`# ${title ?? "Chat"}`);
  lines.push("");
  for (const msg of messages) {
    if (msg.role === "activity") continue;
    const heading = msg.role === "user" ? "**You**" : "**Assistant**";
    const ts = msg.timestamp ? `  _(${msg.timestamp})_` : "";
    lines.push(`${heading}${ts}`);
    lines.push("");
    lines.push(msg.content.trim() || "_(empty)_");
    lines.push("");
  }
  return lines.join("\n");
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "chat"
  );
}

// Note: session reset is handled by OpenClaw's native `/reset` command, which
// our composer forwards verbatim via `chat.send` (the gateway's command router
// intercepts slash-prefixed chat messages). No local alias needed.

registerCommand({
  name: "export",
  aliases: ["save"],
  description: "Download the thread as markdown or json",
  argHint: "[markdown|json]",
  run: (args, ctx: CommandContext) => {
    const format = (args || "markdown").toLowerCase().trim();
    const title = ctx.threadTitle ?? "Chat";
    const baseName = slugify(title);
    if (format === "json") {
      const payload = JSON.stringify({ title, messages: ctx.messages }, null, 2);
      ctx.downloadBlob(`${baseName}.json`, "application/json", payload);
      ctx.toast("Exported thread as JSON", "success");
      return;
    }
    // Default: markdown
    const md = threadToMarkdown(title, ctx.messages);
    ctx.downloadBlob(`${baseName}.md`, "text/markdown", md);
    ctx.toast("Exported thread as markdown", "success");
  },
});
