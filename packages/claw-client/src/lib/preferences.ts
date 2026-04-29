/**
 * Per-device user preferences stored in localStorage.
 *
 * Kept separate from `storage.ts` (which holds gateway connection
 * settings) so feature toggles can evolve without touching the auth /
 * pairing schema. The `STORAGE_KEY` is versioned ("v1") so we can break
 * the shape later without silently coercing stale data.
 *
 * The `apply()` helper writes the prefs onto `<html>` as data-attributes
 * + CSS variables. Components that want to react to changes use
 * `subscribe()` (or the `usePreferences` React hook below); everything
 * else can just read `getPreferences()` once.
 */

import { useSyncExternalStore } from "react";

export type SendKey = "enter" | "mod-enter" | "auto";
export type FontSize = "sm" | "md" | "lg";
export type ThemeSkin = "default" | "ocean" | "sunset" | "forest" | "mono";

export interface Preferences {
  /** Which keypress submits the composer. `auto` = Enter on desktop, mod+Enter on touch. */
  sendKey: SendKey;
  /** Play a soft chime when the assistant finishes responding while the tab is hidden. */
  notificationSound: boolean;
  /** Document-wide font scale. */
  fontSize: FontSize;
  /** Display name for the assistant (greeting + topbar fallback). Empty = use defaults. */
  assistantName: string;
  /** Accent skin layered over the dark/light base theme. */
  themeSkin: ThemeSkin;
}

export const DEFAULT_PREFERENCES: Preferences = {
  sendKey: "auto",
  notificationSound: false,
  fontSize: "md",
  assistantName: "",
  themeSkin: "default",
};

const STORAGE_KEY = "claw-prefs-v1";

let cached: Preferences | null = null;
const listeners = new Set<() => void>();

function read(): Preferences {
  if (cached) return cached;
  if (typeof localStorage === "undefined") {
    cached = { ...DEFAULT_PREFERENCES };
    return cached;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = { ...DEFAULT_PREFERENCES };
      return cached;
    }
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    cached = { ...DEFAULT_PREFERENCES, ...parsed };
    return cached;
  } catch {
    cached = { ...DEFAULT_PREFERENCES };
    return cached;
  }
}

export function getPreferences(): Preferences {
  return read();
}

export function setPreferences(patch: Partial<Preferences>): Preferences {
  const next: Preferences = { ...read(), ...patch };
  cached = next;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full / private mode — ignore */
    }
  }
  apply(next);
  for (const fn of listeners) fn();
  return next;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Push prefs onto `<html>` so CSS can pick them up. Idempotent.
 */
export function apply(prefs: Preferences = read()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset["clawFontSize"] = prefs.fontSize;
  root.dataset["clawSkin"] = prefs.themeSkin;
  // Drop any data-attr a previous version of the app may have set so
  // stale CSS rules don't keep applying after the pref is removed.
  delete root.dataset["clawDensity"];
}

/**
 * React hook — re-renders on `setPreferences` calls anywhere in the app.
 */
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, () => DEFAULT_PREFERENCES);
}

/**
 * Detect a touch-primary device. Used by the `auto` send-key mode so
 * mobile/tablet users don't accidentally submit while typing.
 */
export function isTouchPrimary(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia) {
    return window.matchMedia("(pointer: coarse)").matches;
  }
  return "ontouchstart" in window;
}

/**
 * Resolves `auto` against the runtime so consumers don't need to know
 * about touch detection. Returns the concrete key required to submit.
 */
export function effectiveSendKey(prefs: Preferences = read()): "enter" | "mod-enter" {
  if (prefs.sendKey === "enter") return "enter";
  if (prefs.sendKey === "mod-enter") return "mod-enter";
  return isTouchPrimary() ? "mod-enter" : "enter";
}
