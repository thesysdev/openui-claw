export type Palette = "bloom" | "neo";
export type Mode = "light" | "dark";

export interface UserPrefs {
  palette: Palette;
  mode: Mode;
  name?: string;
}

const STORAGE_KEY = "claw-prefs-v1";

const DEFAULTS: UserPrefs = { palette: "bloom", mode: "light" };

export function getUserPrefs(): UserPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return {
      palette: parsed.palette === "neo" ? "neo" : "bloom",
      mode: parsed.mode === "dark" ? "dark" : "light",
      name: typeof parsed.name === "string" ? parsed.name : undefined,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveUserPrefs(prefs: UserPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
