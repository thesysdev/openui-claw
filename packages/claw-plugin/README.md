# @openuidev/openclaw-ui-plugin

> [OpenClaw](https://github.com/openclaw/openclaw) plugin that bundles the [`claw-client`](../claw-client) and turns agent responses into [Generative UI](https://openui.com). After installing the plugin, the gateway serves the full chat UI at `http://localhost:18789/plugins/openui` — no separate Next.js process, no tunnel, no settings dialog.

## How it works

The plugin does two things in the same package:

1. **Prompt injection.** Registers a `before_prompt_build` hook. For each agent run originating from the claw-client, it prepends the OpenUI Lang system prompt so the LLM emits structured UI instead of plain markdown. Detected by session-key suffix `:openclaw-ui` — runs from other clients are unaffected.
2. **Static UI serving.** Registers an HTTP route at `/plugins/openui` (via `api.registerHttpRoute`). The route serves the prebuilt claw-client static export (Next.js `output: "export"`) bundled into the plugin's `static/` directory. Browser tabs load the UI from the gateway origin and connect back over the same-origin WebSocket — no CORS, no allowed-origins config, no tunnel.

The plugin also exposes lightweight stores for **apps**, **artifacts**, **notifications**, and **uploads**. These give the agent persistent, addressable UI primitives that the client can render and update across turns. See `app-store.ts`, `artifact-store.ts`, `notification-store.ts`, `upload-store.ts`.

## Install (local development)

```sh
# Build the claw-client static export and copy it into ./static/
pnpm bundle-ui

# Clear local node_modules — pnpm's escaping symlinks trip openclaw's install
# scanner. The managed install dir gets its own clean node_modules.
rm -rf node_modules

# Install + reload.
openclaw plugins install ./packages/claw-plugin --force
openclaw gateway restart
```

Open the UI at `http://localhost:18789/plugins/openui`. Paste the gateway URL (`ws://localhost:18789`) and the auth token from `~/.openclaw/openclaw.json` into the Settings dialog on first load. To skip the dialog and get a pre-authenticated URL with the token in the fragment (mirrors `openclaw dashboard`), run `node ../../scripts/open-ui.mjs` from the workspace root.

## Regenerating the system prompt

The OpenUI Lang system prompt is generated from `@openuidev/react-ui`'s component library. Re-run after upgrading that package:

```sh
pnpm generate
```

This rewrites `src/generated/system-prompt.ts` in place. Commit the result.

## Scripts

```sh
pnpm generate       # regenerate src/generated/system-prompt.ts
pnpm bundle-ui      # build claw-client and copy out/ → ./static/
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
│   ├── index.ts                # entrypoint: hook + tools + RPC + HTTP route
│   ├── app-store.ts            # app primitive store
│   ├── artifact-store.ts       # artifact primitive store (SQLite-backed)
│   ├── lint-openui.ts          # validation for emitted OpenUI Lang
│   ├── notification-store.ts   # notification store
│   ├── upload-store.ts         # upload store
│   └── generated/              # generated prompt assets (do not edit by hand)
├── static/                     # claw-client static export (gitignored, populated by `pnpm bundle-ui`)
├── skills/                     # OpenUI Lang skill instructions
│   ├── openui-chat-renderer/SKILL.md
│   └── openui-creator/SKILL.md
├── generate-prompt.ts          # build-time prompt generator
├── openclaw.plugin.json        # plugin manifest
└── package.json
```

## Notes for plugin developers

- `openclaw` is in `peerDependencies` and `devDependencies`, never `dependencies`. The runtime gateway provides the module.
- Types come from subpath exports: `import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"` and `from "openclaw/plugin-sdk/core"`. See [`AGENTS.md`](../../AGENTS.md) for the full guidance.
- Plugins are loaded via [jiti](https://github.com/unjs/jiti), so raw `.ts` ships as-is. There is no JS bundle step for the plugin's own code.
- The `static/` directory is treated as opaque content. The plugin's HTTP handler serves whatever is in there with sensible MIME types and a path-traversal guard. `pnpm bundle-ui` is the only thing that should write to it.
- For end-user setup story, architecture rationale, and what's still TODO, see [`docs/openclaw-os-bundling.md`](../../docs/openclaw-os-bundling.md).

## License

[MIT](../../LICENSE)
