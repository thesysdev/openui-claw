"use client";

import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { IconButton } from "@/components/layout/sidebar/IconButton";
import { ConnectionState } from "@/lib/gateway/types";
import { saveSettings } from "@/lib/storage";
import type { Settings } from "@/lib/storage";

import { AutomatedSetup } from "./AutomatedSetup";
import { PreferencesPanel } from "./PreferencesPanel";

interface Props {
  open: boolean;
  currentSettings: Settings | null;
  connectionState?: ConnectionState;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

const STATUS_BANNER: Record<
  ConnectionState,
  {
    label: string;
    description: string;
    /** Color applied to the title + icon — paired with neutral surface. */
    accent: string;
    /** Tile background tint matching the accent. */
    tile: string;
    icon: typeof CheckCircle2;
    spin?: boolean;
  }
> = {
  [ConnectionState.CONNECTED]: {
    label: "Connected",
    description: "The gateway is reachable and ready.",
    accent: "text-text-success-primary",
    tile: "bg-success-background border-border-success/50",
    icon: CheckCircle2,
  },
  [ConnectionState.CONNECTING]: {
    label: "Connecting…",
    description: "Reaching the gateway — hold on.",
    accent: "text-text-alert-primary",
    tile: "bg-alert-background border-border-alert/50",
    icon: Loader2,
    spin: true,
  },
  [ConnectionState.PAIRING]: {
    label: "Pairing…",
    description: "Waiting for the gateway handshake.",
    accent: "text-text-alert-primary",
    tile: "bg-alert-background border-border-alert/50",
    icon: Loader2,
    spin: true,
  },
  [ConnectionState.DISCONNECTED]: {
    label: "Disconnected",
    description: "Add a gateway URL below or run the setup command.",
    accent: "text-text-neutral-tertiary",
    tile: "bg-sunk-light border-border-default/50 dark:bg-elevated",
    icon: XCircle,
  },
  [ConnectionState.AUTH_FAILED]: {
    label: "Auth failed",
    description: "The token was rejected. Re-run `openclaw auth token`.",
    accent: "text-text-danger-primary",
    tile: "bg-danger-background border-border-danger/50",
    icon: XCircle,
  },
};

type Tab = "automated" | "manual" | "preferences";


export function SettingsDialog({
  open,
  currentSettings,
  connectionState,
  onClose,
  onSave,
}: Props) {
  const [gatewayUrl, setGatewayUrl] = useState(currentSettings?.gatewayUrl ?? "");
  const [token, setToken] = useState(currentSettings?.token ?? "");
  const [tab, setTab] = useState<Tab>("automated");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setGatewayUrl(currentSettings?.gatewayUrl ?? "");
    setToken(currentSettings?.token ?? "");
  }, [currentSettings]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
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
      className="w-full max-w-md rounded-2xl border border-border-default/50 bg-background p-ml text-text-neutral-primary shadow-2xl outline-none backdrop:bg-overlay dark:border-border-default/16 dark:bg-foreground"
      onClose={onClose}
    >
      <div className="flex flex-col">
        <div className="mb-m flex items-center justify-between">
          <h2 className="font-heading text-md font-bold text-text-neutral-primary">
            Gateway Settings
          </h2>
          <IconButton
            icon={X}
            variant="tertiary"
            size="md"
            title="Close"
            aria-label="Close"
            onClick={onClose}
          />
        </div>

        {connectionState ? (() => {
          const banner = STATUS_BANNER[connectionState];
          const Icon = banner.icon;
          return (
            <div className="mb-ml flex items-stretch gap-s rounded-lg border border-border-default/50 bg-background p-s dark:border-border-default/16 dark:bg-foreground">
              <div
                className={`flex shrink-0 items-center justify-center self-stretch rounded-md border px-s ${banner.tile}`}
              >
                <Icon
                  size={16}
                  className={`${banner.accent} ${banner.spin ? "animate-spin" : ""}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-label text-sm font-medium leading-tight ${banner.accent}`}>
                  {banner.label}
                </p>
                <p className="mt-3xs font-body text-sm leading-snug text-text-neutral-tertiary">
                  {banner.description}
                </p>
              </div>
            </div>
          );
        })() : null}

        <div className="mb-ml">
          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "automated", label: "Automated" },
              { value: "manual", label: "Manual" },
              { value: "preferences", label: "Preferences" },
            ]}
            ariaLabel="Settings section"
          />
        </div>

        <div className="min-h-0">
          {tab === "automated" ? <AutomatedSetup /> : null}

          {tab === "manual" ? (
            <>
              <p className="mb-ml font-body text-sm text-text-neutral-tertiary">
                Connect Claw to your OpenClaw gateway. Run{" "}
                <code className="rounded bg-sunk-light px-3xs font-mono text-sm dark:bg-elevated">
                  openclaw config show
                </code>{" "}
                in a terminal to see your gateway URL and token.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-ml">
                <div className="flex flex-col gap-2xs">
                  <label className="font-label text-sm font-medium text-text-neutral-secondary">
                    Gateway URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="ws://localhost:18789"
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                    className="rounded-lg border border-border-default bg-background px-s py-xs font-body text-sm text-text-neutral-primary outline-none focus:border-border-interactive-emphasis dark:border-border-default/16 dark:bg-foreground"
                  />
                  <p className="font-body text-sm text-text-neutral-tertiary">
                    Use <code className="font-mono">ws://</code> for local,{" "}
                    <code className="font-mono">wss://</code> for remote.
                  </p>
                </div>

                <div className="flex flex-col gap-2xs">
                  <label className="font-label text-sm font-medium text-text-neutral-secondary">
                    Auth Token
                  </label>
                  <input
                    type="password"
                    placeholder="Paste your token here"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="rounded-lg border border-border-default bg-background px-s py-xs font-body text-sm text-text-neutral-primary outline-none focus:border-border-interactive-emphasis dark:border-border-default/16 dark:bg-foreground"
                  />
                  <p className="font-body text-sm text-text-neutral-tertiary">
                    Run{" "}
                    <code className="rounded bg-sunk-light px-3xs font-mono text-sm dark:bg-elevated">
                      openclaw auth token
                    </code>{" "}
                    to get your token. Stored locally — only needed once per device.
                  </p>
                </div>

                <div className="mt-xs flex justify-end gap-xs">
                  <Button variant="secondary" size="md" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="md" type="submit">
                    Save &amp; Connect
                  </Button>
                </div>
              </form>
            </>
          ) : null}

          {tab === "preferences" ? <PreferencesPanel /> : null}
        </div>
      </div>
    </dialog>
  );
}
