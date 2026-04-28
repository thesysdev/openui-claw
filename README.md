<div align="center">

<!-- Replace with hosted banner when available -->
# OpenClaw UI

### OpenUI × OpenClaw

[![Discord](https://img.shields.io/badge/Discord-Chat-7289da?logo=discord&logoColor=white)](https://discord.com/invite/Pbv5PsqUSv)

**Generative UI client for [OpenClaw](https://github.com/openclaw/openclaw).**
Agents respond with interactive UI - charts, cards, tables, forms - instead of plain markdown.

</div>

---

## What is OpenClaw UI?

<!-- Add demo gif here
<div align="center">
  <img src="./assets/demo.gif" alt="OpenClaw UI demo - agent responding with a live dashboard" width="720" />
</div>
-->

<br/>

OpenClaw UI is a two-part system that adds generative UI to any OpenClaw agent:

1. **`@openuidev/claw-plugin`** - an OpenClaw server-side plugin that detects Claw sessions and injects [OpenUI Lang](https://openui.com) instructions into the agent's system prompt, so the LLM responds with structured UI markup instead of text.

2. **`@openuidev/claw-client`** - a Next.js web client that connects to your OpenClaw gateway over WebSocket and renders agent responses as live, interactive components using the OpenUI React renderer.

No build step for the plugin. OpenClaw loads it as raw TypeScript via [jiti](https://github.com/unjs/jiti).

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- A running [OpenClaw](https://github.com/openclaw/openclaw) gateway

### 1. Clone the repo

```bash
git clone https://github.com/thesysdev/openclaw-ui.git
cd openclaw-ui
pnpm install
```

### 2. Install the plugin into your gateway

```bash
openclaw plugins install -l ./packages/claw-plugin
openclaw restart
```

The plugin is a single `.ts` file with no runtime dependencies beyond `openclaw` itself.

<details>
<summary>Remote gateway?</summary>

Copy the plugin directory to the machine first:

```bash
rsync -az --exclude node_modules --exclude .git \
  packages/claw-plugin/ user@host:~/claw-plugin
```

Then on the remote machine:

```bash
openclaw plugins install -l ~/claw-plugin
openclaw restart
```

</details>

### 3. Start the client

```bash
cd packages/claw-client
pnpm dev
```

Open **http://localhost:18790** and enter your gateway URL and auth token in settings.

#### Finding your gateway URL and token

```bash
node scripts/connection-info.mjs
```

This prints your gateway URL and auth token from `~/.openclaw/openclaw.json`. Copy both values into the Claw settings dialog.

---

## Packages

| Package | Name | Description |
|---------|------|-------------|
| [`packages/claw-client`](packages/claw-client) | `@openuidev/claw-client` | Next.js generative UI web client |
| [`packages/claw-plugin`](packages/claw-plugin) | `@openuidev/openclaw-ui-plugin` | OpenClaw server-side plugin |

---

## License

[MIT](LICENSE)
