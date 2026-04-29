import { CLAW_SUFFIX, extractExtraSlotId, isMainSession } from "@/lib/session-keys";

const OPAQUE_UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const SHORT_OPAQUE_SEGMENT_REGEX = /^[0-9a-f]{8,}$/i;

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function humanizeSessionKey(value: string): string {
  const trimmed = value.trim();
  const slot = extractExtraSlotId(trimmed);
  if (slot) {
    return `Conversation ${slot.slice(0, 8)}`;
  }

  if (isMainSession(trimmed)) {
    return "Main conversation";
  }

  if (OPAQUE_UUID_REGEX.test(trimmed)) {
    const match = trimmed.match(OPAQUE_UUID_REGEX);
    return `Conversation ${match?.[0].slice(0, 8) ?? "session"}`;
  }

  const lastSegment = trimmed.split(":").filter(Boolean).at(-1) ?? trimmed;
  if (SHORT_OPAQUE_SEGMENT_REGEX.test(lastSegment)) {
    return `Conversation ${lastSegment.slice(0, 8)}`;
  }

  return "Conversation";
}

export function isOpaqueSessionTitle(
  title: string | null | undefined,
  fallbackId?: string | null,
): boolean {
  const trimmed = title?.trim();
  if (!trimmed) return true;

  if (fallbackId && trimmed === fallbackId.trim()) {
    return true;
  }

  if (
    trimmed.startsWith("agent:") ||
    trimmed.endsWith(CLAW_SUFFIX) ||
    OPAQUE_UUID_REGEX.test(trimmed)
  ) {
    return true;
  }

  if (
    trimmed.startsWith("Conversation ") &&
    SHORT_OPAQUE_SEGMENT_REGEX.test(trimmed.replace(/^Conversation\s+/i, ""))
  ) {
    return true;
  }

  return false;
}

export function resolveSessionTitle(params: {
  label?: string | null;
  displayName?: string | null;
  derivedTitle?: string | null;
  fallbackId: string;
}): string {
  const explicitTitle = firstNonEmpty(params.label, params.displayName, params.derivedTitle);

  if (explicitTitle && !isOpaqueSessionTitle(explicitTitle, params.fallbackId)) {
    return explicitTitle;
  }

  return humanizeSessionKey(params.fallbackId);
}

export function deriveTitleFromText(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const withoutTrailingPunctuation = normalized.replace(/[.?!]+$/, "");
  const capped =
    withoutTrailingPunctuation.length > 72
      ? `${withoutTrailingPunctuation.slice(0, 69).trimEnd()}...`
      : withoutTrailingPunctuation;

  return capped.length > 0 ? capped : null;
}
