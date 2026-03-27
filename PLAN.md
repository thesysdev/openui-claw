# Claw — OpenUI for OpenClaw

**Site:** claw.openui.com
**Repo:** thesysdev/claw
**Plugin:** `@openuidev/claw-plugin`
**Client:** `@openuidev/claw`

## Background

OpenClaw is an AI agent gateway platform. By default its agents respond in markdown — plain text that users read but cannot interact with.

Claw replaces markdown with **Generative UI**: the agent emits **OpenUI Lang**, a token-efficient format that streams directly from the LLM and is rendered live by a React `<Renderer />` into interactive components — charts, tables, forms, cards, and more.

This requires two pieces working together:

- **`@openuidev/claw-plugin`** — an OpenClaw server-side plugin that intercepts the prompt-build lifecycle and injects a system prompt telling the LLM to respond in OpenUI Lang instead of markdown. It only activates for requests that originate from the Claw client (detected via `client.id === "openui-claw"` in the WebSocket handshake), so it is invisible to all other clients.

- **`@openuidev/claw`** — a fully static Next.js app (no backend) that the user opens in a browser. It connects directly to their own OpenClaw Gateway over WebSocket, authenticates using a per-device Ed25519 keypair stored in IndexedDB, and renders streaming agent responses through a hybrid renderer: OpenUI Lang goes to `<Renderer />`, plain text falls back to markdown. This means the client works gracefully even without the plugin installed.

### Hybrid Rendering & Detection

OpenUI Lang has an unambiguous first-line signature — every valid response must begin with `root = <ComponentName>(...)`. Detection therefore requires no buffering: `detection.ts` tests the first non-empty line against `/^root\s*=\s*\w+\(/` and routes immediately. If it matches, the accumulated stream is fed to `<Renderer />`; otherwise it renders as markdown. Because the two formats are mutually exclusive at the very first token, the fallback is seamless — agents without the plugin installed simply produce markdown and the client handles it without any special casing.

The single coupling point between the two packages is the `client.id: "openui-claw"` field sent in the WebSocket connect handshake.

---

Generative UI client for OpenClaw using OpenUI. Agent responds with interactive UI (charts, cards, tables, forms) instead of markdown. Two packages in a pnpm workspace.

Install:
```
openclaw plugins install @openuidev/claw-plugin
```

---

## Plugin (`packages/claw-plugin`)

`@openuidev/claw-plugin` — OpenClaw native plugin using `api.on("before_prompt_build", ...)` typed lifecycle hook.

**Does:**
- Registers a `before_prompt_build` hook that returns `{ prependSystemContext: OPENUI_SYSTEM_PROMPT }` when the request originates from the Claw client, and `undefined` otherwise
- Detects the client via `client.id === "openui-claw"` in the event context (investigate `before_prompt_build` event shape in `src/plugins/types.ts` to find the right field — fall back to session key convention `":openui-claw:"` if client metadata unavailable)
- System prompt generated at build time from `openuiChatLibrary.prompt(openuiChatPromptOptions)` from `@openuidev/react-ui/genui-lib`, baked as a static string
- Prompt includes a preamble instructing the agent to respond in OpenUI Lang not markdown

**Structure:**
```
packages/claw-plugin/
├── package.json              # openclaw.extensions: ["./dist/index.js"]
├── openclaw.plugin.json      # id: "claw"
├── tsup.config.ts
└── src/
    ├── index.ts              # Plugin entry with before_prompt_build hook
    ├── prompt.ts             # Re-exports the baked prompt string
    └── generate-prompt.ts    # Build-time script: generates prompt → src/generated/system-prompt.ts
```

**Build:** `generate:prompt` then `tsup`. Use `definePluginEntry` if importable from `openclaw/plugin-sdk`, otherwise bare function export.

**Deps:** `@openuidev/react-lang`, `@openuidev/react-ui`, `tsup`, `tsx`, `typescript`

---

## Client (`packages/claw`)

`@openuidev/claw` — Next.js static app (no backend). Connects directly to user's OpenClaw Gateway over WebSocket.

**Does:**
- Settings screen: user enters Gateway URL + auth token
- Connects via WebSocket with `client.id: "openui-claw"` in the connect handshake — this is what the plugin uses to detect the client
- Ed25519 device keypair generated on first use, stored in IndexedDB, used to sign `connect.challenge` nonce
- Loads chat history via `chat.history` on connect
- Sends messages via `chat.send` with idempotency keys
- Streams responses from `event:agent` frames, accumulates text, feeds to `<Renderer library={openuiChatLibrary} response={text} isStreaming={bool} />`
- Hybrid message rendering: detects OpenUI Lang → `<Renderer />`, otherwise → markdown renderer
- Abort button during streaming via `chat.abort`
- Auto-reconnect with backoff on disconnect

**Structure:**
```
packages/claw/
├── package.json
├── next.config.ts            # output: "export" — fully static
├── tailwind.config.ts
└── src/
    ├── app/                  # Next.js App Router — layout + main page
    ├── components/
    │   ├── chat/             # ChatContainer, MessageList, MessageBubble, ChatInput, StreamingMessage
    │   ├── rendering/        # MessageRenderer (hybrid), OpenUIMessage, MarkdownMessage
    │   └── settings/         # SettingsDialog, ConnectionStatus
    ├── lib/
    │   ├── gateway/          # socket, handshake, protocol frames, device identity, types
    │   ├── chat/             # useGateway hook, useChatSession hook, history loader
    │   ├── openui/           # Re-exports openuiChatLibrary
    │   ├── detection.ts      # OpenUI Lang vs markdown format detection
    │   └── storage.ts        # localStorage helpers for settings
    └── types/                # ChatMessage, ConnectionState, etc.
```

**Deps:** `next`, `react` (19+), `@openuidev/react-lang`, `@openuidev/react-ui`, `zustand`, `zod`, `react-markdown`, `remark-gfm`, `@noble/ed25519`, `tailwindcss`, `typescript`

---

## Monorepo

```
claw/                         # thesysdev/claw
├── package.json              # pnpm workspace root
├── pnpm-workspace.yaml       # packages/*
├── tsconfig.json
├── README.md
├── LICENSE
├── packages/
│   ├── claw-plugin/          # @openuidev/claw-plugin
│   └── claw/                 # @openuidev/claw
```

---

## Implementation Order

### Phase 1 — Working Chat Client (markdown only)

Get a fully functional chat client connected to a real gateway before touching OpenUI. Validate the entire protocol and UX at this stage.

1. Monorepo scaffold: pnpm workspace, tsconfig, Next.js app shell, Tailwind
2. Gateway layer: device identity (Ed25519 keypair → IndexedDB) → protocol types → handshake → socket manager → auto-reconnect
3. Chat layer: `useGateway` hook → `useChatSession` hook → `chat.history` on connect → `chat.send` with idempotency keys → `chat.abort`
4. Chat UI: settings screen (Gateway URL + token) → connection status → message list → chat input → markdown renderer → streaming → abort button
5. **Checkpoint:** end-to-end chat working against a real OpenClaw gateway, all responses rendered as markdown

### Phase 2 — Plugin

Add the server-side plugin once the client is stable.

6. Investigate open questions: `before_prompt_build` event shape, `definePluginEntry` availability, Ed25519 signature payload
7. `generate-prompt.ts` build script → bake system prompt string
8. Plugin entry with `before_prompt_build` hook → detect `client.id === "openui-claw"` → prepend system context
9. `tsup` build → test with `openclaw plugins install -l`
10. **Checkpoint:** agent responds in OpenUI Lang when connected from the Claw client, markdown otherwise

### Phase 3 — OpenUI Lang Rendering

Wire up the renderer now that the plugin is producing OpenUI Lang.

11. `detection.ts`: first-line regex to distinguish OpenUI Lang from markdown
12. `OpenUIMessage` component: `<Renderer library={openuiChatLibrary} response={text} isStreaming={bool} />`
13. `MessageRenderer`: hybrid switcher — route to `OpenUIMessage` or `MarkdownMessage` based on detection
14. **Checkpoint:** interactive UI components render live during streaming; plain-text agents still fall back to markdown

---

## Open Questions (investigate before implementing)

1. **`before_prompt_build` event shape** — read `src/plugins/types.ts` in OpenClaw repo. What fields expose the originating client identity? We need to detect `client.id === "openui-claw"`.
2. **`definePluginEntry`** — is it importable from `openclaw/plugin-sdk`? If not, use bare function export.
3. **Ed25519 v3 signature payload format** — read `src/gateway/protocol/schema.ts` for exact fields to sign.
