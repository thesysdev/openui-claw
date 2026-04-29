/**
 * Single source of truth for the reasoning-effort levels exposed in the UI.
 *
 * Two surfaces consume this — `SessionComposer` (popover dropdown) and
 * `SessionControls` (inline select). Previously each carried its own copy and
 * they drifted: `SessionControls.tsx` shipped only `low/medium/high` for a
 * stretch while `SessionComposer.tsx` had the full 7. Importing from one
 * module keeps them aligned.
 */

export type ThinkingLevel = "" | "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface ThinkingLevelOption {
  value: ThinkingLevel;
  label: string;
}

export const THINKING_LEVELS: readonly ThinkingLevelOption[] = [
  { value: "", label: "Default" },
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
] as const;
