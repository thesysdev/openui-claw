/**
 * Build script — emits the artifacts the plugin needs at runtime:
 *
 *   skills/openui-creator/SKILL.md           — generated body, manual workflow appended
 *   skills/openui-chat-renderer/SKILL.md     — generated body
 *   src/generated/openui-schema.json         — drives the lint loop in lint-openui.ts
 *
 * Re-run with `pnpm generate` whenever @openuidev/react-ui changes its
 * component surface or this file's preambles.
 *
 * Why the libraries are imported here (and not in src/index.ts):
 *   `openuiLibrary` carries `"use client"` + React imports. They are fine
 *   to import in a Node build script, but cannot run inside the plugin
 *   process. So we generate the prompt + schema once at build time and
 *   ship the resulting strings as filesystem artefacts.
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  openuiAdditionalRules,
  openuiChatAdditionalRules,
  openuiChatExamples,
  openuiChatLibrary,
  openuiChatPromptOptions,
  openuiExamples,
  openuiLibrary,
  openuiPromptOptions,
} from "@openuidev/react-ui/genui-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = join(__dirname, "src", "generated");
const skillsDir = join(__dirname, "skills");

mkdirSync(generatedDir, { recursive: true });
mkdirSync(join(skillsDir, "openui-chat-renderer"), { recursive: true });
mkdirSync(join(skillsDir, "openui-creator"), { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// 1. openui-chat-renderer skill — inline UI in a chat reply.
//    Static surface only: no Query, no Mutation, no $variables, no builtins,
//    no filters. Just component signatures + Action({@ToAssistant, @OpenUrl}).
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_PREAMBLE = `You are about to render inline UI in a chat reply using openui-lang. Wrap the openui-lang code in triple-backtick fences tagged \`openui-lang\` — the renderer ONLY extracts code from those fences.

You can respond in three ways:
1. Plain text — for simple questions and conversation. No openui-lang.
2. Text + UI — explanation alongside an openui-lang fenced block.
3. UI only — when the user explicitly asks for a chart, table, form, or follow-up suggestions.

Use openui-lang when a visual would help: data visualization (charts, comparison tables), structured input collection (forms instead of plain-text question lists), follow-up suggestions, image carousels, multi-section reports. **Specifically: when the user is starting a multi-field workflow ("plan a trip", "set up X", "register for Y") and you need to collect destination/dates/budget/style/etc, render a Form with FormControls and a submit Button rather than a numbered bullet list of questions.** Don't generate UI for simple questions like "what time is it" or "explain X".

The chat-renderer surface is static: no Query/Mutation/$variables. If the user wants live data, refresh, or write operations, call \`app_create\` instead — that path uses the openui-creator skill.`;

// `inlineMode: true` would inject upstream's "## Inline Mode" block, which
// talks about patching existing UI — concept doesn't apply to chat replies
// (every assistant turn renders a fresh Card), and risks the agent emitting
// partial-statement responses that don't render. Our CHAT_PREAMBLE already
// covers fence-wrapping + when to use UI vs plain text, so we drop the flag.
//
// `bindings: false` suppresses the top-level Bindings section but the upstream
// component-signature builder still annotates props as `$binding<...>` —
// post-process to strip those so the agent doesn't think it can wire $vars
// into a Form whose state has nowhere to live.
const chatPromptRaw = openuiChatLibrary.prompt({
  ...openuiChatPromptOptions,
  preamble: CHAT_PREAMBLE,
  toolCalls: false,
  bindings: false,
  examples: openuiChatExamples,
  additionalRules: openuiChatAdditionalRules,
});

const chatPrompt = chatPromptRaw
  // `value?: $binding<string>` → `value?: string` on signatures.
  .replace(/\$binding<([^>]+)>/g, "$1")
  // Drop the "Props marked `$binding<type>` accept a `$variable` reference"
  // explainer line that the prompt builder always inserts.
  .replace(/\nProps marked `\$binding<type>` accept[^\n]*\n/g, "\n");

// `always: true` forces openclaw to inline this skill into every system
// prompt for Claw sessions. Without it, skills are read-on-demand and the
// model — left to its own judgment — almost always picks plain text over
// openui-lang for chart/table/comparison/form requests, which is the
// product's whole point. Chat-renderer is small (~6 KB), so always-loading
// it is worth the prompt-budget cost.
const CHAT_FRONTMATTER = `---
name: openui-chat-renderer
description: Render rich inline UI (tables, charts, follow-ups, lists, sections, forms, callouts) inside a chat reply using openui-lang fenced code. Use whenever the user asks for a chart/table/comparison/form/visualization or any answer that would benefit from structure. Static surface only — no live data, no $variables.
always: true
---

`;

writeFileSync(
  join(skillsDir, "openui-chat-renderer", "SKILL.md"),
  CHAT_FRONTMATTER + chatPrompt + "\n",
  "utf8",
);
console.log(`✓ skills/openui-chat-renderer/SKILL.md (${chatPrompt.length} chars)`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. openui-creator skill — durable apps with live data.
//    Full v0.5 surface: Query, Mutation, $variables, builtins, filters,
//    Action with @Run/@Set/@Reset, edit mode for incremental patches.
// ─────────────────────────────────────────────────────────────────────────────

const CREATOR_PREAMBLE = `You are about to create or edit a durable app using openui-lang. The app is persisted via \`app_create\` / \`app_update\` and runs independently after creation — the runtime calls tools directly on every refresh with no LLM in the loop.

Wrap openui-lang code in triple-backtick fences tagged \`openui-lang\` when you preview it inline; \`app_create\`/\`app_update\` themselves take RAW code (no fences) in the \`code\` / \`patch\` argument.

CRITICAL — Query tool name: The app runtime's \`toolProvider\` maps tool names directly to plugin handlers. Supported direct tool names are \`exec\`, \`read\`, \`db_query\`, and \`db_execute\`. Always use \`Query("exec", {command: "..."})\`, \`Query("read", ...)\`, \`Query("db_query", ...)\`, or \`Mutation("db_execute", ...)\` — never the \`tools_invoke\` wrapper.

Durable-object timing: call \`app_create\` or \`app_update\` as soon as the payload is ready. Do not wait for your final narrative paragraph before saving. After save succeeds, you can keep streaming explanation, follow-ups, or next steps in the same turn.

\`@Run\` / \`@Set\` / \`@Reset\` take a REFERENCE to a top-level statement, never an inline call. For per-row mutations, route the row id through a \`$state\`, then sequence \`@Set\` → \`@Run(mutationRef)\` → \`@Run(refreshQueryRef)\` in the button's Action.

Tables are COLUMN-oriented. \`Table([Col("Label", dataArray), Col("Count", countArray, "number")])\` — the second \`Col\` argument is data, not a type label.

Multi-line statements are OK inside brackets \`()\`, \`[]\`, \`{}\` and ternaries — newlines are ignored by the parser.`;

const creatorPrompt = openuiLibrary.prompt({
  ...openuiPromptOptions,
  preamble: CREATOR_PREAMBLE,
  toolCalls: true,
  bindings: true,
  editMode: true,
  inlineMode: true,
  examples: openuiExamples,
  additionalRules: openuiAdditionalRules,
});

const CREATOR_FRONTMATTER = `---
name: openui-creator
description: Create and edit durable apps and artifacts in the workspace using openui-lang Query/Mutation/$variables. Read BEFORE calling \`app_create\`, \`app_update\`, \`get_app\`, or \`create_markdown_artifact\`. Use when the user asks to build a dashboard, app, interactive view, or save a report/document.
---

`;

const CREATOR_WORKFLOW = `

---

## Plugin tools and workflow

Beyond the openui-lang surface above, this skill teaches the agent how to wire openui-lang into the Claw plugin's tool surface (\`app_create\`, \`app_update\`, \`get_app\`, \`create_markdown_artifact\`, \`exec\`, \`read\`, \`db_query\`, \`db_execute\`).

### Creating an app

1. Write the complete openui-lang code.
2. Call \`app_create({title, code})\` with the title and the full RAW code (no fences — \`app_create\` takes raw text).
3. Call \`app_create\` immediately once the code is ready. Do NOT wait for your final paragraph.

\`\`\`
app_create({title: "Sales Dashboard", code: "root = Stack([header, chart])\\nheader = CardHeader(\\"Sales\\")\\nchart = BarChart([\\"Q1\\",\\"Q2\\"], [Series(\\"Rev\\", [100, 200])])"})
\`\`\`

The app is stored in the Apps panel. The user can open, refine, and return to it later.

### Apps with live data — discover → script → generate

Follow these three steps in order. Do NOT skip straight to generating markup.

**Step 1: Discover data.** Use the \`exec\` tool to explore what's available:

\`\`\`
exec({command: "vm_stat"})
exec({command: "ps aux --sort=-%mem | head -10"})
exec({command: "df -h"})
\`\`\`

Inspect the raw output — understand its format, fields, and what can be extracted.

**System binaries — use absolute paths inside scripts.** The \`exec\` tool runs commands through \`/bin/sh\`, but apps run with a minimal sandbox PATH that often misses \`/usr/sbin\` (where macOS \`sysctl\`, \`netstat\`, \`pwd_mkdb\` live). When you \`write\` a script for an app, hard-code absolute paths for any system binary that isn't in \`/usr/bin\` or \`/bin\`:

- \`/usr/sbin/sysctl\` (NOT \`sysctl\`)
- \`/usr/sbin/netstat\`, \`/usr/sbin/lsof\`, \`/usr/sbin/ioreg\`
- \`/usr/local/bin/<tool>\` or \`/opt/homebrew/bin/<tool>\` for brew-installed tools

Rule of thumb: if you discovered the binary works in your interactive \`exec\` test but the app shows "command not found" on first refresh, it's a PATH-vs-script-environment mismatch — switch to an absolute path.

**Step 2: Write and save a data script.** Raw command output is rarely in a shape the UI can bind to directly. Write a self-contained script that:

- Calls the raw commands from step 1.
- Parses and transforms the output into clean JSON.
- Prints the JSON via \`console.log(JSON.stringify(...))\`.

Save with the \`write\` tool (preferred) or \`exec\`:

\`\`\`
write({path: "~/.openclaw/workspace/scripts/my-data.js", content: "const os = require('os');\\n..."})
\`\`\`

Then test:

\`\`\`
exec({command: "node ~/.openclaw/workspace/scripts/my-data.js"})
\`\`\`

Verify the output is valid JSON like \`{"totalGB":16.0,"freeGB":2.1,"pct":86.9}\`. Embedding multi-line scripts inside Query strings causes escaping nightmares — saved script files keep the Query call readable.

**Step 3: Generate the app.** Create openui-lang with \`Query()\` statements that call the saved script:

\`\`\`
data = Query("exec", {command: "node ~/.openclaw/workspace/scripts/my-data.js"}, {totalGB: 16.0, freeGB: 2.1, pct: 86.9}, 5)
\`\`\`

- First arg: tool name — always \`"exec"\` (or \`"read"\` for file reads).
- Second arg: args object passed directly to the tool — for exec, just \`{command: "..."}\`.
- Third arg: defaults — use the REAL JSON output from your step 2 test.
- Fourth arg: refresh interval in seconds.
- Access fields directly: \`data.fieldA\` — stdout is auto-parsed, no \`.result\` wrapper.

### Persistent app state (SQLite)

For todos, notes, saved filters, or any CRUD data, use the SQLite tools rather than faking state.

1. In the agent turn, call \`db_execute\` to create the schema.
2. In the app markup, use \`Query("db_query", ...)\` for reads.
3. Use \`Mutation("db_execute", ...)\` for writes.
4. Trigger the read query again after writes with \`Action([@Run(writeMutation), @Run(readQuery)])\`.

\`\`\`
db_execute({sql: "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)", namespace: "todos"})
\`\`\`

\`\`\`openui-lang
$text = ""
todos = Query("db_query", {sql: "SELECT id, text, done, created_at FROM todos ORDER BY created_at DESC", namespace: "todos"}, {rows: []}, 5)
createTodo = Mutation("db_execute", {sql: "INSERT INTO todos (text) VALUES ($text)", params: {text: $text}, namespace: "todos"})
addButton = Button("Add", Action([@Run(createTodo), @Run(todos), @Reset($text)]))
\`\`\`

- \`db_query\` returns \`{namespace, rows: [...]}\`.
- \`db_execute\` returns \`{namespace, changes, lastInsertRowid}\`.
- Use the same \`namespace\` across setup, reads, and writes for one app.
- Prefer SQL parameters over string interpolation for user input.

### Editing apps (refine flow)

When the user wants to change an existing app — including the in-app "Refine" button which prefills the chat composer with \`Refine app "<title>" (id: <id>): ...\` — follow this pattern:

1. Call \`get_app({id: "..."})\` to see the current code.
2. Identify what needs to change.
3. Call \`app_update({id: "...", patch: "chart = LineChart(...)..."})\` with ONLY the changed/new statements.

The runtime merges by statement name:
- Same name → replaced.
- New name → added.
- Missing from patch → kept unchanged.

A typical edit is 1-5 statements. NEVER output the entire program as a patch. The lint loop returns \`validationErrors\` when rules are violated; when you see them, call \`app_update\` again with ONLY the corrected statements.

### Manual refresh buttons

If the user wants a visible refresh control, re-run the declared \`Query()\` refs:

\`\`\`openui-lang
refreshBtn = Button("↻ Refresh", Action([@Run(overview), @Run(procs)]), "secondary", "normal", "small")
\`\`\`

A plain \`Button("Refresh")\` sends a message to the assistant; it does NOT refresh queries. Manual refresh always targets declared query refs via \`@Run(queryRef)\`.

### Scheduled updates (cron-driven apps)

A cron's prompt is its ONLY context at fire time — no session memory. Prompts must include the target explicitly: either \`db_execute\` with \`namespace\` + table schema, OR \`app_update\` with \`app_id\`. Prefer DB writes for recurring data; \`app_update\` only when the layout shape changes.

### Creating artifacts

When the user wants a report, document, summary, or reference material saved:

\`\`\`
create_markdown_artifact({title: "Q1 Report", content: "# Q1 Report\\n\\n## Revenue\\n..."})
\`\`\`

Call \`create_markdown_artifact\` as soon as the content is ready so the artifact appears during the run, not only after your final paragraph.

### When to use what

- **Inline UI** (fenced \`openui-lang\` via the openui-chat-renderer skill) — quick visualizations, previews, one-off charts.
- **App** (\`app_create\`) — dashboards, tools, forms the user will return to. Persistent.
- **Artifact** (\`create_markdown_artifact\`) — reports, summaries, documents. Persistent.
- **Plain text** — questions, explanations, conversation.
`;

writeFileSync(
  join(skillsDir, "openui-creator", "SKILL.md"),
  CREATOR_FRONTMATTER + creatorPrompt + CREATOR_WORKFLOW,
  "utf8",
);
console.log(`✓ skills/openui-creator/SKILL.md (${creatorPrompt.length} chars + workflow)`);

// ─────────────────────────────────────────────────────────────────────────────
// 3. openui-schema.json — drives the runtime lint loop in lint-openui.ts.
//    Was previously a TS module wrapping a giant JSON.stringify with a triple
//    cast; JSON is the natural shape, parsed at import time by the bundler.
// ─────────────────────────────────────────────────────────────────────────────

const librarySchema = openuiLibrary.toJSONSchema();
const componentNames = Object.keys(librarySchema.$defs ?? {});

writeFileSync(
  join(generatedDir, "openui-schema.json"),
  JSON.stringify({ schema: librarySchema, componentNames }, null, 2),
  "utf8",
);
console.log(`✓ src/generated/openui-schema.json (${componentNames.length} components)`);
