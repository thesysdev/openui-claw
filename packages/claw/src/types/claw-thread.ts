import type { Thread } from "@openuidev/react-headless";

export type ClawThread = Thread & {
  clawKind?: "main" | "extra";
  clawAgentId?: string;
};
