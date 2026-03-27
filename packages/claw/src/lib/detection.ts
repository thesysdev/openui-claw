/**
 * Phase 1 stub: always returns "markdown".
 * Phase 3: will detect OpenUI Lang via /^root\s*=\s*\w+\(/ on first non-empty line.
 */
export function detectFormat(_text: string): "openui" | "markdown" {
  return "markdown";
}
