"use client";

import { useEffect, useRef, useState } from "react";
import { saveSettings } from "@/lib/storage";
import type { Settings } from "@/lib/storage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@openuidev/react-ui";
import { AutomatedSetup } from "./AutomatedSetup";
import { PreferencesPanel } from "./PreferencesPanel";

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
      className="backdrop:bg-overlay bg-background text-text-neutral-primary rounded-xl shadow-xl p-ml w-full max-w-md outline-none"
      onClose={onClose}
    >
      <h2 className="text-lg font-semibold mb-3">Gateway Settings</h2>

      <Tabs defaultValue="automated">
        <TabsList className="mb-4">
          <TabsTrigger value="automated" text="Automated" />
          <TabsTrigger value="manual" text="Manual" />
          <TabsTrigger value="preferences" text="Preferences" />
        </TabsList>

        <TabsContent value="manual">
          <p className="text-sm text-text-neutral-tertiary mb-4">
            Connect Claw to your OpenClaw gateway. Run{" "}
            <code className="font-mono bg-foreground px-1 rounded">
              openclaw config show
            </code>{" "}
            in a terminal to see your gateway URL and token.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-neutral-secondary">
                Gateway URL
              </label>
              <input
                type="url"
                required
                placeholder="ws://localhost:18789"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-border-default"
              />
              <p className="text-sm text-text-neutral-tertiary">
                Use{" "}
                <code className="font-mono">ws://</code> for local,{" "}
                <code className="font-mono">wss://</code> for remote.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-neutral-secondary">
                Auth Token
              </label>
              <input
                type="password"
                placeholder="Paste your token here"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-border-default"
              />
              <p className="text-sm text-text-neutral-tertiary">
                Run{" "}
                <code className="font-mono bg-foreground px-1 rounded">
                  openclaw auth token
                </code>{" "}
                to get your token. Stored locally — only needed once per device.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-text-neutral-secondary hover:bg-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-inverted-background text-text-white hover:opacity-90 transition-colors"
              >
                Save & Connect
              </button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="automated">
          <AutomatedSetup />
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-text-neutral-secondary hover:bg-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesPanel />
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-text-neutral-secondary hover:bg-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </dialog>
  );
}
