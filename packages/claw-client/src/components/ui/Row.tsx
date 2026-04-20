"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

const ROW_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-m)",
  padding: "var(--sp-s) var(--sp-s)",
  borderRadius: "var(--r-l)",
  border: "1px solid transparent",
  background: "transparent",
  textAlign: "left" as const,
  cursor: "pointer",
  transition: "background-color 0.15s ease",
  width: "100%",
};

const ROW_HOVER_BG = "var(--color-sunk-light)";

interface RowProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onClick?: () => void;
  showChevronOnHover?: boolean;
}

export function Row({
  icon,
  title,
  subtitle,
  right,
  onClick,
  showChevronOnHover = true,
}: RowProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...ROW_STYLE,
        backgroundColor: hover ? ROW_HOVER_BG : "transparent",
      }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-medium)",
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--fs-xs)",
              color: "var(--color-text-tertiary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {right}
      {showChevronOnHover && (
        <ChevronRight
          size={14}
          color="var(--color-text-tertiary)"
          style={{
            opacity: hover ? 1 : 0,
            transform: hover ? "translateX(0)" : "translateX(-4px)",
            transition: "opacity 0.15s ease, transform 0.15s ease",
            flexShrink: 0,
          }}
        />
      )}
    </button>
  );
}

export default Row;
