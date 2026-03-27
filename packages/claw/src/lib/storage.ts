export interface Settings {
  gatewayUrl: string;
  token?: string;
  deviceToken?: string;
}

const STORAGE_KEY = "claw-settings-v1";

export function getSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Settings;
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function saveDeviceToken(token: string): void {
  const settings = getSettings();
  if (settings) saveSettings({ ...settings, deviceToken: token });
}

export function clearDeviceToken(): void {
  const settings = getSettings();
  if (settings) {
    const { deviceToken: _, ...rest } = settings;
    saveSettings(rest as Settings);
  }
}

export function clearAuthCredentials(): void {
  const settings = getSettings();
  if (settings) {
    const { deviceToken: _dt, token: _t, ...rest } = settings;
    saveSettings(rest as Settings);
  }
}
