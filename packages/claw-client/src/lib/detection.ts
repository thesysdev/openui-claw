/**
 * Parse an assistant response into ordered segments of text and openui-lang code.
 *
 * With inline mode, the LLM can respond with:
 * - Pure text (no code)
 * - Pure openui-lang (no fences, legacy format where first line is `root = ...`)
 * - Mixed: text + fenced ```openui-lang blocks + more text
 * - Partially streamed: unclosed fences
 *
 * This parser handles all cases and returns segments in order.
 */

export type Segment = { type: "text"; content: string } | { type: "openui"; content: string };

export interface ParsedResponse {
  segments: Segment[];
  hasCode: boolean;
}

const FENCE_REGEX = /```openui-lang\n([\s\S]*?)```/g;
const UNCLOSED_FENCE_REGEX = /```openui-lang\n([\s\S]*)$/;
const STMT_PATTERN = /^[a-zA-Z_$][\w$]*\s*=/;

/**
 * Check if raw text looks like pure openui-lang (no fences, just statements).
 * Used for backward compatibility with old prompt that didn't use fences.
 */
function isPureCode(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /```/.test(trimmed)) return false;
  const lines = trimmed.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return false;
  const stmtCount = lines.filter((l) => STMT_PATTERN.test(l.trim())).length;
  return stmtCount / lines.length > 0.7;
}

/**
 * Parse a response into ordered segments.
 */
export function parseInlineResponse(raw: string): ParsedResponse {
  if (!raw.trim()) return { segments: [], hasCode: false };

  // Legacy: pure openui-lang without fences (e.g. `root = Card(...)` as first line).
  if (isPureCode(raw)) {
    return { segments: [{ type: "openui", content: raw.trim() }], hasCode: true };
  }

  // Check for fenced code blocks.
  const hasFences = /```openui-lang\n/.test(raw);
  if (!hasFences) {
    // Pure text — no code at all.
    return { segments: [{ type: "text", content: raw }], hasCode: false };
  }

  // Split into text and code segments, preserving order.
  const segments: Segment[] = [];
  let lastIndex = 0;
  let hasCode = false;

  // Process complete fences.
  const fenceRegex = new RegExp(FENCE_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(raw)) !== null) {
    // Text before this fence.
    const textBefore = raw.slice(lastIndex, match.index).trim();
    if (textBefore) {
      segments.push({ type: "text", content: textBefore });
    }
    // The code block.
    const code = match[1]?.trim() ?? "";
    if (code) {
      segments.push({ type: "openui", content: code });
      hasCode = true;
    }
    lastIndex = match.index + match[0].length;
  }

  // Check for unclosed fence (streaming in progress).
  const remainder = raw.slice(lastIndex);
  const unclosedMatch = remainder.match(UNCLOSED_FENCE_REGEX);
  if (unclosedMatch) {
    const textBefore = remainder.slice(0, unclosedMatch.index).trim();
    if (textBefore) {
      segments.push({ type: "text", content: textBefore });
    }
    const code = unclosedMatch[1]?.trim() ?? "";
    if (code) {
      segments.push({ type: "openui", content: code });
      hasCode = true;
    }
  } else {
    // Text after the last fence.
    const textAfter = remainder.trim();
    if (textAfter) {
      segments.push({ type: "text", content: textAfter });
    }
  }

  return { segments, hasCode };
}

/**
 * Extract only the openui-lang code from a response (for persistence).
 * Joins all code segments. Returns null if no code found.
 */
export function extractCodeOnly(raw: string): string | null {
  const { segments, hasCode } = parseInlineResponse(raw);
  if (!hasCode) return null;
  return segments
    .filter((s): s is Extract<Segment, { type: "openui" }> => s.type === "openui")
    .map((s) => s.content)
    .join("\n");
}
