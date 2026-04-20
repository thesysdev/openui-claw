import type { ReactNode } from "react";

const HEADER_STYLE = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "var(--sp-m)",
  marginBottom: "var(--sp-ml)",
};

const TITLE_STYLE = {
  fontFamily: "var(--font-heading)",
  fontSize: "var(--fs-md)",
  fontWeight: "var(--fw-bold)",
  color: "var(--color-text-primary)",
  letterSpacing: "var(--ls-tight)",
};

const COUNT_STYLE = {
  fontWeight: "var(--fw-regular)",
  color: "var(--color-text-tertiary)",
  marginLeft: 6,
};

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: ReactNode;
}

export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <div style={HEADER_STYLE}>
      <h2 style={TITLE_STYLE}>
        {title}
        {typeof count === "number" ? <span style={COUNT_STYLE}>({count})</span> : null}
      </h2>
      {action}
    </div>
  );
}

export default SectionHeader;
