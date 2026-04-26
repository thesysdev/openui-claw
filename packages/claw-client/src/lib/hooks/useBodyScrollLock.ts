"use client";

import { useEffect } from "react";

/**
 * Locks `<body>` scroll while `active` is true. Restores the previous overflow
 * value on unmount or when `active` flips false. Counts active locks so nested
 * sheets do not unlock the body prematurely.
 */
let lockCount = 0;
let savedOverflow: string | null = null;

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow ?? "";
        savedOverflow = null;
      }
    };
  }, [active]);
}
