# @openuidev/claw-plugin

OpenClaw plugin that enables [Generative UI](https://openui.com) in the [Claw client](https://claw.openui.com). When the Claw client connects to a gateway with this plugin installed, agents respond with interactive OpenUI Lang components — charts, tables, forms, cards — instead of plain markdown.

## How it works

The plugin registers a `before_prompt_build` hook. For each agent run initiated by the Claw client, it prepends the OpenUI Lang system prompt, instructing the LLM to emit structured UI components. Runs from other clients (CLI, other web apps) are unaffected.

Detection works via a session key convention: the Claw client appends `:openui-claw` to its session keys (e.g. `main:openui-claw`). The plugin checks for this suffix in `ctx.sessionKey` and only activates when it is present.

## Install

```sh
openclaw plugins install @openuidev/claw-plugin
```

Restart the gateway after install.

## Usage

Open the [Claw client](https://claw.openui.com), enter your gateway URL and auth token in settings, and start chatting. Agent responses will render as interactive UI components.

---

## Local testing

Install directly from the repo (no build step required — the plugin is a raw TypeScript file loaded by jiti):

```sh
openclaw plugins install -l ./packages/claw-plugin
```

Then restart your local gateway:

```sh
openclaw start
```

Open the Claw client, connect to your local gateway, and send a message. If the plugin is active you will see OpenUI Lang output (e.g. `root = Card(...)`) rendered as interactive components instead of plain text.

To verify detection is working, check the gateway logs — the plugin logs nothing on no-op calls and only fires the prompt injection for sessions whose key ends in `:openui-claw`.
