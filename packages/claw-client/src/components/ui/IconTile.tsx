import type { CSSProperties, ReactNode } from "react";

type Category = "agent" | "app" | "artifact" | "activity" | "task" | "context";
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, number> = { sm: 24, md: 30, lg: 40 };
const ICON_SIZES: Record<Size, number> = { sm: 12, md: 14, lg: 18 };
const RADII: Record<Size, string> = {
  sm: "var(--r-m)",
  md: "var(--r-m)",
  lg: "var(--r-l)",
};

function categoryBg(category: Category | undefined): string {
  if (!category) return "var(--color-sunk-light)";
  return `color-mix(in srgb, var(--cat-${category}) 14%, transparent)`;
}

function categoryColor(category: Category | undefined): string {
  if (!category) return "var(--color-text-primary)";
  return `var(--cat-${category})`;
}

interface IconTileProps {
  size?: Size;
  category?: Category;
  letter?: string;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function IconTile({
  size = "sm",
  category,
  letter,
  icon,
  className,
  style,
}: IconTileProps) {
  const px = SIZES[size];
  const merged: CSSProperties = {
    width: px,
    height: px,
    borderRadius: RADII[size],
    backgroundColor: categoryBg(category),
    color: categoryColor(category),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-label)",
    fontSize: ICON_SIZES[size],
    fontWeight: "var(--fw-bold)" as unknown as number,
    flexShrink: 0,
    border: category ? "none" : "1px solid var(--color-border)",
    ...style,
  };
  return (
    <span className={className} style={merged}>
      {icon ?? (letter ? letter.charAt(0).toUpperCase() : null)}
    </span>
  );
}

export default IconTile;
