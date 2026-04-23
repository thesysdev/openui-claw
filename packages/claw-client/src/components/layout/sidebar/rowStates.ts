/**
 * Shared state classes for sidebar rows (NavTab, SectionTab, AgentTab).
 *
 * Rules:
 *   - All rows use the same rounded-m corner radius.
 *   - Padding: left = top = bottom. Use `p-xs` for uniform 6px on all sides
 *     so the leading icon tile has equal breathing room on three sides.
 *   - Hover  → background (white) fill, no stroke.
 *   - Active → background (white) + border + shadow.
 *   - Expanded uses the same style as active.
 */

export type RowState = "rest" | "hover" | "active" | "expanded";

/** Base layout classes shared by every sidebar row. */
export const ROW_BASE =
  "flex w-full items-center rounded-lg p-xs transition-[background-color,border-color,box-shadow] duration-150";

/** Background + border + shadow classes for a given state. */
export function rowStateClass(state: RowState): string {
  switch (state) {
    case "active":
    case "expanded":
      return "bg-background dark:bg-foreground border border-border-default/40 dark:border-border-default/20 shadow-sm";
    case "hover":
      return "bg-background dark:bg-foreground border border-transparent";
    default:
      return "bg-transparent border border-transparent";
  }
}

/** Text color for a row label given its state. */
export function rowLabelClass(state: RowState, accentOnActive = false): string {
  if (state === "active" || state === "expanded") {
    return accentOnActive
      ? "text-text-accent-primary"
      : "text-text-neutral-primary";
  }
  if (state === "hover") return "text-text-neutral-primary";
  return "text-text-neutral-secondary";
}

/** `true` when the row should render with a medium font weight (active only). */
export function rowIsBold(state: RowState): boolean {
  return state === "active" || state === "expanded";
}
