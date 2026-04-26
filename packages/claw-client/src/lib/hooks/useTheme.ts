"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
const THEME_KEY = "claw:theme";

function readPref(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark") return v;
  return "light";
}

function apply(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  if (mode === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}

/**
 * Reactive theme state + a setter that persists to localStorage and updates
 * the document root class. Re-syncs across components by listening to the
 * `storage` event (so toggling in one place reflects everywhere on the page).
 */
export function useTheme(): {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
} {
  const [theme, setLocal] = useState<ThemeMode>(() => readPref());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      setLocal(readPref());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setLocal(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, mode);
      window.dispatchEvent(
        new StorageEvent("storage", { key: THEME_KEY, newValue: mode }),
      );
    }
    apply(mode);
  }, []);

  return { theme, setTheme };
}

/** Re-applies the saved theme on first load. */
export function bootstrapThemeFromStorage(): void {
  apply(readPref());
}
