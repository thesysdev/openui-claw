"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` once on mount in production builds. Skipped in dev so
 * Next's HMR isn't fighting cached assets (and so a forgotten registration
 * doesn't follow you across `pnpm dev` restarts).
 *
 * The SW itself is intentionally minimal — see public/sw.js. We don't try
 * to take over Next's hashed bundles; this is just an "add to home screen
 * works on iOS" + "loads offline shell" guarantee.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const handle = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[claw] sw register failed:", err);
      });
    }, 1500);
    return () => window.clearTimeout(handle);
  }, []);
  return null;
}
