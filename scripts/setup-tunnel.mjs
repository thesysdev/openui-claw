#!/usr/bin/env node

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";

const PREFIX = "[openui-claw]";
const DEFAULT_API_BASE = "https://app.generativeui.cloud";
const DEFAULT_DOMAIN = "generativeui.cloud";
const DEFAULT_PORT = 18789;

function log(msg) {
  console.log(`${PREFIX} ${msg}`);
}

function fatal(msg) {
  console.error(`${PREFIX} ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs() {
  const args = {
    command: "install",
    apiBase: DEFAULT_API_BASE,
    tunnelToken: null,
    tunnelId: null,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === "uninstall") {
      args.command = "uninstall";
    } else if (arg.startsWith("--api-base=")) {
      args.apiBase = arg.slice("--api-base=".length);
    } else if (arg.startsWith("--tunnel-token=")) {
      args.tunnelToken = arg.slice("--tunnel-token=".length);
    } else if (arg.startsWith("--tunnel-id=")) {
      args.tunnelId = arg.slice("--tunnel-id=".length);
    } else {
      fatal(`Unknown argument: ${arg}`);
    }
  }

  if (args.command === "install") {
    const hasToken = args.tunnelToken !== null;
    const hasId = args.tunnelId !== null;
    if (hasToken !== hasId) {
      fatal(
        "--tunnel-token and --tunnel-id must be provided together or not at all.",
      );
    }
  }

  return args;
}

function readOpenClawConfig() {
  log("==> Reading OpenClaw config...");

  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) {
    fatal("OpenClaw config not found. Is OpenClaw installed?");
  }

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const port = config.gateway?.bind?.port || DEFAULT_PORT;
  const token = config.gateway?.auth?.token;

  if (!token) {
    fatal("Gateway auth token not set. Run: openclaw auth token");
  }

  log(`    Port: ${port}`);
  return { port, token };
}

async function provision(apiBase, port) {
  log("==> Provisioning tunnel...");

  const url = `${apiBase}/api/provision`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ port }),
    });
  } catch (err) {
    fatal(
      `Could not reach ${url} — ${err.cause?.code || err.message}. ` +
        "Check your network/firewall and that the API is running.",
    );
  }

  let body;
  try {
    body = await res.json();
  } catch {
    const text = await res.text().catch(() => "<unreadable>");
    fatal(
      `Provisioning API returned non-JSON (HTTP ${res.status}). Body: ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok) {
    fatal(
      `Provisioning failed (HTTP ${res.status}): ${body.error || res.statusText}`,
    );
  }

  log(`    Tunnel ID: ${body.tunnelId}`);
  return {
    tunnelId: body.tunnelId,
    tunnelToken: body.tunnelToken,
    gatewayUrl: body.gatewayUrl,
  };
}

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function installCloudflared() {
  log("==> Installing cloudflared...");

  if (commandExists("cloudflared")) {
    log("    Already installed, skipping.");
    return;
  }

  const platform = process.platform;

  if (platform === "darwin") {
    log("    Installing via Homebrew...");
    execSync("brew install cloudflared", { stdio: "inherit" });
  } else if (platform === "linux") {
    log("    Downloading cloudflared binary...");
    const url =
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64";
    execSync(
      `curl -fsSL "${url}" -o /tmp/cloudflared && chmod +x /tmp/cloudflared && sudo mv /tmp/cloudflared /usr/local/bin/cloudflared`,
      { stdio: "inherit" },
    );
  } else {
    fatal(
      `Unsupported platform: ${platform}. Only macOS and Linux are supported.`,
    );
  }

  if (!commandExists("cloudflared")) {
    fatal("cloudflared installation failed — command not found after install.");
  }

  log("    cloudflared installed successfully.");
}

function installCloudflaredService(tunnelToken) {
  log("==> Installing cloudflared service...");
  execSync(`sudo cloudflared service install ${tunnelToken}`, {
    stdio: "inherit",
  });
  log("    Service installed.");
}

const PLUGIN_DIR = join(homedir(), ".openclaw", "openui", "claw-plugin");

function installPlugin() {
  log("==> Installing OpenUI Claw plugin...");

  try {
    execSync("openclaw plugins install @openuidev/openui-claw-plugin", {
      stdio: "inherit",
    });
    log("    Plugin installed.");
  } catch (err) {
    log(
      `    WARNING: Plugin install failed (${err.message}). You can install it manually later.`,
    );
  }
}

const OPENCLAW_CONFIG_PATH = join(homedir(), ".openclaw", "openclaw.json");

function restartGateway() {
  log("==> Restarting OpenClaw gateway...");
  try {
    execSync("openclaw restart", { stdio: "inherit" });
    log("    Gateway restarted.");
  } catch {
    log(
      "    WARNING: Could not restart gateway automatically. Please run: openclaw restart",
    );
  }
}

function addAllowedOrigin(apiBase) {
  log("==> Configuring gateway allowed origins...");

  if (!existsSync(OPENCLAW_CONFIG_PATH)) {
    log("    WARNING: OpenClaw config not found, skipping.");
    return;
  }

  const config = JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, "utf8"));
  const origin = new URL(apiBase).origin;

  if (!config.gateway) config.gateway = {};
  if (!config.gateway.controlUi) config.gateway.controlUi = {};

  const origins = Array.isArray(config.gateway.controlUi.allowedOrigins)
    ? config.gateway.controlUi.allowedOrigins
    : [];

  if (origins.includes(origin)) {
    log(`    ${origin} already allowed, skipping.`);
    return;
  }

  origins.push(origin);
  config.gateway.controlUi.allowedOrigins = origins;

  writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 4) + "\n");
  log(`    Added ${origin} to gateway.controlUi.allowedOrigins`);
}

function removeAllowedOrigin(apiBase) {
  log("==> Removing gateway allowed origin...");

  if (!existsSync(OPENCLAW_CONFIG_PATH)) {
    log("    WARNING: OpenClaw config not found, skipping.");
    return;
  }

  const config = JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, "utf8"));
  const origin = new URL(apiBase).origin;
  const origins = config.gateway?.controlUi?.allowedOrigins;

  if (!Array.isArray(origins) || !origins.includes(origin)) {
    log(`    ${origin} not in allowedOrigins, skipping.`);
    return;
  }

  config.gateway.controlUi.allowedOrigins = origins.filter((o) => o !== origin);

  writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 4) + "\n");
  log(`    Removed ${origin} from gateway.controlUi.allowedOrigins`);
}

function saveConfig({ tunnelId, gatewayUrl, apiBase }) {
  log("==> Saving config...");

  const dir = join(homedir(), ".openclaw", "openui");
  mkdirSync(dir, { recursive: true });

  const configPath = join(dir, "config.json");
  const config = {
    tunnelId,
    gatewayUrl,
    apiBase,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  log(`    Saved to ${configPath}`);
}

const CONFIG_PATH = join(homedir(), ".openclaw", "openui", "config.json");

function readSavedConfig() {
  if (!existsSync(CONFIG_PATH)) {
    fatal(
      "No saved config found at ~/.openclaw/openui/config.json. Nothing to uninstall.",
    );
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

async function deprovision(apiBase, tunnelId) {
  log("==> Removing tunnel and DNS...");

  const res = await fetch(`${apiBase}/api/provision`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tunnelId }),
  });

  const body = await res.json();

  if (!res.ok) {
    log(`    WARNING: Deprovision failed: ${body.error || res.statusText}`);
  } else {
    log("    Tunnel and DNS removed.");
  }
}

function uninstallCloudflaredService() {
  log("==> Uninstalling cloudflared service...");

  try {
    execSync("sudo cloudflared service uninstall", { stdio: "inherit" });
    log("    Service uninstalled.");
  } catch {
    log("    WARNING: Service uninstall failed (may not have been installed).");
  }
}

function removePlugin() {
  log("==> Removing OpenUI Claw plugin...");

  try {
    execSync("openclaw plugins uninstall openui-claw-plugin", { stdio: "inherit" });
    log("    Plugin unregistered.");
  } catch {
    log("    WARNING: Plugin unregister failed (may not have been installed).");
  }

  if (existsSync(PLUGIN_DIR)) {
    execSync(`rm -rf "${PLUGIN_DIR}"`, { stdio: "inherit" });
    log(`    Removed ${PLUGIN_DIR}`);
  }
}

function removeSavedConfig() {
  log("==> Removing saved config...");

  if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
    log(`    Removed ${CONFIG_PATH}`);
  } else {
    log("    No config file to remove.");
  }
}

async function install(args) {
  const { port, token } = readOpenClawConfig();

  let tunnelId, tunnelToken, gatewayUrl;

  if (args.tunnelToken && args.tunnelId) {
    log("==> Using provided tunnel credentials (skipping provisioning)...");
    tunnelId = args.tunnelId;
    tunnelToken = args.tunnelToken;
    gatewayUrl = `wss://${tunnelId}-gw.${DEFAULT_DOMAIN}`;
    log(`    Tunnel ID: ${tunnelId}`);
  } else {
    ({ tunnelId, tunnelToken, gatewayUrl } = await provision(
      args.apiBase,
      port,
    ));
  }

  addAllowedOrigin(args.apiBase);
  installPlugin();
  restartGateway();
  installCloudflared();
  installCloudflaredService(tunnelToken);
  saveConfig({ tunnelId, gatewayUrl, apiBase: args.apiBase });

  const setupUrl = `${args.apiBase}/setup#gateway=${encodeURIComponent(gatewayUrl)}&token=${encodeURIComponent(token)}`;

  console.log();
  log("==> Setup complete! Open this link in your browser:");
  console.log();
  console.log(`    ${setupUrl}`);
  console.log();
}

async function uninstall(args) {
  const saved = readSavedConfig();
  const apiBase = args.apiBase !== DEFAULT_API_BASE ? args.apiBase : saved.apiBase || DEFAULT_API_BASE;
  const tunnelId = saved.tunnelId;

  log(`    Tunnel ID: ${tunnelId}`);

  uninstallCloudflaredService();
  await deprovision(apiBase, tunnelId);
  removePlugin();
  removeAllowedOrigin(apiBase);
  restartGateway();
  removeSavedConfig();

  console.log();
  log("==> Uninstall complete.");
  console.log();
}

async function main() {
  const args = parseArgs();

  if (args.command === "uninstall") {
    await uninstall(args);
  } else {
    await install(args);
  }
}

main().catch((err) => {
  fatal(err.message);
});
