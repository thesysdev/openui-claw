"use client";

import { useState } from "react";

const INSTALL_COMMAND =
  "curl -fsSL https://raw.githubusercontent.com/thesysdev/openclaw-ui/main/scripts/setup-tunnel.mjs -o /tmp/claw-setup.mjs && node /tmp/claw-setup.mjs";

export function AutomatedSetup() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-neutral-secondary">
          Run this on your Mac Mini:
        </label>
        <div className="relative">
          {/* Shell commands shouldn't break mid-path. Allow horizontal
              scroll instead — `whitespace-pre` + `overflow-x-auto`. */}
          <pre className="rounded-lg border border-border-default bg-sunk-light px-3 py-2.5 pr-20 text-sm font-mono text-text-neutral-secondary whitespace-pre overflow-x-auto">
            {INSTALL_COMMAND}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2 py-1 rounded text-sm font-medium bg-sunk text-text-neutral-secondary hover:bg-sunk-deep transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <p className="text-sm text-text-neutral-tertiary">
        This command provisions a Cloudflare Tunnel, installs{" "}
        <code className="font-mono bg-foreground px-1 rounded">cloudflared</code> as a system
        service, and prints a link to open in your browser. You&apos;ll need{" "}
        <code className="font-mono bg-foreground px-1 rounded">sudo</code> access and Node.js 18+.
      </p>
    </div>
  );
}
