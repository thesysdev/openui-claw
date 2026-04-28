# @openuidev/claw-plugin

OpenClaw plugin that enables [Generative UI](https://openui.com) in the [Claw client](https://claw.openui.com). When the Claw client connects to a gateway with this plugin installed, agents respond with interactive OpenUI Lang components — charts, tables, forms, cards — instead of plain markdown.

## How it works

The plugin registers a `before_prompt_build` hook. For each agent run initiated by the Claw client, it prepends the OpenUI Lang system prompt, instructing the LLM to emit structured UI components. Runs from other clients (CLI, other web apps) are unaffected.

Detection works via a session key convention: the Claw client appends `:openclaw-ui` to its session keys (e.g. `agent:main:main:openclaw-ui`). The plugin checks for this suffix in `ctx.sessionKey` and only activates when it is present.

The OpenUI Lang system prompt is baked directly into `src/index.ts` at generate time — the plugin is a single self-contained `.ts` file with no runtime dependencies beyond `openclaw` itself (which the gateway provides).

## Install

```sh
openclaw plugins install @openuidev/claw-plugin
```

Restart the gateway after install.

## Usage

Open the [Claw client](https://claw.openui.com), enter your gateway URL and auth token in settings, and start chatting. Agent responses will render as interactive UI components.

## Regenerating the system prompt

The system prompt in `src/index.ts` is generated from `@openuidev/react-ui`. Re-run after upgrading that package:

```sh
pnpm generate
```

This rewrites `src/index.ts` in place. Commit the result.

---

## Local testing

Install directly from the repo. The plugin is a single `.ts` file — no build step, no node_modules needed on the gateway machine.

If running openclaw remotely
```sh
rsync -az --exclude node_modules --exclude .git \
  -e "ssh -i <path-to-pem>" \
  . <user>@<hostname>:~/openclaw-ui-plugin
```

Install the plugin:
```sh
openclaw plugins install -l ./packages/claw-plugin
```

Then restart your gateway:
```sh
openclaw start
```

Open the OpenClaw UI client, connect to the gateway, and send a message. If the plugin is active you will see OpenUI Lang output rendered as interactive components instead of plain text.
