"use client";

import { useEffect, useRef, useState } from "react";
import { saveSettings } from "@/lib/storage";
import type { Settings } from "@/lib/storage";

interface Props {
  open: boolean;
  currentSettings: Settings | null;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

export function SettingsDialog({ open, currentSettings, onClose, onSave }: Props) {
  const [gatewayUrl, setGatewayUrl] = useState(currentSettings?.gatewayUrl ?? "");
  const [token, setToken] = useState(currentSettings?.token ?? "");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setGatewayUrl(currentSettings?.gatewayUrl ?? "");
    setToken(currentSettings?.token ?? "");
  }, [currentSettings]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal(); else el.close();
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = gatewayUrl.trim();
    if (!trimmedUrl) return;
    const newSettings: Settings = {
      gatewayUrl: trimmedUrl,
      token: token.trim() || undefined,
      // preserve deviceToken only if URL unchanged
      deviceToken:
        trimmedUrl === currentSettings?.gatewayUrl
          ? currentSettings?.deviceToken
          : undefined,
    };
    saveSettings(newSettings);
    onSave(newSettings);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/50 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-xl shadow-2xl p-6 w-full max-w-md outline-none"
      onClose={onClose}
    >
      <h2 className="text-lg font-semibold mb-1">Gateway Settings</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
        Connect Claw to your OpenClaw gateway. Run{" "}
        <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
          openclaw config show
        </code>{" "}
        in a terminal to see your gateway URL and token.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Gateway URL
          </label>
          <input
            type="url"
            required
            placeholder="ws://localhost:18789"
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Use{" "}
            <code className="font-mono">ws://</code> for local,{" "}
            <code className="font-mono">wss://</code> for remote.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Auth Token
          </label>
          <input
            type="password"
            placeholder="Paste your token here"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          />
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Run{" "}
            <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
              openclaw auth token
            </code>{" "}
            to get your token. Stored locally — only needed once per device.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            Save & Connect
          </button>
        </div>
      </form>
    </dialog>
  );
}
