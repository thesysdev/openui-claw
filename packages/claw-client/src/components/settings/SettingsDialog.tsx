"use client";

import { useEffect, useRef, useState } from "react";
import type { Settings } from "@/lib/storage";
import { ConnectionState } from "@/lib/gateway/types";
import { validateGatewayUrl } from "@/lib/gateway/url";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@openuidev/react-ui";
import { AutomatedSetup } from "./AutomatedSetup";

interface Props {
  open: boolean;
  currentSettings: Settings | null;
  connectionState: ConnectionState;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

export function SettingsDialog({
  open,
  currentSettings,
  connectionState,
  onClose,
  onSave,
}: Props) {
  const [gatewayUrl, setGatewayUrl] = useState(currentSettings?.gatewayUrl ?? "");
  const [token, setToken] = useState(currentSettings?.token ?? "");
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
  }, [open]); // intentionally not depending on currentSettings — see comment above

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal(); else el.close();
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
      trimmedUrl !== currentSettings?.gatewayUrl ||
      trimmedToken !== currentSettings?.token;
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
                disabled={pending}
                className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-border-default disabled:opacity-60"
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
                disabled={pending}
                className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-border-default disabled:opacity-60"
              />
              <p className="text-sm text-text-neutral-tertiary">
                Run{" "}
                <code className="font-mono bg-foreground px-1 rounded">
                  openclaw auth token
                </code>{" "}
                to get your token. Stored locally — only needed once per device.
              </p>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-status-error bg-danger-background px-3 py-2 text-sm text-text-danger-primary"
              >
                {error}
              </div>
            ) : null}

            {pending ? (
              <div className="flex items-center gap-2 text-sm text-text-neutral-tertiary">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-status-warning" />
                Connecting to {gatewayUrl.trim()}…
              </div>
            ) : null}

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
                disabled={pending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-inverted-background text-text-white hover:opacity-90 transition-colors disabled:opacity-60"
              >
                {pending ? "Connecting…" : "Save & Connect"}
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
      </Tabs>
    </dialog>
  );
}
