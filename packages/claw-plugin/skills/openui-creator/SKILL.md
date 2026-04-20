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

> **CRITICAL — Query tool name:** The app runtime's `toolProvider` maps tool names directly to plugin handlers. Supported direct tool names are `exec`, `read`, `db_query`, and `db_execute`. Always use `Query("exec", {command: "..."})`, `Query("read", {...})`, `Query("db_query", {...})`, or `Mutation("db_execute", {...})` directly — **never** `Query("tools_invoke", {tool_name: "...", ...})`. The `tools_invoke` wrapper is for the agent's own tool calls, not for `Query()` or `Mutation()` in app markup.

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
- For multiple data sources, save multiple scripts and create multiple `Query()` statements
- NEVER hardcode data that a script can provide — everything must flow through `Query()`

#### Manual refresh buttons

If the user wants a visible refresh control, re-run the declared `Query()` refs with `Action([@Run(...)])`:

```openui-lang
refreshBtn = Button("↻ Refresh", Action([@Run(overview), @Run(procs)]), "secondary", "normal", "small")
```

- Do NOT emit custom refresh actions like `{type: "refresh"}` or `{type: "refresh_data"}`.
- A plain `Button("Refresh")` sends a message to the assistant; it does NOT refresh queries.
- Manual refresh always targets declared query refs via `@Run(queryRef)`.

#### Tables are column-oriented

`Table()` takes a single array of `Col(...)` definitions. Each `Col` holds the data for one column.

```openui-lang
procsTable = Table([
  Col("Process", procs.procs.name),
  Col("PID", procs.procs.pid),
  Col("CPU %", procs.procs.cpu, "number"),
  Col("Mem %", procs.procs.mem, "number"),
  Col("User", procs.procs.user)
])
```

- Do NOT emit row-based tables like `Table(columns, rows)` in new app code.
- The second `Col(...)` arg is the column data array, not a type label. `Col("Process", "string")` is wrong unless the literal text `"string"` is meant to render in every row.
- For query results, prefer array pluck (`data.rows.field`) over constructing row arrays manually.

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

### Persistent App State (DB-backed apps)

For apps that need durable state like todos, notes, saved filters, or simple CRUD data, use the built-in SQLite tools instead of faking state in markdown or local variables.

#### Setup workflow

1. In the agent turn, call `db_execute` to create the schema.
2. In the app markup, use `Query("db_query", ...)` for reads.
3. Use `Mutation("db_execute", ...)` for writes.
4. Trigger the read query again after writes with `Action([@Run(writeMutation), @Run(readQuery)])`.

Example setup tool call:

```
db_execute({sql: "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)", namespace: "todos"})
```

Example app pattern:

```openui-lang
$text = ""
todos = Query("db_query", {sql: "SELECT id, text, done, created_at FROM todos ORDER BY created_at DESC", namespace: "todos"}, {rows: []}, 5)
createTodo = Mutation("db_execute", {sql: "INSERT INTO todos (text) VALUES ($text)", params: {text: $text}, namespace: "todos"})
addButton = Button("Add", Action([@Run(createTodo), @Run(todos), @Reset($text)]))
```

Notes:
- `db_query` returns `{namespace, rows: [...]}`.
- `db_execute` returns `{namespace, changes, lastInsertRowid}`.
- Use the same `namespace` across setup, reads, and writes for one app.
- Prefer SQL parameters over string interpolation for user input.

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
