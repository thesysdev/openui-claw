"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

interface ExpandCollapseProps {
  open: boolean;
  duration?: number;
  children: ReactNode;
}

export function ExpandCollapse({
  open,
  duration = 0.3,
  children,
}: ExpandCollapseProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(open ? "none" : "0px");

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (open) {
      const h = el.scrollHeight;
      setMaxHeight(`${h}px`);
      const t = setTimeout(() => setMaxHeight("none"), duration * 1000);
      return () => clearTimeout(t);
    }
    const h = el.scrollHeight;
    setMaxHeight(`${h}px`);
    requestAnimationFrame(() => setMaxHeight("0px"));
  }, [open, duration]);

  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight,
        transition: `max-height ${duration}s ${EASE}`,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

export default ExpandCollapse;
