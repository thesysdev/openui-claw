"use client";

export type SeparatorVariant = "full" | "inset";

export interface SeparatorProps {
  /**
   * `"full"` (default) spans edge-to-edge of its parent.
   * `"inset"` keeps the original 8px horizontal inset for cases where the
   * separator needs to align with row content rather than the panel edge.
   */
  variant?: SeparatorVariant;
}

/**
 * Horizontal 1px rule used to separate sidebar sections.
 *
 * The default renders end-to-end (full width of the parent). Use the
 * `inset` variant when you need the rule to sit inside the rail's padding.
 */
export function Separator({ variant = "full" }: SeparatorProps = {}) {
  const margin = variant === "inset" ? "mx-s my-s" : "my-s";
  return <div className={`${margin} h-px w-full bg-border-default/50 dark:bg-border-default/16`} />;
}

/** Backwards-compatible alias so older imports keep working. */
export const SectionSeparator = Separator;
