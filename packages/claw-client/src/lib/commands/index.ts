// Side-effect import registers the default command set.
import "./builtin";

export {
  dispatchSlashCommand,
  listCommands,
  lookupCommand,
  matchCommands,
  parseSlashCommand,
  registerCommand,
} from "./registry";
export type { Command, CommandContext, CommandMessageSnapshot, CommandResult } from "./types";
