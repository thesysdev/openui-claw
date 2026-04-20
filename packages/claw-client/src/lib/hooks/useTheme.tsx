"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getUserPrefs,
  saveUserPrefs,
  type Mode,
  type Palette,
  type UserPrefs,
} from "@/lib/user-prefs";

interface ThemeContextValue {
  palette: Palette;
  mode: Mode;
  name: string | undefined;
  setPalette: (palette: Palette) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  setName: (name: string | undefined) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyPrefsToDocument(palette: Palette, mode: Mode): void {
  const root = document.documentElement;
  root.dataset.palette = palette;
  root.classList.toggle("dark", mode === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UserPrefs>(() => ({ palette: "bloom", mode: "light" }));
  const hydrated = useRef(false);

  useEffect(() => {
    const loaded = getUserPrefs();
    setPrefs(loaded);
    applyPrefsToDocument(loaded.palette, loaded.mode);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    applyPrefsToDocument(prefs.palette, prefs.mode);
    saveUserPrefs(prefs);
  }, [prefs]);

  const setPalette = useCallback(
    (palette: Palette) => setPrefs((prev) => ({ ...prev, palette })),
    [],
  );
  const setMode = useCallback(
    (mode: Mode) => setPrefs((prev) => ({ ...prev, mode })),
    [],
  );
  const toggleMode = useCallback(
    () => setPrefs((prev) => ({ ...prev, mode: prev.mode === "dark" ? "light" : "dark" })),
    [],
  );
  const setName = useCallback(
    (name: string | undefined) => setPrefs((prev) => ({ ...prev, name })),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      palette: prefs.palette,
      mode: prefs.mode,
      name: prefs.name,
      setPalette,
      setMode,
      toggleMode,
      setName,
    }),
    [prefs, setPalette, setMode, toggleMode, setName],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
