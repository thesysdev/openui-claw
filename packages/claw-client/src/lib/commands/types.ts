import type { AppStore, ArtifactStore, UploadStore } from "@/lib/engines/types";

export type CommandArgPrompt = {
  kind: "text";
  placeholder?: string;
};

export type CommandContext = {
  threadId: string | null;
  threadTitle?: string;
  messages: CommandMessageSnapshot[];
  apps?: AppStore;
  artifacts?: ArtifactStore;
  uploads?: UploadStore;
  /** Shows a transient toast to the user. */
  toast: (message: string, kind?: "info" | "success" | "error") => void;
  /** Persists a blob as a download in the browser. */
  downloadBlob: (filename: string, mimeType: string, content: string | Blob) => void;
};

export type CommandMessageSnapshot = {
  id: string;
  role: "user" | "assistant" | "activity";
  /** Raw content string — for assistant messages this is the visible prose only. */
  content: string;
  /** ISO timestamp when known. */
  timestamp?: string;
};

export type CommandResult = void | {
  /** Non-empty text replacement for the composer after command execution. */
  replaceInput?: string;
};

export type Command = {
  /** Without leading slash, lowercase. */
  name: string;
  aliases?: string[];
  description: string;
  argHint?: string;
  run: (args: string, context: CommandContext) => Promise<CommandResult> | CommandResult;
};
