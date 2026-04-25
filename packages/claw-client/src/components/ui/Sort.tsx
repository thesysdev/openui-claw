"use client";

import { SortButton, type SortValue } from "@/components/ui/SortButton";
import { SortPills } from "@/components/ui/SortPills";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface Props {
  value: SortValue;
  onChange: (next: SortValue) => void;
}

/**
 * Unified sort control. Desktop renders the original `SortPills` segmented
 * control; mobile renders a compact text trigger that opens a bottom-sheet
 * tray (`SortButton`). Lets list pages use one tag without per-page
 * `useIsMobile` plumbing.
 */
export function Sort({ value, onChange }: Props) {
  const isMobile = useIsMobile();
  if (isMobile) return <SortButton value={value} onChange={onChange} />;
  return (
    <SortPills
      value={value}
      options={[
        { key: "recent", label: "Recent" },
        { key: "a-z", label: "A–Z" },
      ]}
      onChange={(v) => onChange(v as SortValue)}
    />
  );
}
