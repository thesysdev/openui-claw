"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * Animated height 0 ↔ auto. Uses ResizeObserver to track content height so it
 * keeps animating smoothly when children resize.
 */
export function ExpandCollapse({
  open,
  duration = 0.3,
  children,
}: {
  open: boolean;
  duration?: number;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      const sh = el.scrollHeight;
      setHeight((prev) => (prev === sh ? prev : sh));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      style={{
        overflow: "hidden",
        height: open ? `${height}px` : "0px",
        opacity: open ? 1 : 0,
        transition: open
          ? `height ${duration}s ${ease}, opacity ${duration * 0.6}s ease ${duration * 0.1}s`
          : `height ${duration * 0.8}s ${ease}, opacity ${duration * 0.4}s ease`,
      }}
    >
      {/* 2px horizontal padding so child shadows don't clip at the
          overflow:hidden left/right edges. Vertical padding is intentionally
          omitted so the space above/below a Separator stays symmetric. */}
      <div ref={contentRef} className="px-3xs">
        {children}
      </div>
    </div>
  );
}
