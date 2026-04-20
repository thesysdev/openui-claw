import type { CSSProperties, ReactNode } from "react";

const BASE_CARD_STYLE: CSSProperties = {
  padding: "var(--sp-xl)",
  borderRadius: "var(--r-2xl)",
  backgroundColor: "var(--color-elevated)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-xl)",
};

const INTERACTIVE_HOVER_STYLE: CSSProperties = {
  cursor: "pointer",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

interface CardProps {
  as?: "div" | "button" | "section" | "article";
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
}

export function Card({
  as = "div",
  interactive = false,
  className,
  style,
  onClick,
  children,
}: CardProps) {
  const Tag = as as "div";
  const merged: CSSProperties = {
    ...BASE_CARD_STYLE,
    ...(interactive ? INTERACTIVE_HOVER_STYLE : null),
    ...style,
  };
  return (
    <Tag className={className} style={merged} onClick={onClick}>
      {children}
    </Tag>
  );
}

export default Card;
