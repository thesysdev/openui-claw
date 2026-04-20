"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const ROW_BASE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-s)",
  padding: "var(--sp-xs) var(--sp-xs) var(--sp-xs) var(--sp-xs)",
  borderRadius: "var(--r-m)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
  transition: `background-color 0.15s, box-shadow 0.15s, padding 0.25s ${EASE}`,
  fontFamily: "var(--font-body)",
  fontSize: "var(--fs-sm)",
  color: "var(--color-text-secondary)",
  textDecoration: "none",
  marginBottom: "1px",
};

const LABEL_STYLE: CSSProperties = {
  flex: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  transition: `opacity 0.25s ${EASE}, max-width 0.25s ${EASE}`,
};

function rowStyle(active: boolean, hover: boolean): CSSProperties {
  return {
    ...ROW_BASE_STYLE,
    backgroundColor: active
      ? "var(--color-bg)"
      : hover
        ? "var(--color-sunk-light)"
        : "transparent",
    color: active || hover
      ? "var(--color-text-primary)"
      : "var(--color-text-secondary)",
    fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
    boxShadow: active ? "var(--shadow-md)" : "none",
  };
}

interface SidebarNavRowProps {
  icon: ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  right?: ReactNode;
  title?: string;
}

export function SidebarNavRow({
  icon,
  label,
  href,
  active = false,
  collapsed = false,
  onClick,
  right,
  title,
}: SidebarNavRowProps) {
  const [hover, setHover] = useState(false);
  const merged = {
    ...rowStyle(active, hover),
    justifyContent: collapsed ? "center" : "flex-start",
  };
  const labelStyle: CSSProperties = collapsed
    ? { ...LABEL_STYLE, opacity: 0, maxWidth: 0 }
    : LABEL_STYLE;
  const content = (
    <>
      {icon}
      <span style={labelStyle}>{label}</span>
      {!collapsed && right}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={merged}
        title={title ?? (collapsed ? label : undefined)}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={merged}
      title={title ?? (collapsed ? label : undefined)}
    >
      {content}
    </button>
  );
}

export default SidebarNavRow;
