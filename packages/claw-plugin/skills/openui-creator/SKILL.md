---
name: openui-creator
description: Create and edit durable apps and artifacts in the workspace. Use when the user asks to build a dashboard, app, interactive view, or save a document/report.
---

## IMPORTANT: Fencing

Always wrap openui-lang code in triple-backtick fences tagged `openui-lang`. The renderer ONLY extracts code from `openui-lang` fences — unfenced code or code with other language tags (```js, ```text, etc.) will NOT render.

## Creating Apps

When the user asks to build a dashboard, app, or interactive view:

1. Write the complete openui-lang code
2. Call `app_create` with the title and the full code (without fences — app_create takes raw code)
3. Call `app_create` immediately once the code is ready. Do NOT wait until the end of your answer to persist it.

```
app_create({title: "Sales Dashboard", code: "root = Stack([header, chart])\nheader = CardHeader(\"Sales\")\nchart = BarChart([\"Q1\",\"Q2\"], [Series(\"Rev\", [100, 200])])"})
```

The app is stored in the Apps panel. The user can open, refine, and return to it later. After the tool call succeeds, you can keep streaming explanation or follow-up guidance in the same turn.

### Apps with Live Data

You have access to the host system via the `exec` tool. Apps run independently after creation — the runtime calls tools directly on every refresh with no LLM involved.

> **CRITICAL — Query tool name:** The app runtime's `toolProvider` maps tool names directly to plugin handlers. Only `exec` and `read` are supported. Always use `Query("exec", {command: "..."})` — **never** `Query("tools_invoke", {tool_name: "exec", ...})`. The `tools_invoke` wrapper is for the agent's own tool calls, not for `Query()` in app markup.

#### Workflow: Discover → Script → Generate

Follow these three steps in order. Do NOT skip straight to generating markup.

**Step 1: Discover data**

Before writing any markup, explore what data is available using the `exec` tool. Run commands to see what the system has:

```
exec({command: "vm_stat"})
exec({command: "ps aux --sort=-%mem | head -10"})
exec({command: "df -h"})
```

Inspect the raw output — understand its format, fields, and what can be extracted.

**Step 2: Write and save a data script**

Raw command output is rarely in a shape the UI can bind to directly. Write a self-contained script file that:
- Calls the raw commands from step 1
- Parses and transforms the output into clean JSON
- Prints the JSON to stdout via `console.log(JSON.stringify(...))`

Save the script to the workspace using the `write` tool (preferred) or `exec`:

```
write({path: "~/.openclaw/workspace/scripts/my-data.js", content: "const os = require('os');\n..."})
```

Then test it:
```
exec({command: "node ~/.openclaw/workspace/scripts/my-data.js"})
```

Verify the output is valid JSON like `{"totalGB":16.0,"freeGB":2.1,"pct":86.9}`.

**Why script files?** Embedding multi-line scripts inside Query strings causes escaping nightmares (`\"`, `\\\\`, `\n`). A saved script file is readable, editable, and the Query call stays clean.

**Step 3: Generate the app**

Create the openui-lang app with `Query()` statements that call the saved script:

```
data = Query("exec", {command: "node ~/.openclaw/workspace/scripts/my-data.js"}, {totalGB: 16.0, freeGB: 2.1, pct: 86.9}, 5)
```

- First arg: tool name — always `"exec"` (or `"read"` for file reads)
- Second arg: args object passed directly to the tool — for exec, just `{command: "..."}`
- Third arg: defaults — use the REAL JSON output from your test in step 2
- Fourth arg: refresh interval in seconds

- Access fields directly: `data.fieldA`, `data.fieldB` (no `.result` wrapper — stdout is auto-parsed)
- Third arg is defaults — use the REAL JSON output from your test in step 2
- Fourth arg is refresh interval in seconds
- For multiple data sources, save multiple scripts and create multiple `Query()` statements
- NEVER hardcode data that a script can provide — everything must flow through `Query()`

### Built-in Functions

Use `@`-prefixed functions on Query results:

- `@Count(array)`, `@Sum(numbers[])`, `@Avg(numbers[])`, `@Min`, `@Max`, `@Round(n, decimals?)`
- `@Sort(array, field, direction?)`, `@Filter(array, field, op, value)`
- `@Each(array, varName, template)` — loop rendering (inline only)
- Array pluck: `data.rows.field` extracts a field from every row

### Reactive Filters

```
$days = "14"
filter = FormControl("Period", Select("days", [SelectItem("7", "7 days"), SelectItem("14", "14 days"), SelectItem("30", "30 days")], null, null, $days))
data = Query("exec", {command: "node -e '...script using " + $days + "...' "}, {rows: []}, 30)
```

When the user changes the Select, `$days` updates and the Query re-fetches automatically.

### 1D Charts — Use Flat Arrays

For PieChart, RadialChart, and SingleStackedBarChart, use flat arrays (NOT Slice sub-components):

```
memChart = PieChart(["Used", "Free"], [data.usedGB, data.freeGB], "donut")
```

## Editing Apps

When the user wants to change an existing app:

1. Call `get_app({id: "..."})` to see the current code
2. Identify what needs to change
3. Call `app_update({id: "...", patch: "chart = LineChart(...)..."})` with ONLY the changed/new statements

The runtime merges by statement name:
- Same name → replaced
- New name → added
- Missing from patch → kept unchanged

A typical edit is 1-5 statements. Do NOT output the entire program.

## Creating Artifacts

When the user wants a report, document, summary, or reference material saved:

```
create_markdown_artifact({title: "Q1 Report", content: "# Q1 Report\n\n## Revenue\n..."})
```

Call `create_markdown_artifact` as soon as the content is ready so the artifact appears during the run, not only after your response is done.

Artifacts are stored in the Artifacts panel. Use for anything that isn't an interactive app.

## When to Use What

- **Inline UI** (fenced `openui-lang` in chat) — quick visualizations, previews, one-off charts
- **App** (`app_create`) — dashboards, tools, forms the user will return to. Persistent.
- **Artifact** (`create_markdown_artifact`) — reports, summaries, documents. Persistent.
- **Plain text** — questions, explanations, conversation
