"use client";

/**
 * Full-page settings surface.
 *
 * Replaces the cramped modal with a proper two-pane page (left nav,
 * right content). Driven by `#/settings/<section>` so deep-links work.
 *
 * - "connection" → gateway URL + token (the manual flow from the old dialog)
 * - "preferences" → the shared `PreferencesPanel`
 * - "automated"  → automated-tunnel setup flow (still useful as an option)
 * - "about"      → version / links
 *
 * The first-run modal still triggers when no gateway is configured —
 * that's a different surface so the user isn't sent to a tab they
 * can't fill in.
 */

import { navigate, settingsHash } from "@/lib/hooks/useHashRoute";
import { saveSettings, type Settings } from "@/lib/storage";
import { Cable, Info, Sliders, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { AutomatedSetup } from "./AutomatedSetup";
import { PreferencesPanel } from "./PreferencesPanel";

type SectionId = "connection" | "preferences" | "automated" | "about";

const SECTIONS: { id: SectionId; label: string; icon: typeof Cable }[] = [
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "connection", label: "Connection", icon: Cable },
  { id: "automated", label: "Automated setup", icon: Terminal },
  { id: "about", label: "About", icon: Info },
];

function isSection(value: string | undefined): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}

interface Props {
  currentSettings: Settings | null;
  section?: string;
  onSave: (settings: Settings) => void;
}

export function SettingsView({ currentSettings, section, onSave }: Props) {
  const active: SectionId = isSection(section) ? section : "preferences";

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <aside className="w-60 shrink-0 border-r border-border-default/50 bg-foreground/40 px-s pt-2xl dark:border-border-default/16 dark:bg-sunk-deep/40">
        <h1 className="mb-l px-s font-heading text-xl font-semibold text-text-neutral-primary">
          Settings
        </h1>
        <nav className="flex flex-col gap-2xs">
          {SECTIONS.map((s) => {
            const isActive = s.id === active;
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={settingsHash(s.id)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate({ view: "settings", section: s.id });
                }}
                className={`flex items-center gap-s rounded-lg px-s py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-info-background text-text-info-primary"
                    : "text-text-neutral-secondary hover:bg-foreground hover:text-text-neutral-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{s.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-3xl py-2xl">
        <div className="mx-auto w-full max-w-3xl">
          {active === "preferences" ? <PreferencesSection /> : null}
          {active === "connection" ? (
            <ConnectionSection currentSettings={currentSettings} onSave={onSave} />
          ) : null}
          {active === "automated" ? <AutomatedSection /> : null}
          {active === "about" ? <AboutSection /> : null}
        </div>
      </main>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-xl">
      <h2 className="font-heading text-2xl font-semibold text-text-neutral-primary">{title}</h2>
      {hint ? <p className="mt-2xs text-sm text-text-neutral-tertiary">{hint}</p> : null}
    </div>
  );
}

function PreferencesSection() {
  return (
    <div>
      <SectionHeader
        title="Preferences"
        hint="Customise how Claw looks, sounds, and behaves on this device."
      />
      <PreferencesPanel />
    </div>
  );
}

function ConnectionSection({
  currentSettings,
  onSave,
}: {
  currentSettings: Settings | null;
  onSave: (settings: Settings) => void;
}) {
  const [gatewayUrl, setGatewayUrl] = useState(currentSettings?.gatewayUrl ?? "");
  const [token, setToken] = useState(currentSettings?.token ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setGatewayUrl(currentSettings?.gatewayUrl ?? "");
    setToken(currentSettings?.token ?? "");
  }, [currentSettings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = gatewayUrl.trim();
    if (!trimmedUrl) return;
    const next: Settings = {
      gatewayUrl: trimmedUrl,
      token: token.trim() || undefined,
      // If the URL changed, invalidate the device token so we re-pair.
      deviceToken:
        trimmedUrl === currentSettings?.gatewayUrl ? currentSettings?.deviceToken : undefined,
    };
    saveSettings(next);
    onSave(next);
    setSavedAt(Date.now());
  };

  return (
    <div>
      <SectionHeader
        title="Connection"
        hint="Connect Claw to your OpenClaw gateway. Run `openclaw config show` in a terminal to see your gateway URL and token."
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-l">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-neutral-secondary">Gateway URL</label>
          <input
            type="url"
            required
            placeholder="ws://localhost:18789"
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-border-default"
          />
          <p className="text-sm text-text-neutral-tertiary">
            Use <code className="font-mono">ws://</code> for local,{" "}
            <code className="font-mono">wss://</code> for remote.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-neutral-secondary">Auth token</label>
          <input
            type="password"
            placeholder="Paste your token here"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-border-default"
          />
          <p className="text-sm text-text-neutral-tertiary">
            Run <code className="font-mono">openclaw auth token</code> to get your token. Stored
            locally — only needed once per device.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-inverted-background px-4 py-2 text-sm font-medium text-text-white transition-opacity hover:opacity-90"
          >
            Save & Connect
          </button>
          {savedAt ? (
            <span className="text-sm text-text-neutral-tertiary">Saved · reconnecting…</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function AutomatedSection() {
  return (
    <div>
      <SectionHeader
        title="Automated setup"
        hint="Provision a Cloudflare Tunnel and wire your Mac Mini up to Claw with a single command."
      />
      <AutomatedSetup />
    </div>
  );
}

// Pulled from package.json at build time — Next inlines the static value
// into the bundle, so this is just a string at runtime.
import pkg from "../../../package.json";

function AboutSection() {
  return (
    <div>
      <SectionHeader title="About Claw" hint="Open-source generative-UI client for OpenClaw." />
      <div className="flex flex-col gap-3 text-sm text-text-neutral-secondary">
        <p>
          Claw is a desktop + mobile client for OpenClaw agents. It speaks the WebSocket gateway
          protocol directly — no separate backend.
        </p>
        <p>
          Version <code className="font-mono bg-foreground px-1 rounded">{pkg.version}</code>
        </p>
        <p>
          <a
            href="https://github.com/thesysdev/openui-claw"
            target="_blank"
            rel="noreferrer"
            className="text-text-info-primary underline-offset-2 hover:underline"
          >
            Source on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
