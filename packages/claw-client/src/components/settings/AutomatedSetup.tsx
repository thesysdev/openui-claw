"use client";

import { useState } from "react";

const INSTALL_COMMAND =
  "curl -fsSL https://raw.githubusercontent.com/thesysdev/openui-claw/main/scripts/setup-tunnel.mjs -o /tmp/claw-setup.mjs && node /tmp/claw-setup.mjs";

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
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Run this on your Mac Mini:
        </label>
        <div className="relative">
          <pre className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-all overflow-x-auto">
            {INSTALL_COMMAND}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        This command provisions a Cloudflare Tunnel, installs{" "}
        <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
          cloudflared
        </code>{" "}
        as a system service, and prints a link to open in your browser.
        You&apos;ll need <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">sudo</code>{" "}
        access and Node.js 18+.
      </p>
    </div>
  );
}
