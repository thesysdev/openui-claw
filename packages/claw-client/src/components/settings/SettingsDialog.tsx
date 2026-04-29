"use client";

import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/layout/sidebar/IconButton";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { ConnectionState } from "@/lib/gateway/types";
import { validateGatewayUrl } from "@/lib/gateway/url";
import type { Settings } from "@/lib/storage";

import { AutomatedSetup } from "./AutomatedSetup";
import { PreferencesPanel } from "./PreferencesPanel";

interface Props {
  open: boolean;
  currentSettings: Settings | null;
  connectionState: ConnectionState;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

const STATUS_BANNER: Record<
  ConnectionState,
  {
    label: string;
    description: string;
    /** Color applied to the icon — paired with neutral title + neutral surface. */
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
    accent: "text-text-danger-primary",
    tile: "bg-danger-background border-border-danger/50",
    icon: XCircle,
  },
  [ConnectionState.AUTH_FAILED]: {
    label: "Auth failed",
    description: "The token was rejected. Re-run `openclaw auth token`.",
    accent: "text-text-danger-primary",
    tile: "bg-danger-background border-border-danger/50",
    icon: XCircle,
  },
  [ConnectionState.UNREACHABLE]: {
    label: "Unreachable",
    description: "Couldn't reach the gateway. Check the URL and try again.",
    accent: "text-text-danger-primary",
    tile: "bg-danger-background border-border-danger/50",
    icon: XCircle,
  },
};

type Tab = "automated" | "manual" | "preferences";

export function SettingsDialog({ open, currentSettings, connectionState, onClose, onSave }: Props) {
  const [gatewayUrl, setGatewayUrl] = useState(currentSettings?.gatewayUrl ?? "");
  const [token, setToken] = useState(currentSettings?.token ?? "");
  const [tab, setTab] = useState<Tab>("automated");
  // `pending` = user clicked Save & Connect and we're awaiting the engine's
  // resolution. We hold the dialog open and watch `connectionState` to decide
  // whether to close (CONNECTED) or surface an inline error (UNREACHABLE /
  // AUTH_FAILED). Without this gate, save would close the dialog before the
  // user could see whether their URL/token actually worked.
  const [pending, setPending] = useState(false);
  // Two races to defeat:
  //   1. User clicks Save while state=CONNECTED. The engine's reconnect is
  //      async (setTimeout(0)), so the very next render still shows CONNECTED.
  //      A naive resolver fires onClose() immediately, before the new attempt
  //      even started.
  //   2. The engine emits CONNECTING and then UNREACHABLE in the same tick
  //      (e.g. `new WebSocket()` throws synchronously on a malformed URL like
  //      `ws://host/#frag`). React batches both updates; the dialog only sees
  //      the final UNREACHABLE. A "must see CONNECTING first" gate gets stuck
  //      because the CONNECTING render never arrived.
  // Solution: snapshot the connectionState that was current when the user
  // clicked Save. Resolve only when the live state differs from that snapshot
  // AND is terminal. This handles both races without depending on observing
  // any specific intermediate state.
  const submitSnapshotRef = useRef<ConnectionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync local state from props only when dialog opens — never mid-typing.
  useEffect(() => {
    if (!open) return;
    setGatewayUrl(currentSettings?.gatewayUrl ?? "");
    setToken(currentSettings?.token ?? "");
    setPending(false);
    submitSnapshotRef.current = null;
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // intentionally not depending on currentSettings — see comment above

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);

  // Resolve a pending save when the connection state moves off the snapshot
  // captured at submit time and lands on a terminal state.
  useEffect(() => {
    if (!pending) return;
    const snapshot = submitSnapshotRef.current;
    // First render after submit: state may still equal snapshot. Wait.
    if (snapshot !== null && connectionState === snapshot) return;
    if (connectionState === ConnectionState.CONNECTED) {
      setPending(false);
      submitSnapshotRef.current = null;
      setError(null);
      onClose();
    } else if (connectionState === ConnectionState.UNREACHABLE) {
      setPending(false);
      submitSnapshotRef.current = null;
      setError("Couldn't reach the gateway at that URL. Check the address and try again.");
    } else if (connectionState === ConnectionState.AUTH_FAILED) {
      setPending(false);
      submitSnapshotRef.current = null;
      setError("Gateway rejected the auth token. Run `openclaw auth token` to get a fresh one.");
    }
    // CONNECTING / DISCONNECTED / PAIRING are intermediate — keep waiting.
  }, [pending, connectionState, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = gatewayUrl.trim();
    const validation = validateGatewayUrl(trimmedUrl);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    const trimmedToken = token.trim() || undefined;
    // Drop the cached deviceToken whenever URL OR token changed — the device
    // token was minted for a specific (URL, token) pair, so any change can
    // invalidate it. Letting the engine re-mint is cheap and avoids an
    // auth-failed retry round-trip.
    const credsChanged =
      trimmedUrl !== currentSettings?.gatewayUrl || trimmedToken !== currentSettings?.token;
    const newSettings: Settings = {
      gatewayUrl: trimmedUrl,
      token: trimmedToken,
      deviceToken: credsChanged ? undefined : currentSettings?.deviceToken,
    };
    setError(null);
    setPending(true);
    // Snapshot the engine's current state — the resolver waits for it to
    // change off this value before treating any terminal state as ours.
    submitSnapshotRef.current = connectionState;
    // Engine owns the localStorage write via its onSettingsChanged callback —
    // no need to write here.
    onSave(newSettings);
  };

  const banner = STATUS_BANNER[connectionState];
  const Icon = banner.icon;

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

        <div className="mb-ml flex items-stretch gap-s rounded-lg border border-border-default/50 bg-background p-s dark:border-border-default/16 dark:bg-foreground">
          <div
            className={`flex shrink-0 items-center justify-center self-stretch rounded-md border px-s ${banner.tile}`}
          >
            <Icon size={16} className={`${banner.accent} ${banner.spin ? "animate-spin" : ""}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-label text-sm font-medium leading-tight text-text-neutral-primary">
              {banner.label}
            </p>
            <p className="mt-3xs font-body text-sm leading-snug text-text-neutral-tertiary">
              {banner.description}
            </p>
          </div>
        </div>

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
                    disabled={pending}
                    className="rounded-lg border border-border-default bg-background px-s py-xs font-body text-sm text-text-neutral-primary outline-none focus:border-border-interactive-emphasis disabled:opacity-60 dark:border-border-default/16 dark:bg-foreground"
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
                    disabled={pending}
                    className="rounded-lg border border-border-default bg-background px-s py-xs font-body text-sm text-text-neutral-primary outline-none focus:border-border-interactive-emphasis disabled:opacity-60 dark:border-border-default/16 dark:bg-foreground"
                  />
                  <p className="font-body text-sm text-text-neutral-tertiary">
                    Run{" "}
                    <code className="rounded bg-sunk-light px-3xs font-mono text-sm dark:bg-elevated">
                      openclaw auth token
                    </code>{" "}
                    to get your token. Stored locally — only needed once per device.
                  </p>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-border-danger bg-danger-background px-s py-xs font-body text-sm text-text-danger-primary"
                  >
                    {error}
                  </div>
                ) : null}

                {pending ? (
                  <div className="flex items-center gap-xs font-body text-sm text-text-neutral-tertiary">
                    <Loader2 size={14} className="animate-spin" />
                    Connecting to {gatewayUrl.trim()}…
                  </div>
                ) : null}

                <div className="mt-xs flex justify-end gap-xs">
                  <Button variant="secondary" size="md" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="md" type="submit" disabled={pending}>
                    {pending ? "Connecting…" : "Save & Connect"}
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
