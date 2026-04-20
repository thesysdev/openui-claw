import type { Command, CommandContext } from "./types";

const registered = new Map<string, Command>();

export function registerCommand(command: Command): void {
  registered.set(command.name, command);
  for (const alias of command.aliases ?? []) {
    registered.set(alias, command);
  }
}

export function listCommands(): Command[] {
  const unique = new Set<Command>();
  for (const cmd of registered.values()) unique.add(cmd);
  return [...unique].sort((a, b) => a.name.localeCompare(b.name));
}

export function lookupCommand(name: string): Command | null {
  return registered.get(name.toLowerCase()) ?? null;
}

export function matchCommands(prefix: string): Command[] {
  const lower = prefix.toLowerCase();
  const unique = new Set<Command>();
  for (const [key, cmd] of registered.entries()) {
    if (key.startsWith(lower)) unique.add(cmd);
  }
  return [...unique].sort((a, b) => a.name.localeCompare(b.name));
}

/** Attempts to interpret `raw` as a slash command. Returns the parsed command
 * + args when it's a command; returns null when the string is a normal message. */
export function parseSlashCommand(raw: string): {
  command: Command;
  args: string;
} | null {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("/")) return null;
  const afterSlash = trimmed.slice(1);
  if (afterSlash.length === 0) return null;
  const space = afterSlash.search(/\s/);
  const name = (space === -1 ? afterSlash : afterSlash.slice(0, space)).toLowerCase();
  const args = space === -1 ? "" : afterSlash.slice(space + 1).trim();
  const cmd = lookupCommand(name);
  if (!cmd) return null;
  return { command: cmd, args };
}

export async function dispatchSlashCommand(
  raw: string,
  context: CommandContext,
): Promise<{ handled: boolean; replaceInput?: string }> {
  const parsed = parseSlashCommand(raw);
  if (!parsed) return { handled: false };
  const result = await parsed.command.run(parsed.args, context);
  return {
    handled: true,
    replaceInput: result && typeof result === "object" ? result.replaceInput : undefined,
  };
}
