# @openuidev/openclaw-ui-plugin

> [OpenClaw](https://github.com/openclaw/openclaw) plugin that turns agent responses into [Generative UI](https://openui.com). When the [`claw-client`](../claw-client) connects to a gateway with this plugin installed, agents respond with interactive [OpenUI Lang](https://openui.com) components — charts, tables, forms, cards — instead of plain markdown.

This is the server side of [OpenClaw UI](../../README.md). The other half is the browser-side [`@openuidev/claw-client`](../claw-client).

## How it works

The plugin registers a `before_prompt_build` hook. For each agent run initiated by the Claw client, it prepends the OpenUI Lang system prompt, instructing the LLM to emit structured UI components. Runs from other clients (CLI, other web apps) are unaffected.

Detection works via a session key convention: the Claw client appends `:openclaw-ui` to its session keys (e.g. `agent:main:main:openclaw-ui`). The plugin checks for this suffix in `ctx.sessionKey` and only activates when it is present.

The OpenUI Lang system prompt is baked directly into `src/index.ts` at generate time — the plugin is a single self-contained `.ts` file with no runtime dependencies beyond `openclaw` itself (which the gateway provides).

The plugin also exposes lightweight stores for **apps**, **artifacts**, **notifications**, and **uploads**. These give the agent persistent, addressable UI primitives that the client can render and update across turns. See `app-store.ts`, `artifact-store.ts`, `notification-store.ts`, and `upload-store.ts`.

## Install

From an installed npm package (when published):

```sh
openclaw plugins install @openuidev/openclaw-ui-plugin
openclaw restart
```

From a local checkout (during development):

```sh
openclaw plugins install -l ./packages/claw-plugin
openclaw restart
```

## Usage

Open the [Claw client](../claw-client), enter your gateway URL and auth token in settings, and start chatting. Agent responses will render as interactive UI components. See the [root README](../../README.md#quick-start) for the full end-to-end flow.

## Regenerating the system prompt

The system prompt baked into `src/index.ts` is generated from `@openuidev/react-ui`'s component library. Re-run after upgrading that package:

```sh
pnpm generate
```

This rewrites `src/index.ts` in place. Commit the result.

## Scripts

```sh
pnpm generate       # regenerate src/index.ts from the OpenUI Lang component library
pnpm lint:check     # ESLint
pnpm lint:fix       # ESLint --fix
pnpm format:check   # Prettier --check
pnpm format:fix     # Prettier --write
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm ci             # lint + format + typecheck
```

## Project layout

```
packages/claw-plugin/
├── src/
│   ├── index.ts                # plugin entrypoint (hook registration + system prompt)
│   ├── app-store.ts            # app primitive store
│   ├── artifact-store.ts       # artifact primitive store (SQLite-backed)
│   ├── lint-openui.ts          # validation for emitted OpenUI Lang
│   ├── notification-store.ts   # notification store
│   ├── upload-store.ts         # upload store
│   └── generated/              # generated prompt assets (do not edit by hand)
├── skills/                     # OpenUI Lang skill instructions
│   ├── openui-chat-renderer/SKILL.md
│   └── openui-creator/SKILL.md
├── generate-prompt.ts          # build-time prompt generator
├── openclaw.plugin.json        # plugin manifest
└── package.json
```

## Local testing against a remote gateway

The plugin is a single `.ts` file — no build step, no `node_modules` needed on the gateway machine. To install on a remote gateway, copy the directory over first:

```sh
rsync -az --exclude node_modules --exclude .git \
  -e "ssh -i <path-to-pem>" \
  ./packages/claw-plugin/ <user>@<host>:~/openclaw-ui-plugin
```

Then on the remote machine:

```sh
openclaw plugins install -l ~/openclaw-ui-plugin
openclaw restart
```

Open the Claw client, connect to the gateway, and send a message. If the plugin is active you will see OpenUI Lang components rendered instead of plain text.

## Notes for plugin developers

- `openclaw` is in `peerDependencies` and `devDependencies`, never `dependencies`. The runtime gateway provides the module.
- Types come from subpath exports: `import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"` and `from "openclaw/plugin-sdk/core"`. See [`AGENTS.md`](../../AGENTS.md#openclaw-types) for the full guidance.
- Plugins are loaded via [jiti](https://github.com/unjs/jiti), so raw `.ts` ships as-is. There is no bundle step to maintain.

## License

[MIT](../../LICENSE)
