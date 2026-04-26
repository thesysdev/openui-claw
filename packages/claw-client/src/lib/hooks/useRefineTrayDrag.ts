"use client";

import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

const MIN_WIDTH = 280;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 420;

export interface RefineTrayDrag {
  threadId: string | null;
  width: number;
  openFor: (threadId: string) => void;
  close: () => void;
  onDragStart: (e: ReactMouseEvent) => void;
}

/**
 * State + resize-drag logic for the refine tray. Returns the currently open
 * thread id (null when closed), the live width in pixels, and imperative
 * handlers to open/close/drag.
 */
export function useRefineTrayDrag(initialWidth = DEFAULT_WIDTH): RefineTrayDrag {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [width, setWidth] = useState(initialWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onDragStart = useCallback((e: ReactMouseEvent) => {
    dragRef.current = { startX: e.clientX, startWidth: width };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.startX;
      setWidth(
        Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startWidth + delta)),
      );
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [width]);

  const openFor = useCallback((id: string) => setThreadId(id), []);
  const close = useCallback(() => setThreadId(null), []);

  return { threadId, width, openFor, close, onDragStart };
}
