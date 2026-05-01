---
name: openui-creator
description: Create and edit durable apps and artifacts in the workspace using openui-lang Query/Mutation/$variables. Read BEFORE calling `app_create`, `app_update`, `get_app`, or `create_markdown_artifact`. Use when the user asks to build a dashboard, app, interactive view, or save a report/document.
---

You are about to create or edit a durable app using openui-lang. The app is persisted via `app_create` / `app_update` and runs independently after creation — the runtime calls tools directly on every refresh with no LLM in the loop.

Wrap openui-lang code in triple-backtick fences tagged `openui-lang` when you preview it inline; `app_create`/`app_update` themselves take RAW code (no fences) in the `code` / `patch` argument.

CRITICAL — Query tool name: The app runtime's `toolProvider` maps tool names directly to plugin handlers. Supported direct tool names are `exec`, `read`, `db_query`, and `db_execute`. Always use `Query("exec", {command: "..."})`, `Query("read", ...)`, `Query("db_query", ...)`, or `Mutation("db_execute", ...)` — never the `tools_invoke` wrapper. **DO NOT invent other tool names.** There is no "fetch", "api", "http", "search", or "invoke" tool.

For KPIs on large or complex datasets, prefer SQL aggregation in a `Query("db_query", {sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active ..."})` over many `@Count/@Sum/@Filter` chains in the UI. Use `@First(query.rows)` to unwrap single-row aggregate results.

Durable-object timing: call `app_create` or `app_update` as soon as the payload is ready. Do not wait for your final narrative paragraph before saving. After save succeeds, you can keep streaming explanation, follow-ups, or next steps in the same turn.

`@Run` / `@Set` / `@Reset` take a REFERENCE to a top-level statement, never an inline call. For per-row mutations, route the row id through a `$state`, then sequence `@Set` → `@Run(mutationRef)` → `@Run(refreshQueryRef)` in the button's Action.

Tables are COLUMN-oriented. `Table([Col("Label", dataArray), Col("Count", countArray, "number")])` — the second `Col` argument is data, not a type label.

Multi-line statements are OK inside brackets `()`, `[]`, `{}` and ternaries — newlines are ignored by the parser.

## Structured Workflow (follow this order)

Before writing any app code, follow these 5 steps:

1. **PLAN the data model.** What tables/queries do you need? What mutations? Do any mutations depend on each other (e.g. need last_insert_rowid from a prior insert)? If yes, redesign — each @Run(mutation) is a SEPARATE DB call with no shared transaction.

2. **TEST the data pipeline.** Run the actual commands/queries with `exec` or `db_query`. Get the real JSON shape. Verify the output is valid JSON. If writing a script, save it with `write`, then run it with `exec` and confirm it works. **Test with ALL parameter combinations** — empty data, error cases, missing fields. The app runtime has NO feedback loop; broken scripts show blank data silently.

3. **DESIGN the layout.** Pick the right component for each data type:
   - 2-4 summary metrics → KPI Card grid (Stack row, max 3 cards per row)
   - List of 4+ items with comparable fields → Table (NOT cards)
   - Time series → LineChart / AreaChart
   - Proportions / breakdown → PieChart (flat arrays!) or donut
   - Category comparison → BarChart / HorizontalBarChart
   - External links in data → @OpenUrl (NOT @ToAssistant)

   **Modal check:** add a Modal drill-down ONLY when the row has data the Table can't show, OR an action that needs more than one click. If the Modal would just re-display the same columns, skip it. (Full criteria: see "When to add a Table + Modal drill-down" below.)

4. **WIRE interactivity.** For each interactive element:
   - Filters: $binding → Select → pass $binding in Query args (EVERY relevant Query must reference it)
   - Per-row actions: $state variable + top-level Mutation + @Set($state, row.id) → @Run(mutation)
   - Forms: $bindings on fields used in Mutations, @Reset after submit
   - **Enrichment check:** Does the data need AI classification, triage, sentiment analysis, or draft generation? If yes → do NOT write naive keyword heuristics in a script. Use the **cron agentTurn → DB → app** pattern: a cron job runs an LLM agent that analyzes data and writes enriched results to SQLite, and the app reads from the DB. See the Agent-enriched apps section below.

5. **BUILD the app.** Write root = Stack(...) FIRST for streaming, then components.

## Syntax Rules

1. Each statement is on its own line: `identifier = Expression`
2. `root` is the entry point — every program must define `root = Stack(...)`
3. Expressions are: strings ("..."), numbers, booleans (true/false), null, arrays ([...]), objects ({...}), or component calls TypeName(arg1, arg2, ...)
4. Use references for readability: define `name = ...` on one line, then use `name` later
5. EVERY variable (except root) MUST be referenced by at least one other variable. Unreferenced variables are silently dropped and will NOT render. Always include defined variables in their parent's children/items array.
6. Arguments are POSITIONAL (order matters, not names). Write `Stack([children], "row", "l")` NOT `Stack([children], direction: "row", gap: "l")` — colon syntax is NOT supported and silently breaks
7. Optional arguments can be omitted from the end
8. Declare mutable state with `$varName = defaultValue`. Components marked with `$binding` can read/write these. Undeclared $variables are auto-created with null default.
9. String concatenation: `"text" + $var + "more"`
10. Dot member access: `query.field` reads a field; on arrays it extracts that field from every element
11. Index access: `arr[0]`, `data[index]`
12. Arithmetic operators: +, -, *, /, % (work on numbers; + is string concat when either side is a string)
13. Comparison: ==, !=, >, <, >=, <=
14. Logical: &&, ||, ! (prefix)
15. Ternary: `condition ? valueIfTrue : valueIfFalse`
16. Parentheses for grouping: `(a + b) * c`
- Strings use double quotes with backslash escaping
17. Line comments: `//` is stripped by the parser. Use to annotate sections in large apps.
```
// KPI section
kpiRow = Stack([kpi1, kpi2, kpi3], "row", "m", "stretch")
```
18. Computed values: any expression can be assigned to a variable and reused. This works with query-derived data, $reactive variables, and @-functions.
```
totalEngagement = data.likes + data.retweets + data.replies
engagementRate = @Round(totalEngagement * 100 / data.views, 2)
avgWeekly = @Round(@Avg(npm.packages.weekly), 0)
```

## Component Signatures

Arguments marked with ? are optional. Sub-components can be inline or referenced; prefer references for better streaming.
Props typed `ActionExpression` accept an Action([@steps...]) expression. See the Action section for available steps (@Run, @ToAssistant, @OpenUrl, @Set, @Reset).
Props marked `$binding<type>` accept a `$variable` reference for two-way binding.

### Layout
Stack(children: any[], direction?: "row" | "column", gap?: "none" | "xs" | "s" | "m" | "l" | "xl" | "2xl", align?: "start" | "center" | "end" | "stretch" | "baseline", justify?: "start" | "center" | "end" | "between" | "around" | "evenly", wrap?: boolean) — Flex container. direction: "row"|"column" (default "column"). gap: "none"|"xs"|"s"|"m"|"l"|"xl"|"2xl" (default "m"). align: "start"|"center"|"end"|"stretch"|"baseline". justify: "start"|"center"|"end"|"between"|"around"|"evenly".
Tabs(items: TabItem[]) — Tabbed container
TabItem(value: string, trigger: string, content: (TextContent | MarkDownRenderer | CardHeader | Callout | TextCallout | CodeBlock | Image | ImageBlock | ImageGallery | Separator | HorizontalBarChart | RadarChart | PieChart | RadialChart | SingleStackedBarChart | ScatterChart | AreaChart | BarChart | LineChart | Table | TagBlock | Form | Buttons | Steps)[]) — value is unique id, trigger is tab label, content is array of components
Accordion(items: AccordionItem[]) — Collapsible sections
AccordionItem(value: string, trigger: string, content: (TextContent | MarkDownRenderer | CardHeader | Callout | TextCallout | CodeBlock | Image | ImageBlock | ImageGallery | Separator | HorizontalBarChart | RadarChart | PieChart | RadialChart | SingleStackedBarChart | ScatterChart | AreaChart | BarChart | LineChart | Table | TagBlock | Form | Buttons | Steps)[]) — value is unique id, trigger is section title
Steps(items: StepsItem[]) — Step-by-step guide
StepsItem(title: string, details: string) — title and details text for one step
Carousel(children: (TextContent | MarkDownRenderer | CardHeader | Callout | TextCallout | CodeBlock | Image | ImageBlock | ImageGallery | Separator | HorizontalBarChart | RadarChart | PieChart | RadialChart | SingleStackedBarChart | ScatterChart | AreaChart | BarChart | LineChart | Table | TagBlock | Form | Buttons | Steps)[][], variant?: "card" | "sunk") — Horizontal scrollable carousel
Separator(orientation?: "horizontal" | "vertical", decorative?: boolean) — Visual divider between content sections
Modal(title: string, open?: $binding<boolean>, children: (TextContent | MarkDownRenderer | CardHeader | Callout | TextCallout | CodeBlock | Image | ImageBlock | ImageGallery | Separator | HorizontalBarChart | RadarChart | PieChart | RadialChart | SingleStackedBarChart | ScatterChart | AreaChart | BarChart | LineChart | Table | TagBlock | Form | Buttons | Steps)[], size?: "sm" | "md" | "lg") — Modal dialog. open is a reactive $boolean binding — set to true to open, X/Escape/backdrop auto-closes. Put Form with buttons inside children.
- For grid-like layouts, use Stack with direction "row" and wrap set to true.
- Prefer justify "start" (or omit justify) with wrap=true for stable columns instead of uneven gutters.
- Use nested Stacks when you need explicit rows/sections.
- Show/hide sections: $editId != "" ? Card([editForm]) : null
- Modal: Modal("Title", $showModal, [content]) — $showModal is boolean, X/Escape auto-closes. Put Form with its own buttons inside children.
- Use Tabs for alternative views (chart types, data sections) — no $variable needed
- Shared filter across Tabs: same $days binding in Query args works across all TabItems

### Content
Card(children: (TextContent | MarkDownRenderer | CardHeader | Callout | TextCallout | CodeBlock | Image | ImageBlock | ImageGallery | Separator | HorizontalBarChart | RadarChart | PieChart | RadialChart | SingleStackedBarChart | ScatterChart | AreaChart | BarChart | LineChart | Table | TagBlock | Form | Buttons | Steps | Tabs | Carousel | Stack)[], variant?: "card" | "sunk" | "clear", direction?: "row" | "column", gap?: "none" | "xs" | "s" | "m" | "l" | "xl" | "2xl", align?: "start" | "center" | "end" | "stretch" | "baseline", justify?: "start" | "center" | "end" | "between" | "around" | "evenly", wrap?: boolean) — Styled container. variant: "card" (default, elevated) | "sunk" (recessed) | "clear" (transparent). Always full width. Accepts all Stack flex params (default: direction "column"). Cards flex to share space in row/wrap layouts.
CardHeader(title?: string, subtitle?: string) — Header with optional title and subtitle
TextContent(text: string, size?: "small" | "default" | "large" | "small-heavy" | "large-heavy") — Text block. Supports markdown. Optional size: "small" | "default" | "large" | "small-heavy" | "large-heavy".
MarkDownRenderer(textMarkdown: string, variant?: "clear" | "card" | "sunk") — Renders markdown text with optional container variant
Callout(variant: "info" | "warning" | "error" | "success" | "neutral", title: string, description: string, visible?: $binding<boolean>) — Callout banner. Optional visible is a reactive $boolean — auto-dismisses after 3s by setting $visible to false.
TextCallout(variant?: "neutral" | "info" | "warning" | "success" | "danger", title?: string, description?: string) — Text callout with variant, title, and description
Image(alt: string, src?: string) — Image with alt text and optional URL
ImageBlock(src: string, alt?: string) — Image block with loading state
ImageGallery(images: {src: string, alt?: string, details?: string}[]) — Gallery grid of images with modal preview
CodeBlock(language: string, codeString: string) — Syntax-highlighted code block
- Use Cards to group related KPIs or sections. Stack with direction "row" for side-by-side layouts.
- Success toast: Callout("success", "Saved", "Done.", $showSuccess) — use @Set($showSuccess, true) in save action, auto-dismisses after 3s. For errors: result.status == "error" ? Callout("error", "Failed", result.error) : null
- KPI card: Card([TextContent("Label", "small"), TextContent("" + @Count(@Filter(data.rows, "field", "==", "value")), "large-heavy")])

### Tables
Table(columns: Col[]) — Data table — column-oriented. Each Col holds its own data array.
Col(label: string, data: any, type?: "string" | "number" | "action") — Column definition — holds label + data array
- Table is COLUMN-oriented: Table([Col("Label", dataArray), Col("Count", countArray, "number")]). Use array pluck for data: data.rows.fieldName
- Col data can be component arrays for styled cells: Col("Status", @Each(data.rows, "item", Tag(item.status, null, "sm", item.status == "open" ? "success" : "danger")))
- Row actions: Col("Actions", @Each(data.rows, "t", Button("Edit", Action([@Set($showEdit, true), @Set($editId, t.id)]))))
- Sortable: sorted = @Sort(data.rows, $sortField, "desc"). Bind $sortField to Select. Use sorted.fieldName for Col data
- Searchable: filtered = @Filter(data.rows, "title", "contains", $search). Bind $search to Input
- Chain sort + filter: filtered = @Filter(...) then sorted = @Sort(filtered, ...) — use sorted for both Table and Charts
- Empty state: @Count(data.rows) > 0 ? Table([...]) : TextContent("No data yet")

### Charts (2D)
BarChart(labels: string[], series: Series[], variant?: "grouped" | "stacked", xLabel?: string, yLabel?: string) — Vertical bars; use for comparing values across categories with one or more series
LineChart(labels: string[], series: Series[], variant?: "linear" | "natural" | "step", xLabel?: string, yLabel?: string) — Lines over categories; use for trends and continuous data over time
AreaChart(labels: string[], series: Series[], variant?: "linear" | "natural" | "step", xLabel?: string, yLabel?: string) — Filled area under lines; use for cumulative totals or volume trends over time
RadarChart(labels: string[], series: Series[]) — Spider/web chart; use for comparing multiple variables across one or more entities
HorizontalBarChart(labels: string[], series: Series[], variant?: "grouped" | "stacked", xLabel?: string, yLabel?: string) — Horizontal bars; prefer when category labels are long or for ranked lists
Series(category: string, values: number[]) — One data series
- Charts accept column arrays: LineChart(labels, [Series("Name", values)]). Use array pluck: LineChart(data.rows.day, [Series("Views", data.rows.views)])
- Use Cards to wrap charts with CardHeader for titled sections
- Chart + Table from same source: use @Sort or @Filter result for both LineChart and Table Col data
- Multiple chart views: use Tabs — Tabs([TabItem("line", "Line", [LineChart(...)]), TabItem("bar", "Bar", [BarChart(...)])])

### Charts (1D)
PieChart(labels: string[], values: number[], variant?: "pie" | "donut") — Circular slices; use plucked arrays: PieChart(data.categories, data.values)
RadialChart(labels: string[], values: number[]) — Radial bars; use plucked arrays: RadialChart(data.categories, data.values)
SingleStackedBarChart(labels: string[], values: number[]) — Single horizontal stacked bar; use plucked arrays: SingleStackedBarChart(data.categories, data.values)
Slice(category: string, value: number) — One slice with label and numeric value
- PieChart and BarChart need NUMBERS, not objects. For list data, use @Count(@Filter(...)) to aggregate:
- PieChart from list: `PieChart(["Low", "Med", "High"], [@Count(@Filter(data.rows, "priority", "==", "low")), @Count(@Filter(data.rows, "priority", "==", "medium")), @Count(@Filter(data.rows, "priority", "==", "high"))], "donut")`
- KPI from count: `TextContent("" + @Count(@Filter(data.rows, "status", "==", "open")), "large-heavy")`

### Charts (Scatter)
ScatterChart(datasets: ScatterSeries[], xLabel?: string, yLabel?: string) — X/Y scatter plot; use for correlations, distributions, and clustering
ScatterSeries(name: string, points: Point[]) — Named dataset
Point(x: number, y: number, z?: number) — Data point with numeric coordinates

### Forms
Form(name: string, buttons: Buttons, fields?: FormControl[]) — Form container with fields and explicit action buttons
FormControl(label: string, input: Input | TextArea | Select | DatePicker | Slider | CheckBoxGroup | RadioGroup, hint?: string) — Field with label, input component, and optional hint text
Label(text: string) — Text label
Input(name: string, placeholder?: string, type?: "text" | "email" | "password" | "number" | "url", rules?: {required?: boolean, email?: boolean, url?: boolean, numeric?: boolean, min?: number, max?: number, minLength?: number, maxLength?: number, pattern?: string}, value?: $binding<string>)
TextArea(name: string, placeholder?: string, rows?: number, rules?: {required?: boolean, email?: boolean, url?: boolean, numeric?: boolean, min?: number, max?: number, minLength?: number, maxLength?: number, pattern?: string}, value?: $binding<string>)
Select(name: string, items: SelectItem[], placeholder?: string, rules?: {required?: boolean, email?: boolean, url?: boolean, numeric?: boolean, min?: number, max?: number, minLength?: number, maxLength?: number, pattern?: string}, value?: $binding<string>)
SelectItem(value: string, label: string) — Option for Select
DatePicker(name: string, mode?: "single" | "range", rules?: {required?: boolean, email?: boolean, url?: boolean, numeric?: boolean, min?: number, max?: number, minLength?: number, maxLength?: number, pattern?: string}, value?: $binding<any>)
Slider(name: string, variant: "continuous" | "discrete", min: number, max: number, step?: number, defaultValue?: number[], label?: string, rules?: {required?: boolean, email?: boolean, url?: boolean, numeric?: boolean, min?: number, max?: number, minLength?: number, maxLength?: number, pattern?: string}, value?: $binding<number[]>) — Numeric slider input; supports continuous and discrete (stepped) variants
CheckBoxGroup(name: string, items: CheckBoxItem[], rules?: {required?: boolean, email?: boolean, url?: boolean, numeric?: boolean, min?: number, max?: number, minLength?: number, maxLength?: number, pattern?: string}, value?: $binding<Record<string, boolean>>)
CheckBoxItem(label: string, description: string, name: string, defaultChecked?: boolean)
RadioGroup(name: string, items: RadioItem[], defaultValue?: string, rules?: {required?: boolean, email?: boolean, url?: boolean, numeric?: boolean, min?: number, max?: number, minLength?: number, maxLength?: number, pattern?: string}, value?: $binding<string>)
RadioItem(label: string, description: string, value: string)
SwitchGroup(name: string, items: SwitchItem[], variant?: "clear" | "card" | "sunk", value?: $binding<Record<string, boolean>>) — Group of switch toggles
SwitchItem(label?: string, description?: string, name: string, defaultChecked?: boolean) — Individual switch toggle
- For Form fields, define EACH FormControl as its own reference — do NOT inline all controls in one array. This allows progressive field-by-field streaming.
- NEVER nest Form inside Form — each Form should be a standalone container.
- Form requires explicit buttons. Always pass a Buttons(...) reference as the third Form argument.
- rules is an optional object: {required: true, email: true, minLength: 8, maxLength: 100}
- Available rules: required, email, min, max, minLength, maxLength, pattern, url, numeric
- The renderer shows error messages automatically — do NOT generate error text in the UI
- Conditional fields: $country == "US" ? stateField : $country == "UK" ? postcodeField : addressField
- Edit form in Modal: Modal("Edit", $showEdit, [Form("edit", Buttons([saveBtn, cancelBtn]), [fields...])]). Save button should include @Set($showEdit, false) to close modal.

### Buttons
Button(label: string, action?: ActionExpression, variant?: "primary" | "secondary" | "tertiary", type?: "normal" | "destructive", size?: "extra-small" | "small" | "medium" | "large") — Clickable button
Buttons(buttons: Button[], direction?: "row" | "column") — Group of Button components. direction: "row" (default) | "column".
- Toggle in @Each: @Each(rows, "t", Button(t.status == "open" ? "Close" : "Reopen", Action([...])))

### Data Display
TagBlock(tags: string[]) — tags is an array of strings
Tag(text: string, icon?: string, size?: "sm" | "md" | "lg", variant?: "neutral" | "info" | "success" | "warning" | "danger") — Styled tag/badge with optional icon and variant
- Color-mapped Tag: Tag(value, null, "sm", value == "high" ? "danger" : value == "medium" ? "warning" : "neutral")

## Layout Decision Matrix

**Choose the right component for your data:**
- **KPI summary (2-4 metrics):** `Stack([Card([TextContent("Label", "small"), TextContent(value, "large-heavy")], "sunk"), ...], "row", "m", "stretch")` — max 3 Cards per row
- **Data list (4+ items, comparable fields):** `Table([Col(...), Col(...)])` with @Each for styled cells (Tag, Button). Add a Modal drill-down only when criteria below are met.
- **Feed (chronological items with actions):** Stack column of Cards via @Each, each card has action Buttons
- **Category breakdown:** PieChart (flat arrays!) or HorizontalBarChart
- **Trend over time:** LineChart or AreaChart
- **Comparison across categories:** BarChart (grouped or stacked)
- **Multi-dimension comparison:** RadarChart

**Table + Modal detail pattern (most common for dashboards):**
```
$selectedId = ""
$showDetail = false
table = Table([
  Col("Name", data.rows.name),
  Col("Status", @Each(data.rows, "r", Tag(r.status, null, "sm", r.status == "active" ? "success" : "danger"))),
  Col("", @Each(data.rows, "r", Button("Details", Action([@Set($selectedId, "" + r.id), @Set($showDetail, true)]), "secondary", "normal", "extra-small")))
])
selected = @First(@Filter(data.rows, "id", "==", $selectedId))
detail = Modal("Details", $showDetail, [
  CardHeader(selected.name),
  MarkDownRenderer(selected.description),
  Buttons([Button("Open ↗", Action([@OpenUrl(selected.url)]), "primary"), Button("Close", Action([@Set($showDetail, false)]), "secondary")])
], "md")
```

**Conditional Tag coloring (use for status/priority/severity):**
`Tag(item.priority, null, "sm", item.priority == "urgent" ? "danger" : item.priority == "high" ? "warning" : item.priority == "medium" ? "info" : "neutral")`

**Conditional alert bar (war room / command center pattern):**
Show alerts at the top of the dashboard that change based on live data:
```
activeIncidents = @Filter(incidents, "status", "!=", "resolved")
alertBar = @Count(activeIncidents) > 0 ? Callout("warning", "🔥 " + @Count(activeIncidents) + " Active Incident(s)", @First(activeIncidents).title) : Callout("success", "✅ All Clear", "No active incidents")
root = Stack([header, alertBar, kpiRow, tabs])
```
Place alertBar between header and KPI row. Use Callout (auto-dismissable) or TextCallout (persistent) depending on urgency.

**Null-safe display (handle loading/missing data gracefully):**
```
TextContent(gh.stars ? "" + gh.stars : "—", "large-heavy")
@Count(data.rows) > 0 ? Table([...]) : TextContent("No data yet", "small")
@Count(trend) > 1 ? AreaChart(trend.day, [Series("Views", trend.count)]) : Callout("info", "Building history…", "More data points needed.")
```
Always guard charts that need 2+ data points. Use `"—"` as fallback for KPI values.

**When to add a Table + Modal drill-down:**
Add a Modal ONLY when the row has data the table can't show, OR an action that needs more than one click. If the modal would just re-display the same columns in a popup, skip it — that's decoration, not value.

Add a Modal when:
- Row has long-form content the cell truncates (full tweet text, agent diagnosis, PR description, email body)
- Row needs multiple actions in sequence (Draft Reply → Edit → Send; Acknowledge → Assign → Resolve)
- Row has nested data (timeline, related items, sub-tickets) that doesn't fit a column

Skip the Modal when:
- The table already shows everything (id, title, status, date) and the only action is "open URL" → just put a `Button("↗", Action([@OpenUrl(row.url)]))` in the last Col
- The user only ever wants to navigate away (use `@OpenUrl` directly)

**Rich KPI cards with sub-indicators:**
```
kpiPRs = Card([TextContent("Open PRs", "small"), TextContent("" + @Count(prs), "large-heavy"), Stack([
  @Count(@Filter(prs, "ci", "==", "failing")) > 0 ? Tag("CI failing", null, "sm", "danger") : Tag("All passing", null, "sm", "success"),
  Tag("" + @Count(@Filter(prs, "status", "==", "review")) + " in review", null, "sm", "info")
], "row", "xs")], "sunk")
```
Use Stack row of Tags below the KPI value to show breakdowns at a glance.

## Built-in Functions

Data functions prefixed with `@` to distinguish from components. These are the ONLY functions available — do NOT invent new ones.
Use @-prefixed built-in functions (@Count, @Sum, @Avg, @Min, @Max, @Round) on Query results — do NOT hardcode computed values.

@Count(array) → number — Returns array length
@First(array) → element — Returns first element of array
@Last(array) → element — Returns last element of array
@Sum(numbers[]) → number — Sum of numeric array
@Avg(numbers[]) → number — Average of numeric array
@Min(numbers[]) → number — Minimum value in array
@Max(numbers[]) → number — Maximum value in array
@Sort(array, field, direction?) → sorted array — Sort array by field. Direction: "asc" (default) or "desc"
@Filter(array, field, operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains", value) → filtered array — Filter array by field value
@Round(number, decimals?) → number — Round to N decimal places (default 0)
@Abs(number) → number — Absolute value
@Floor(number) → number — Round down to nearest integer
@Ceil(number) → number — Round up to nearest integer
@Each(array, varName, template) — Evaluate template for each element. varName is the loop variable — use it ONLY inside the template expression (inline). Do NOT create a separate statement for the template.

Builtins compose — output of one is input to the next:
`@Count(@Filter(data.rows, "field", "==", "val"))` for KPIs/chart values, `@Round(@Avg(data.rows.score), 1)`, `@Each(data.rows, "item", Comp(item.field))` for per-item rendering.
Array pluck: `data.rows.field` extracts a field from every row → use with @Sum, @Avg, charts, tables.

IMPORTANT @Each rule: The loop variable (e.g. "item") is ONLY available inside the @Each template expression. Always inline the template — do NOT extract it to a separate statement.
CORRECT: `Col("Actions", @Each(rows, "t", Button("Edit", Action([@Set($id, t.id)]))))`
WRONG: `myBtn = Button("Edit", Action([@Set($id, t.id)]))` then `Col("Actions", @Each(rows, "t", myBtn))` — t is undefined in myBtn.

## Query — Live Data Fetching

Fetch data from available tools. Returns defaults instantly, swaps in real data when it arrives.

```
metrics = Query("tool_name", {arg1: value, arg2: $binding}, {defaultField: 0, defaultData: []}, refreshInterval?)
```

- First arg: tool name (string)
- Second arg: arguments object (may reference $bindings — re-fetches automatically on change)
- Third arg: default data (rendered immediately before fetch resolves)
- Fourth arg (optional): refresh interval in seconds (e.g. 30 for auto-refresh every 30s)
- Use dot access on results: metrics.totalEvents, metrics.data.day (array pluck)
- Query results must use regular identifiers: `metrics = Query(...)`, NOT `$metrics = Query(...)`
- Manual refresh: `Button("Refresh", Action([@Run(query1), @Run(query2)]), "secondary")` — re-fetches the listed queries
- Refresh all queries: create Action with @Run for each query
- NEVER invent custom refresh actions like `{type: "refresh"}` or `{type: "refresh_data"}` — query refresh is done ONLY with `Action([@Run(queryRef), ...])`

## Mutation — Write Operations

Execute state-changing tool calls (create, update, delete). Unlike Query (auto-fetches on render), Mutation fires only on button click via Action.

```
result = Mutation("tool_name", {arg1: $binding, arg2: "value"})
```

- First arg: tool name (string)
- Second arg: arguments object (evaluated with current $binding values at click time)
- result.status: "idle" | "loading" | "success" | "error"
- result.data: tool response on success
- result.error: error message on failure
- Mutation results use regular identifiers: `result = Mutation(...)`, NOT `$result`
- Show loading state: `result.status == "loading" ? TextContent("Saving...") : null`

## Action — Button Behavior

Action([@steps...]) wires button clicks to operations. Steps are @-prefixed built-in actions. Steps execute in order.
Buttons without an explicit Action prop automatically send their label to the assistant (equivalent to Action([@ToAssistant(label)])).

Available steps:
- @Run(queryOrMutationRef) — Execute a Mutation or re-fetch a Query (ref must be a declared Query/Mutation)
- @ToAssistant("message") — Send a message to the assistant (for conversational buttons like "Tell me more", "Explain this")
- @OpenUrl("https://...") — Navigate to a URL
- @Set($variable, value) — Set a $variable to a specific value
- @Reset($var1, $var2, ...) — Reset $variables to their declared defaults (e.g. @Reset($title, $priority) restores $title="" and $priority="medium")

Example — mutation + refresh + reset (PREFERRED pattern):
```
$binding = "default"
result = Mutation("tool_name", {field: $binding})
data = Query("tool_name", {}, {rows: []})
onSubmit = Action([@Run(result), @Run(data), @Reset($binding)])
```

Example — manual refresh button:
```
metrics = Query("tool_name", {}, {rows: []}, 30)
refreshBtn = Button("Refresh", Action([@Run(metrics)]), "secondary")
```

Example — simple nav:
```
viewBtn = Button("View", Action([@OpenUrl("https://example.com")]))
```

- Action can be assigned to a variable or inlined: Button("Go", onSubmit) and Button("Go", Action([...])) both work
- If a @Run(mutation) step fails, remaining steps are skipped (halt on failure)
- @Run(queryRef) re-fetches the query (fire-and-forget, cannot fail)
- Do NOT invent custom button action types for tool/query behavior. For refresh, always use `Action([@Run(queryRef), ...])`.

### Action Decision Tree
- Button navigates to a URL → `@OpenUrl(url)` — NEVER use @ToAssistant for navigation
- Button writes data (create/update/delete) → `@Run(mutationRef)` — requires top-level Mutation
- Button needs AI reasoning/response → `@ToAssistant("message")` (see below)
- Button changes UI state (show/hide) → `@Set($variable, value)`
- Button resets form → `@Reset($var1, $var2)`

**@ToAssistant — when the action genuinely needs AI:**
Use ONLY when the button requires LLM analysis, not data fetching or navigation:
```
Button("Analyze Spike", Action([@ToAssistant("Analyze the traffic spike on " + data.topPage + " — what caused it?")]))
Button("Draft Reply", Action([@ToAssistant("Draft a reply to this tweet by @" + t.author + ": " + t.text)]))
Button("Diagnose", Action([@ToAssistant("Deploy " + d.service + " failed: " + d.error + ". Suggest a fix.")]))
```
Include context inline — the agent receives ONLY the @ToAssistant string, not the app state.

When Query data includes URLs (e.g. item.url, pr.html_url), ALWAYS wire them to @OpenUrl:
`Col("", @Each(data.rows, "r", Button("Open ↗", Action([@OpenUrl(r.url)]), "tertiary", "normal", "extra-small")))`

## Common Mistakes

❌ WRONG: `PieChart([Slice("A", 10), Slice("B", 20)])` → renders [object Object]
✅ RIGHT: `PieChart(["A", "B"], [10, 20], "donut")`
Why: PieChart takes TWO flat arrays (labels[], values[]), NOT an array of Slice objects. Same for RadialChart and SingleStackedBarChart.

❌ WRONG: `@Run(Mutation("db_execute", {sql: "DELETE ..."}))`
✅ RIGHT:
```
$delId = ""
delMut = Mutation("db_execute", {sql: "DELETE FROM items WHERE id = " + $delId, namespace: "myapp"})
Col("Actions", @Each(data.rows, "t", Button("🗑️", Action([@Set($delId, "" + t.id), @Run(delMut), @Run(data)]), "tertiary", "destructive", "extra-small")))
```
Why: @Run requires a reference to a top-level declared statement, never an inline call. For per-row operations, route the row id through a $state variable.

❌ WRONG: `Button("Open PR", Action([@ToAssistant("Open PR #" + pr.id)]))`
✅ RIGHT: `Button("Open PR", Action([@OpenUrl(pr.url)]))`
Why: Navigation uses @OpenUrl. @ToAssistant is ONLY for actions that need AI reasoning (e.g. rollback analysis, explanations).

❌ WRONG: Two Mutations where the second depends on the first's `last_insert_rowid()`
✅ RIGHT: Combine into a single SQL statement, or remove the dependency and compute splits/relations differently.
Why: Each @Run(mutation) executes as a separate DB call — there is no shared transaction, connection, or state between them.

❌ WRONG: Filter Select visible in UI but Query args are hardcoded
✅ RIGHT: `Query("tool", {status: $filterStatus, priority: $filterPriority}, {rows: []})` — $bindings in args
Why: If a filter is visible, EVERY relevant Query MUST reference it, or the filter does nothing.

❌ WRONG: 7+ Cards crammed into a single horizontal Stack row
✅ RIGHT: 3–4 KPI Cards per row (use 2 rows for 5–8 metrics). For 8+ comparable items, use a Table instead.
Why: Too many cards in one row makes text truncate. Use multiple `Stack` rows of 3–4 cards each, or switch to Table for data lists.

❌ WRONG: Card grid for data lists (5+ items with name/status/priority columns)
✅ RIGHT: Table with Col() per field + @Each for styled cells (Tags, Buttons) + Modal for drill-down details.
Why: Tables are scannable and sortable. Cards are for 2-4 KPI summaries or visually distinct items, not data lists.

❌ WRONG: `@Map(data.rows, ...)` or `@GroupBy(data.rows, ...)` or `@Reduce(...)`
✅ RIGHT: Use ONLY the documented @-functions: @Count, @Sum, @Avg, @Min, @Max, @Round, @Abs, @Floor, @Ceil, @Filter, @Sort, @First, @Last, @Each
Why: These are the only built-in functions. Any other @-function will silently fail.

❌ WRONG: `TextContent("" + data.stars, "large-heavy")` — shows "undefined" or "null" when data hasn't loaded
✅ RIGHT: `TextContent(data.stars ? "" + data.stars : "—", "large-heavy")`
Why: Query defaults render immediately, but nested fields may be undefined. Use ternary guards for KPI values.

❌ WRONG: `AreaChart(data.trend.day, [Series(...)])` with no empty guard
✅ RIGHT: `@Count(data.trend) > 0 ? AreaChart(data.trend.day, [Series(...)]) : TextContent("Loading…", "small")`
Why: Charts with empty arrays render blank. Always guard with @Count and show a placeholder.

❌ WRONG: Unsafe string concatenation in Mutation("exec") with user input
```
mut = Mutation("exec", {command: "node scripts/action.js '{\"text\":\"" + $userInput + "\"}'"})
```
If `$userInput` contains quotes, newlines, `$`, or backticks → broken command or shell injection.
✅ RIGHT: Route user text through db_execute params (SQL-safe), then have the script read from DB:
```
saveDraft = Mutation("db_execute", {sql: "INSERT OR REPLACE INTO pending (id, payload) VALUES ($id, $text)", params: {id: $targetId, text: $userInput}, namespace: "myapp"})
execAction = Mutation("exec", {command: "node scripts/process-pending.js"})
submitBtn = Button("Send", Action([@Run(saveDraft), @Run(execAction), @Run(data), @Reset($userInput)]))
```
Direct concat is fine for machine values (IDs, enums): `"node script.js " + $issueId`. Only user free-text is dangerous.

❌ WRONG: Toast Callout declared but never triggered
```
$showOk = false
actionBtn = Button("Do It", Action([@Run(mut), @Run(data)]), "primary")
toast = Callout("success", "Done!", "Action completed.", $showOk)
```
✅ RIGHT: Add `@Set($showOk, true)` to the Action chain:
```
actionBtn = Button("Do It", Action([@Run(mut), @Run(data), @Set($showOk, true)]), "primary")
```
Callout with `$visible` binding needs `@Set($visible, true)` to appear. It auto-dismisses after 3s.

❌ WRONG: Success-only feedback, errors swallowed silently
```
result = Mutation("exec", {command: "node scripts/create.js"})
toast = result.status == "success" ? Callout("success", "Created!", "Done.") : null
```
✅ RIGHT: Show both success (auto-dismiss) and error (persistent):
```
$showOk = false
successToast = Callout("success", "Created!", "Done.", $showOk)
errorBanner = result.status == "error" ? Callout("error", "Failed", result.error != null ? result.error : "Something went wrong.") : null
submitBtn = Button("Create", Action([@Run(result), @Run(data), @Set($showOk, true)]), "primary")
```
External calls fail (expired auth, rate limits, network). Always pair success toast with error state.

## Interactive Filters

To let the user filter data with a dropdown:
1. Declare a $variable with a default: `$dateRange = "14"`
2. Create a Select with name, items, and binding: `Select("dateRange", [SelectItem("7", "Last 7 days"), ...], null, null, $dateRange)`
3. Wrap in FormControl for a label: `FormControl("Date Range", Select(...))`
4. Pass $dateRange in Query args: `Query("tool", {dateRange: $dateRange}, {defaults})`
5. When the user changes the Select, $dateRange updates and the Query automatically re-fetches

FILTER WIRING RULE: If a $binding filter is visible in the UI, EVERY relevant Query MUST reference that $binding in its args. Never show a filter dropdown while hardcoding the query args.

**Complete multi-filter example (2 filters + table + chart, fully wired):**
```
$status = "all"
$priority = "all"
filters = Stack([
  FormControl("Status", Select("status", [SelectItem("all", "All"), SelectItem("open", "Open"), SelectItem("closed", "Closed")], null, null, $status)),
  FormControl("Priority", Select("priority", [SelectItem("all", "All"), SelectItem("high", "High"), SelectItem("medium", "Medium"), SelectItem("low", "Low")], null, null, $priority))
], "row", "m")
filtered = $status == "all" ? ($priority == "all" ? data.rows : @Filter(data.rows, "priority", "==", $priority)) : ($priority == "all" ? @Filter(data.rows, "status", "==", $status) : @Filter(@Filter(data.rows, "status", "==", $status), "priority", "==", $priority))
table = Table([Col("Title", filtered.title), Col("Status", @Each(filtered, "r", Tag(r.status, null, "sm", r.status == "open" ? "success" : "neutral")))])
chart = PieChart(["Open", "Closed"], [@Count(@Filter(filtered, "status", "==", "open")), @Count(@Filter(filtered, "status", "==", "closed"))], "donut")
```
Key: the "all" option uses a ternary to skip filtering. Both table and chart use `filtered` so they respond to the same filters.

Rules for $variables:
- $variables hold simple values (strings or numbers), NOT arrays or objects
- $variables must be bound to a Select/Input component via the value argument (last positional arg) to be interactive
- Queries must use regular identifiers (NOT $variables): `metrics = Query(...)` not `$metrics = Query(...)`
- **Auto-declare**: You do NOT need to explicitly declare $variables. If you use `$foo` without declaring it, the parser auto-creates `$foo = null`. You can still declare explicitly to set a default: `$days = "14"`

## Forms

Simple form — no $bindings needed. Field values are managed internally by the Form via the name prop:
```
contactForm = Form("contact", submitBtn, [nameField, emailField])
nameField = FormControl("Name", Input("name", "Your name", "text", {required: true}))
emailField = FormControl("Email", Input("email", "your@email.com", "email", {required: true, email: true}))
submitBtn = Button("Submit")
```

Use $bindings when you need to read field values elsewhere (in Action context, Query args, or conditionals). They are auto-declared:
```
$role = "engineer"
contactForm = Form("contact", submitBtn, [nameField, emailField, roleField])
nameField = FormControl("Name", Input("name", "Enter your name", "text", {required: true}, $name))
emailField = FormControl("Email", Input("email", "Enter your email", "email", {required: true, email: true}, $email))
roleField = FormControl("Role", Select("role", [SelectItem("engineer", "Engineer"), SelectItem("designer", "Designer"), SelectItem("pm", "PM")], null, {required: true}, $role))
submitBtn = Button("Submit")
```

For form + mutation patterns (create, refresh, reset), see the Action section example above.

IMPORTANT: Always add validation rules to form fields used with Mutations. Use OBJECT syntax: {required: true, email: true, minLength: 8}. The renderer shows error messages automatically and blocks submit when validation fails.

## Data Workflow

When tools are available, follow this workflow:
1. FIRST: Call the most relevant tool to inspect the real data shape before generating code
2. Use Query() for READ operations (data that should stay live) — NEVER hardcode tool results as literal arrays or objects
3. Use Mutation() for WRITE operations (create, update, delete) — triggered by button clicks via Action([@Run(mutationRef)])
4. Use the real data from step 1 as condensed Query defaults (3-5 rows) so the UI renders immediately
5. Use @-prefixed builtins (@Count, @Filter, @Sort, @Sum) on Query results for KPIs and aggregations — the runtime evaluates these live on every refresh
6. Hardcoded arrays are ONLY for static display data (labels, options) where no tool exists

WRONG — you called a tool and got data back, but you inlined the results:
```
openCount = 2
item1 = SomeComp("first item title")
item2 = SomeComp("second item title")
list = Stack([item1, item2])
chart = SomeChart(["A", "B"], [12, 8])
```
This is static — it shows stale data and won't update. Creating item1, item2, item3... manually is ALWAYS wrong when a tool exists.

RIGHT — use Query() for live data, Mutation() for writes, @builtins to derive values:
```
data = Query("tool_name", {}, {rows: []})
openCount = @Count(@Filter(data.rows, "field", "==", "value"))
list = @Each(data.rows, "item", SomeComp(item.title, item.field))
createResult = Mutation("create_tool", {title: $title})
submitBtn = Button("Create", Action([@Run(createResult), @Run(data), @Reset($title)]))
```
Everything derives from the Query — when data refreshes, the entire dashboard updates automatically.

## Hoisting & Streaming (CRITICAL)

openui-lang supports hoisting: a reference can be used BEFORE it is defined. The parser resolves all references after the full input is parsed.

During streaming, the output is re-parsed on every chunk. Undefined references are temporarily unresolved and appear once their definitions stream in. This creates a progressive top-down reveal — structure first, then data fills in.

**Recommended statement order for optimal streaming:**
1. `root = Stack(...)` — UI shell appears immediately
2. $variable declarations — state ready for bindings
3. Query statements — defaults resolve immediately so components render with data
4. Component definitions — fill in with data already available
5. Data values — leaf content last

Always write the root = Stack(...) statement first so the UI shell appears immediately, even before child data has streamed in.

## Recipe Book

Blueprints for high-value app patterns. Each recipe lists: data sources, agent enrichment, DB schema, layout, and key interactions.

### Recipe: Growth / Analytics Dashboard
**Use case:** Track product metrics — GitHub stars, NPM downloads, social mentions, web traffic — in one place with historical trends.
- **Data:** Multiple `Query("exec", ...)` calling separate scripts per source (GitHub API, NPM registry, Twitter/X API, PostHog). Separate scripts = independent refresh rates.
- **Enrichment:** Cron every 3–4h stores snapshots in SQLite. Daily cron runs full analysis (sentiment, trend deltas) via agentTurn.
- **DB:** `metrics_snapshots` (date, stars, downloads, pageviews), `tweet_log` (tweet_id UNIQUE, text, author, sentiment, likes, views)
- **Layout:** 4–8 KPI cards (2 rows) → Tabs (Overview | NPM | GitHub | Traffic | Social | History) → Charts + Tables per tab
- **Interactions:** Refresh button (@Run all queries), "📸 Save Snapshot" mutation, @OpenUrl for external links, History tab reads from DB snapshots

### Recipe: Social Media War Room
**Use case:** Monitor Twitter/Reddit/HN mentions with sentiment analysis, recommended actions, and inline reply buttons.
- **Data:** Script fetches mentions via API (GetX, Twitter API, etc.) → returns tweets with engagement metrics
- **Enrichment:** Cron runs agent that classifies sentiment (positive/negative/neutral), drafts replies for negative mentions, stores enriched data in DB
- **DB:** `mentions` (id UNIQUE, text, author, sentiment, draft_reply, recommended_action, platform)
- **Layout:** Alert bar (negative sentiment spike) → KPI cards (mentions, impressions, likes, sentiment ratio) → Tabs: Feed (Table with sentiment Tags) | Top Voices (author leaderboard) | Analytics (charts)
- **Interactions:** "View ↑" (@OpenUrl to tweet), "Post Reply" (Mutation exec calling post script), "Like + Bookmark" (Mutation exec). For negative mentions with cron-drafted replies: show draft_reply in a Modal TextArea (pre-filled via $binding), user edits inline, taps "Post" → Mutation fires.
- **Key pattern:** Pre-drafted reply review: `Modal("Reply", $showReply, [TextArea("reply", ..., null, $draftReply), Buttons([Button("Post", Action([@Run(postMut), ...]))])])`

### Recipe: DevOps Command Center
**Use case:** PRs, deploys, tickets, incidents — all in one surface with agent diagnosis and external mutations.
- **Data:** Scripts calling GitHub CLI (PRs, Actions), Linear API (tickets), custom incident tracker
- **Enrichment:** Agent generates PR summaries, incident diagnosis, and suggested fixes — stored as fields in script JSON output
- **DB:** Optional — for incident history tracking
- **Layout:** Alert bar (active incidents) → KPI cards with sub-indicator Tags → Tabs (PRs | Deploys | Tickets | Incidents) → Tables with Table+Modal detail pattern
- **Interactions:** Filters ($prStatus, $ticketPriority), Table+Modal drill-down, @OpenUrl to GitHub/Linear, "Create Ticket" form in Modal with Mutation("exec") to Linear API, success Callout toast

### Recipe: Daily Briefing
**Use case:** Morning dashboard with weather, calendar, email/message triage, and actionable buttons.
- **Data:** Two staggered cron jobs: (1) **Sync** — fetches raw data via API scripts, upserts into DB preserving existing enrichment; (2) **Enrich** — LLM agent reads un-enriched rows from DB, classifies/summarizes, writes results back.
- **Enrichment:** Cron classifies priority + category, writes a 1-line summary per item. Enforce strict enum values in the cron prompt (e.g. "MUST be exactly one of: high, medium, low") to prevent non-standard values that break filters.
- **DB:** Items table with enrichment columns (priority, category, summary, enriched_at). `enriched_at IS NULL` = pending.
- **Layout:** KPI cards (row) → Tabs per data source. Show enrichment status per row (⏳ pending / ✓ done). Banner when items are awaiting enrichment.
- **Interactions:** Reply (Modal form → Mutation), Snooze/Archive (Mutation exec + db_execute), Create (Modal form → Mutation exec → external API)
- **Key pattern:** `stats.pending > 0 ? Callout("info", "Processing", stats.pending + " items awaiting AI enrichment.") : null`

### Recipe: Finance / Portfolio Dashboard
**Use case:** Portfolio overview with risk analysis, position monitoring, strategy performance, and news filtered to held assets.
- **Data:** Scripts fetching portfolio positions (brokerage API or CSV), market prices (Yahoo Finance / Alpha Vantage), news (RSS/API). Each script = separate Query with independent refresh rates (prices fast, news slower).
- **Enrichment:** Cron runs agent that analyzes positions for: correlation risk ("positions X and Y are 85% correlated"), macro event exposure ("earnings tomorrow for 3 of your holdings"), strategy drift. Stores risk_flags and agent_reasoning per position in DB.
- **DB:** `positions` (symbol, qty, avg_cost, current_price, pnl, risk_flags, agent_reasoning, enriched_at), `price_snapshots` (date, symbol, price) for history
- **Layout:** Alert bar (risk warnings from enrichment) → KPI cards (total value, day P&L, top gainer, top loser) → Tabs (Positions | Performance | News | Risk). Positions tab: Table with colored P&L Tags (green/red), risk_flags as warning Tags. Performance tab: AreaChart of portfolio value over time from snapshots.
- **Interactions:** "Why?" button on risk warnings (@ToAssistant with agent_reasoning context), @OpenUrl to trading platform, news detail Modal with MarkDownRenderer
- **Key pattern:** Risk warning cards use enrichment data: `Card([CardHeader("⚠️ Risk Alert"), MarkDownRenderer(riskItem.agent_reasoning)], "sunk")`

## Examples

### Example 1 — CRUD App (Expense Tracker with SQLite)

E2E workflow: User asked "build me a trip expense tracker with splitwise."

Agent workflow:
1. PLAN: Need expenses table + people table. Splits calculated dynamically (no cross-mutation dependency).
2. TEST: Created schema with db_execute, inserted test row, verified db_query returns {rows: [...]}.
3. DESIGN: KPI cards (3 max per row) for totals, Table for expense list, PieChart (flat arrays!) for categories, Modal for add expense form.
4. WIRE: Per-row delete uses $deleteId + top-level Mutation. Form uses $bindings for all fields.

```openui-lang
root = Stack([header, kpiRow, tabs])
header = CardHeader("Trip Tracker", "Budget: $2,000")

people = Query("db_query", {sql: "SELECT id, name FROM people ORDER BY name", namespace: "trip"}, {rows: []})
expenses = Query("db_query", {sql: "SELECT id, description, amount, category, paid_by FROM expenses ORDER BY created_at DESC", namespace: "trip"}, {rows: []})

kpiRow = Stack([kpiTotal, kpiCount, kpiPeople], "row", "m", "stretch")
kpiTotal = Card([TextContent("Total Spent", "small"), TextContent("$" + @Round(@Sum(expenses.rows.amount), 0), "large-heavy")], "sunk")
kpiCount = Card([TextContent("Expenses", "small"), TextContent("" + @Count(expenses.rows), "large-heavy")], "sunk")
kpiPeople = Card([TextContent("People", "small"), TextContent("" + @Count(people.rows), "large-heavy")], "sunk")

tabs = Tabs([tabExpenses, tabChart])
tabExpenses = TabItem("expenses", "💸 Expenses (" + @Count(expenses.rows) + ")", [addBtn, expTable])
tabChart = TabItem("chart", "Breakdown", [catChart])

addBtn = Buttons([Button("+ Add Expense", Action([@Set($showAdd, true)]), "primary")])
$showAdd = false

expTable = @Count(expenses.rows) > 0 ? Table([
  Col("Description", expenses.rows.description),
  Col("Amount", @Each(expenses.rows, "e", TextContent("$" + e.amount))),
  Col("Category", @Each(expenses.rows, "e", Tag(e.category, null, "sm", e.category == "food" ? "success" : e.category == "transport" ? "info" : "neutral"))),
  Col("Paid by", expenses.rows.paid_by),
  Col("", @Each(expenses.rows, "e", Button("Delete", Action([@Set($delId, "" + e.id), @Run(delMut), @Run(expenses)]), "tertiary", "destructive", "extra-small")))
]) : TextContent("No expenses yet")

$delId = ""
delMut = Mutation("db_execute", {sql: "DELETE FROM expenses WHERE id = " + $delId, namespace: "trip"})

catChart = PieChart(["Food", "Transport", "Stay", "Other"], [
  @Sum(@Filter(expenses.rows, "category", "==", "food").amount),
  @Sum(@Filter(expenses.rows, "category", "==", "transport").amount),
  @Sum(@Filter(expenses.rows, "category", "==", "stay").amount),
  @Sum(@Filter(expenses.rows, "category", "==", "other").amount)
], "donut")
```

Key patterns: per-row delete with $delId state, PieChart with flat arrays from @Sum(@Filter), KPI cards max 3 per row.

### Example 2 — Dashboard (DevOps Command Center with live exec data)

E2E workflow: User asked "build a DevOps dashboard showing PRs, deploys, and tickets."

Agent workflow:
1. PLAN: 3 data sources via shell scripts (gh CLI for PRs, GitHub Actions for deploys, Linear API for tickets). No cross-dependencies.
2. TEST: Wrote scripts, saved with `write`, ran with `exec`, verified JSON output shape.
3. DESIGN: KPI row (3 cards), Tabs for each data source, Tables with conditional Tags, @OpenUrl for external links, Modal for details.
4. WIRE: Status filter on PRs tab with $prStatus binding. Ticket tab has dual filters.

```openui-lang
root = Stack([header, kpiRow, tabs])
header = Stack([CardHeader("DevOps Command Center", "Live Data"), refreshBtn], "row", "m", "center", "between")
refreshBtn = Button("Refresh", Action([@Run(prs), @Run(deploys), @Run(tickets)]), "secondary", "normal", "small")

prs = Query("exec", {command: "bash scripts/devops/prs.sh"}, [], 120)
deploys = Query("exec", {command: "bash scripts/devops/deploys.sh"}, [], 120)
tickets = Query("exec", {command: "bash scripts/devops/tickets.sh"}, [], 60)

kpiRow = Stack([kpiPR, kpiDeploy, kpiTicket], "row", "m", "stretch")
kpiPR = Card([TextContent("Open PRs", "small"), TextContent("" + @Count(prs), "large-heavy"), @Count(@Filter(prs, "ci_status", "==", "failing")) > 0 ? Tag("CI failing", null, "sm", "danger") : Tag("All passing", null, "sm", "success")], "sunk")
kpiDeploy = Card([TextContent("Deploys", "small"), TextContent("" + @Count(deploys), "large-heavy")], "sunk")
kpiTicket = Card([TextContent("Tickets", "small"), TextContent("" + @Count(tickets), "large-heavy")], "sunk")

tabs = Tabs([tabPR, tabDeploy, tabTicket])

$prStatus = "all"
tabPR = TabItem("prs", "PRs (" + @Count(prs) + ")", [prFilter, prTable, prModal])
prFilter = FormControl("Status", Select("pr_status", [SelectItem("all", "All"), SelectItem("review", "In Review"), SelectItem("approved", "Approved")], null, null, $prStatus))
filteredPRs = $prStatus == "all" ? prs : @Filter(prs, "status", "==", $prStatus)
prTable = Table([
  Col("PR", @Each(filteredPRs, "p", TextContent("#" + p.id + " " + p.title, "small-heavy"))),
  Col("CI", @Each(filteredPRs, "p", Tag(p.ci_status == "passing" ? "Pass" : "Fail", null, "sm", p.ci_status == "passing" ? "success" : "danger"))),
  Col("", @Each(filteredPRs, "p", Stack([Button("Details", Action([@Set($selPR, "" + p.id), @Set($showPR, true)]), "secondary", "normal", "extra-small"), Button("GitHub", Action([@OpenUrl(p.url)]), "tertiary", "normal", "extra-small")], "row", "xs")))
])
$selPR = ""
$showPR = false
selPRData = @First(@Filter(prs, "id", "==", $selPR))
prModal = Modal("PR #" + $selPR, $showPR, [
  CardHeader(selPRData.title, selPRData.branch),
  MarkDownRenderer(selPRData.agent_summary),
  Buttons([Button("Open on GitHub", Action([@OpenUrl(selPRData.url)]), "primary"), Button("Close", Action([@Set($showPR, false)]), "secondary")])
], "lg")

tabDeploy = TabItem("deploys", "Deploys", [deployTable])
deployTable = Table([
  Col("Service", deploys.service),
  Col("Status", @Each(deploys, "d", Tag(d.status == "live" ? "Passed" : "Failed", null, "sm", d.status == "live" ? "success" : "danger"))),
  Col("", @Each(deploys, "d", Button("View", Action([@OpenUrl(d.url)]), "tertiary", "normal", "extra-small")))
])

tabTicket = TabItem("tickets", "Tickets", [ticketTable])
ticketTable = Table([
  Col("ID", @Each(tickets, "t", Button(t.id, Action([@OpenUrl(t.url)]), "tertiary", "normal", "extra-small"))),
  Col("Title", tickets.title),
  Col("Priority", @Each(tickets, "t", Tag(t.priority, null, "sm", t.priority == "urgent" ? "danger" : t.priority == "high" ? "warning" : "info")))
])
```

Key patterns: exec Query with shell scripts, filter wiring with "all" option, Table + Modal detail, @OpenUrl for GitHub/Linear links, conditional Tag coloring, KPI cards max 3 per row.

### Example 3 — Growth Dashboard (Multi-source + History + Snapshots)

E2E workflow: User asked "build a dashboard to track our product across GitHub, NPM, and Twitter."

Agent workflow:
1. PLAN: 3 API scripts (github, npm, twitter) + SQLite for history snapshots. Manual + cron snapshot saving.
2. TEST: Wrote each script, ran with `exec`, verified JSON output. Tested each API individually.
3. DESIGN: KPI row (4–6 cards with null-safe display), Tabs per data source + History tab, Charts guarded with @Count.
4. WIRE: Refresh button for all queries, snapshot mutation pulling values from live queries, history charts from DB.

```openui-lang
root = Stack([header, kpiRow, tabs])
header = Stack([CardHeader("🚀 Growth Dashboard", "Product Metrics • Live Data"), headerBtns], "row", "m", "center", "between")
headerBtns = Stack([refreshBtn, snapshotBtn], "row", "s")
refreshBtn = Button("↻ Refresh", Action([@Run(gh), @Run(npm), @Run(social), @Run(history)]), "secondary", "normal", "small")
snapshotBtn = Button("📸 Save Snapshot", Action([@Run(gh), @Run(npm), @Run(social), @Run(saveSnapshot), @Run(history)]), "primary", "normal", "small")

gh = Query("exec", {command: "node scripts/github-stats.js"}, {stars: 0, forks: 0, openIssues: 0}, 300)
npm = Query("exec", {command: "node scripts/npm-downloads.js"}, {totalDownloads: 0, packages: [], weeklyTrend: []}, 300)
social = Query("exec", {command: "node scripts/twitter-mentions.js"}, {mentionCount: 0, totalViews: 0, totalLikes: 0, latestTweets: []}, 600)

kpiRow = Stack([starsKpi, dlsKpi, mentionsKpi], "row", "m", "stretch")
starsKpi = Card([TextContent("⭐ Stars", "small"), TextContent(gh.stars ? "" + gh.stars : "—", "large-heavy"), Tag("GitHub", null, "sm", "info")], "card", "column", "xs", "center")
dlsKpi = Card([TextContent("📦 Downloads / mo", "small"), TextContent(npm.totalDownloads ? "" + npm.totalDownloads : "—", "large-heavy"), Tag("" + @Count(npm.packages) + " packages", null, "sm", "neutral")], "card", "column", "xs", "center")
mentionsKpi = Card([TextContent("🐦 Mentions", "small"), TextContent(social.mentionCount ? "" + social.mentionCount : "—", "large-heavy"), Tag("Recent", null, "sm", "neutral")], "card", "column", "xs", "center")

tabs = Tabs([npmTab, socialTab, historyTab])

npmTab = TabItem("npm", "📦 NPM", [trendCard, pkgTable])
trendCard = Card([CardHeader("Weekly Downloads"), @Count(npm.weeklyTrend) > 0 ? AreaChart(npm.weeklyTrend.week, [Series("Downloads", npm.weeklyTrend.downloads)], "natural") : TextContent("Loading…", "small")])
pkgTable = Card([CardHeader("Packages"), @Count(npm.packages) > 0 ? Table([Col("Package", npm.packages.shortName), Col("Weekly", npm.packages.weekly, "number"), Col("Monthly", npm.packages.monthly, "number"), Col("", @Each(npm.packages, "p", Button("↑", Action([@OpenUrl("https://www.npmjs.com/package/" + p.name)]), "tertiary", "normal", "small")))]) : TextContent("Loading…", "small")])

socialTab = TabItem("social", "🐦 Twitter", [socialKpis, tweetTable])
socialKpis = Stack([Card([TextContent("❤️ Likes", "small"), TextContent(social.totalLikes ? "" + social.totalLikes : "—", "large-heavy")], "sunk"), Card([TextContent("👁️ Views", "small"), TextContent(social.totalViews ? "" + social.totalViews : "—", "large-heavy")], "sunk")], "row", "m", "stretch")
tweetTable = Card([CardHeader("Latest Mentions"), @Count(social.latestTweets) > 0 ? Table([Col("Author", @Each(social.latestTweets, "t", Tag("@" + t.author, null, "sm", "info"))), Col("Tweet", social.latestTweets.text), Col("❤️", social.latestTweets.likes, "number"), Col("", @Each(social.latestTweets, "t", Button("↑", Action([@OpenUrl(t.url)]), "tertiary", "normal", "small")))]) : TextContent("No mentions found.", "small")])

history = Query("db_query", {sql: "SELECT date, stars, forks, downloads, mentions FROM metrics_snapshots ORDER BY date ASC", namespace: "dashboard"}, {rows: []}, 60)
saveSnapshot = Mutation("db_execute", {sql: "INSERT OR REPLACE INTO metrics_snapshots (date, stars, forks, downloads, mentions) VALUES (date('now'), $stars, $forks, $dls, $mentions)", params: {stars: gh.stars, forks: gh.forks, dls: npm.totalDownloads, mentions: social.mentionCount}, namespace: "dashboard"})

historyTab = TabItem("history", "📈 Growth History", [histStars, histTable])
histStars = Card([CardHeader("⭐ Stars Over Time"), @Count(history.rows) > 1 ? AreaChart(history.rows.date, [Series("Stars", history.rows.stars)], "natural") : Callout("info", "Building history…", "Save daily snapshots to see trends.")])
histTable = Card([CardHeader("Snapshots"), @Count(history.rows) > 0 ? Table([Col("Date", history.rows.date), Col("⭐ Stars", history.rows.stars, "number"), Col("📦 Downloads", history.rows.downloads, "number"), Col("🐦 Mentions", history.rows.mentions, "number")]) : TextContent("No snapshots yet.", "small")])
```

Key patterns: null-safe KPI display (`value ? "" + value : "—"`), empty state guards (`@Count > 0 ?`), manual snapshot mutation referencing live query values, history charts from DB, multi-source scripts with independent refresh rates, Tag labels in KPI cards for context.


## Edit Mode

The runtime merges by statement name: same name = replace, new name = append.
Output ONLY statements that changed or are new. Everything else is kept automatically.

### Delete
To remove a component, update the parent to exclude it from its children array. Orphaned statements are automatically garbage-collected.
Example — remove chart: `root = Stack([header, kpiRow, table])` — chart is no longer in the children list, so it and any statements only it referenced are auto-deleted.

### Patch size guide
- Changing a title or label: 1 statement
- Adding a component: 2-3 statements (the new component + parent update)
- Removing a component: 1 statement (re-declare parent without the removed child)
- Adding a filter + wiring to query: 3-5 statements
- Restructuring into tabs: 5-10 statements

### Rules
- Reuse existing statement names exactly — do not rename
- Do NOT re-emit unchanged statements — the runtime keeps them
- A typical edit patch is 1-10 statements, not 20+
- If the existing code already satisfies the request, output only the root statement
- NEVER output the entire program as a patch. Only output what actually changes
- If you are about to output more than 10 statements, reconsider — most edits need fewer

## Inline Mode

You are in inline mode. You can respond in two ways:

### 1. Code response (when the user wants to CREATE or CHANGE the UI)
Wrap openui-lang code in triple-backtick fences. You can include explanatory text before/after:

Here's your dashboard:

```openui-lang
root = RootComp([header, content])
header = SomeHeader("Title")
content = SomeContent("Hello world")
```

I created a simple layout with a header.

### 2. Text-only response (when the user asks a QUESTION)
If the user asks "what is this?", "explain the chart", "how does this work", etc. — respond with plain text. Do NOT output any openui-lang code. The existing dashboard stays unchanged.

### Rules
- When the user asks for changes, output ONLY the changed/new statements in a fenced block
- When the user asks a question, respond with text only — NO code. The dashboard stays unchanged.
- The parser extracts code from fences automatically. Text outside fences is shown as chat.
## Important Rules
- When asked about data, generate realistic/plausible data
- Choose components that best represent the content (tables for comparisons, charts for trends, forms for input, etc.)

## Final Verification
Before finishing, walk your output and verify:
1. root = Stack(...) is the FIRST line (for optimal streaming).
2. Every referenced name is defined. Every defined name (other than root) is reachable from root.
3. Every Query result is referenced by at least one component.
4. Every $binding appears in at least one component or expression.

- For grid-like layouts, use Stack with direction "row" and wrap=true. Avoid justify="between" unless you specifically want large gutters.
- For forms, define one FormControl reference per field so controls can stream progressively.
- For forms, always provide the second Form argument with Buttons(...) actions: Form(name, buttons, fields).
- Never nest Form inside Form.
- Use @Reset($var1, $var2) after form submit to restore defaults — not @Set($var, "")
- Multi-query refresh: Action([@Run(mutation), @Run(query1), @Run(query2), @Reset(...)])
- $variables are reactive: changing via Select or @Set re-evaluates all Queries and expressions referencing them
- Use existing components (Tabs, Accordion, Modal) before inventing ternary show/hide patterns

---

## Plugin tools and workflow

Beyond the openui-lang surface above, this skill teaches the agent how to wire openui-lang into the Claw plugin's tool surface (`app_create`, `app_update`, `get_app`, `create_markdown_artifact`, `exec`, `read`, `db_query`, `db_execute`).

### Creating an app

1. Write the complete openui-lang code.
2. Call `app_create({title, code})` with the title and the full RAW code (no fences — `app_create` takes raw text).
3. Call `app_create` immediately once the code is ready. Do NOT wait for your final paragraph.

```
app_create({title: "Sales Dashboard", code: "root = Stack([header, chart])\nheader = CardHeader(\"Sales\")\nchart = BarChart([\"Q1\",\"Q2\"], [Series(\"Rev\", [100, 200])])"})
```

The app is stored in the Apps panel. The user can open, refine, and return to it later.

### Apps with live data — discover → script → generate

Follow these three steps in order. Do NOT skip straight to generating markup.

**Step 1: Discover data.** Use the `exec` tool to explore what's available:

```
exec({command: "vm_stat"})
exec({command: "ps aux --sort=-%mem | head -10"})
exec({command: "df -h"})
```

Inspect the raw output — understand its format, fields, and what can be extracted.

**System binaries — use absolute paths inside scripts.** The `exec` tool runs commands through `/bin/sh`, but apps run with a minimal sandbox PATH that often misses `/usr/sbin` (where macOS `sysctl`, `netstat`, `pwd_mkdb` live). When you `write` a script for an app, hard-code absolute paths for any system binary that isn't in `/usr/bin` or `/bin`:

- `/usr/sbin/sysctl` (NOT `sysctl`)
- `/usr/sbin/netstat`, `/usr/sbin/lsof`, `/usr/sbin/ioreg`
- `/usr/local/bin/<tool>` or `/opt/homebrew/bin/<tool>` for brew-installed tools

Rule of thumb: if you discovered the binary works in your interactive `exec` test but the app shows "command not found" on first refresh, it's a PATH-vs-script-environment mismatch — switch to an absolute path.

**Step 2: Write and save a data script.** Raw command output is rarely in a shape the UI can bind to directly. Write a self-contained script that:

- Calls the raw commands from step 1.
- Parses and transforms the output into clean JSON.
- Prints the JSON via `console.log(JSON.stringify(...))`.

Save with the `write` tool (preferred) or `exec`:

```
write({path: "~/.openclaw/workspace/scripts/my-data.js", content: "const os = require('os');\n..."})
```

Then test:

```
exec({command: "node ~/.openclaw/workspace/scripts/my-data.js"})
```

Verify the output is valid JSON like `{"totalGB":16.0,"freeGB":2.1,"pct":86.9}`. Embedding multi-line scripts inside Query strings causes escaping nightmares — saved script files keep the Query call readable.

**CRITICAL: Test scripts before wiring to the app.** Run the script with `exec`, inspect the output, and confirm:
- Output is valid JSON (not wrapped in extra text)
- Field names match what you'll use in the app (e.g. `.rows` for db_query, flat array for exec)
- Error cases return valid JSON too (e.g. `[]` or `{"error": "..."}`, not a stack trace)
- If the script depends on environment variables or API keys, load them from a `.env` file:
  ```bash
  if [ -f "$HOME/.openclaw/workspace/.env" ]; then
    export $(grep -v '^#' "$HOME/.openclaw/workspace/.env" | xargs)
  fi
  ```
- Store API keys in `~/.openclaw/workspace/.env` (gitignored), never hardcode in scripts.

**Step 3: Generate the app.** Create openui-lang with `Query()` statements that call the saved script:

```
data = Query("exec", {command: "node ~/.openclaw/workspace/scripts/my-data.js"}, {totalGB: 16.0, freeGB: 2.1, pct: 86.9}, 5)
```

- First arg: tool name — always `"exec"` (or `"read"` for file reads).
- Second arg: args object passed directly to the tool — for exec, just `{command: "..."}`.
- Third arg: defaults — use the REAL JSON output from your step 2 test.
- Fourth arg: refresh interval in seconds.
- Access fields directly: `data.fieldA` — stdout is auto-parsed, no `.result` wrapper.

### Persistent app state (SQLite)

For todos, notes, saved filters, or any CRUD data, use the SQLite tools rather than faking state.

1. In the agent turn, call `db_execute` to create the schema.
2. In the app markup, use `Query("db_query", ...)` for reads.
3. Use `Mutation("db_execute", ...)` for writes.
4. Trigger the read query again after writes with `Action([@Run(writeMutation), @Run(readQuery)])`.

```
db_execute({sql: "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)", namespace: "todos"})
```

```openui-lang
$text = ""
todos = Query("db_query", {sql: "SELECT id, text, done, created_at FROM todos ORDER BY created_at DESC", namespace: "todos"}, {rows: []}, 5)
createTodo = Mutation("db_execute", {sql: "INSERT INTO todos (text) VALUES ($text)", params: {text: $text}, namespace: "todos"})
addButton = Button("Add", Action([@Run(createTodo), @Run(todos), @Reset($text)]))
```

- `db_query` returns `{namespace, rows: [...]}`.
- `db_execute` returns `{namespace, changes, lastInsertRowid}`.
- Use the same `namespace` across setup, reads, and writes for one app.
- Prefer SQL parameters over string interpolation for user input.

### Editing apps (refine flow)

When the user wants to change an existing app — including the in-app "Refine" button which prefills the chat composer with `Refine app "<title>" (id: <id>): ...` — follow this pattern:

1. Call `get_app({id: "..."})` to see the current code.
2. Identify what needs to change.
3. Call `app_update({id: "...", patch: "chart = LineChart(...)..."})` with ONLY the changed/new statements.

The runtime merges by statement name:
- Same name → replaced.
- New name → added.
- Missing from patch → kept unchanged.

A typical edit is 1-5 statements. NEVER output the entire program as a patch. The lint loop returns `validationErrors` when rules are violated; when you see them, call `app_update` again with ONLY the corrected statements.

### Manual refresh buttons

If the user wants a visible refresh control, re-run the declared `Query()` refs:

```openui-lang
refreshBtn = Button("↻ Refresh", Action([@Run(overview), @Run(procs)]), "secondary", "normal", "small")
```

A plain `Button("Refresh")` sends a message to the assistant; it does NOT refresh queries. Manual refresh always targets declared query refs via `@Run(queryRef)`.

### External API mutations (exec-based)

For actions that call external services (post tweet, merge PR, create ticket, send email), use `Mutation("exec", ...)` with a script.

**⚠️ Escaping rule:** Direct string concat is safe ONLY for simple machine values (IDs, enum strings, numbers). For user-typed text (titles, descriptions, email bodies), route through `db_execute` params first — see the Common Mistakes section for the safe pattern.

**Safe for direct concat** (no user free-text):
```openui-lang
$issueId = ""
$stateId = ""
updateIssue = Mutation("exec", {command: "node scripts/update-issue.js '{\"issueId\":\"" + $issueId + "\",\"stateId\":\"" + $stateId + "\"}'"})
startBtn = Button("▶ Start", Action([@Set($issueId, item.id), @Set($stateId, "state-in-progress"), @Run(updateIssue), @Run(issues)]), "secondary", "normal", "extra-small")
```

**Unsafe — use DB intermediary** (user free-text like titles, descriptions, email bodies):
```openui-lang
$newTitle = ""
$newDesc = ""
saveDraft = Mutation("db_execute", {sql: "INSERT OR REPLACE INTO pending_actions (key, title, description) VALUES ('create', $title, $desc)", params: {title: $newTitle, desc: $newDesc}, namespace: "myapp"})
createTicket = Mutation("exec", {command: "node scripts/create-ticket-from-db.js"})
createBtn = Button("Create", Action([@Run(saveDraft), @Run(createTicket), @Run(tickets), @Set($showCreate, false), @Reset($newTitle, $newDesc)]), "primary")
```
The script reads from the DB instead of parsing shell-escaped args.

The script must:
- Handle authentication (load API keys from `.env`)
- Return valid JSON: `{"status": "ok"}` or `{"status": "error", "message": "..."}`
- Be tested with `exec` before wiring to the app

Show success/error feedback (both states!):
```openui-lang
$created = false
createBtn = Button("Create", Action([@Run(createMut), @Run(data), @Set($created, true)]), "primary")
successToast = Callout("success", "✅ Created", "Ticket created and synced.", $created)
errorBanner = createMut.status == "error" ? Callout("error", "Failed", createMut.error != null ? createMut.error : "Creation failed.") : null
```

### Multi-source aggregation scripts

For dashboards pulling from 3+ APIs, write separate scripts per source (preferred) or a single aggregation script:

**Separate scripts (preferred — independent refresh rates):**
```openui-lang
gh = Query("exec", {command: "node scripts/github-stats.js"}, {stars: 0, forks: 0}, 300)
npm = Query("exec", {command: "node scripts/npm-downloads.js"}, {totalDownloads: 0, packages: []}, 300)
social = Query("exec", {command: "node scripts/twitter-mentions.js"}, {mentions: [], totalViews: 0}, 600)
```

Each script should:
- Be self-contained (own API keys, own error handling)
- Return valid JSON even on error: `{"error": "...", "totalDownloads": 0, "packages": []}`
- Be tested individually with `exec` before wiring

**Single aggregation script (when all data refreshes together):**
```javascript
// scripts/dashboard-data.js
const github = callGitHub();   // returns {stars, prs, ...} or null on error
const posthog = callPostHog(); // returns {pageviews, ...} or null on error
console.log(JSON.stringify({
  github: github || {stars: 0},
  posthog: posthog || {pageviews: 0}
}));
```
Access nested: `data.github.stars`, `data.posthog.pageviews`

### Scheduled updates (cron-driven apps)

A cron's prompt is its ONLY context at fire time — no session memory. Prompts must include the target explicitly: either `db_execute` with `namespace` + table schema, OR `app_update` with `app_id`. Prefer DB writes for recurring data; `app_update` only when the layout shape changes.

### Progressive architecture — evolving apps

Apps naturally evolve through three tiers. Start simple — add layers only when needed:

1. **Live query** — `Query("exec", {command: "node script.js"})`. Good for: read-only dashboards, fresh-every-time data. Limitation: no persistence, no enrichment, no deduplication.
2. **DB-backed** — Cron syncs external data into SQLite; app reads from DB. Good for: data that needs deduplication, local state (snoozed/archived), or offline access. Add this layer when the app needs to **remember** things across refreshes.
3. **AI-enriched** — Second cron runs an LLM agent that reads un-enriched rows and writes classifications/summaries. Good for: triage, sentiment, risk analysis, draft replies. Add this layer when the data needs **judgment**, not just fetching.

Tell the user about this evolution: *"I'll start with live data. If you want AI triage or persistent state, I can add a DB layer with cron enrichment."* First-time users won't know this is possible unless you surface it.

### Agent-enriched apps (Cron → DB → App)

For apps that need AI analysis (sentiment classification, email triage, risk assessment, draft replies), use a three-layer architecture:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Cron /  │────▶│  SQLite  │────▶│   App    │
│  Agent   │     │  (state) │     │ (reads)  │
└──────────┘     └──────────┘     └──────────┘
   enriches         stores          displays
```

**Why:** The app runtime has NO LLM — it can't analyze, classify, or draft. Cron jobs run with a full agent that CAN. SQLite bridges the gap: cron writes enriched data, app reads it.

**Cron prompt rules:**
- Must include the script path to run
- Must include DB namespace + full table schema (cron has no memory)
- Must specify what analysis to perform and where to store results
- Must use `INSERT OR IGNORE` with unique IDs to avoid duplicates

**Example — Social media monitoring with sentiment:**
Cron (every 3h):
1. Run `node scripts/twitter-mentions.js` → get raw tweets
2. Store each tweet: `INSERT OR IGNORE INTO tweet_log (tweet_id, text, author, sentiment, ...)`
3. Store snapshot: `INSERT INTO snapshots (mention_count, total_views, total_likes, ...)`
4. Compare with previous snapshot for delta reporting

App reads:
```openui-lang
tweets = Query("db_query", {sql: "SELECT * FROM tweet_log ORDER BY id DESC LIMIT 50", namespace: "social"}, {rows: []}, 60)
snapshots = Query("db_query", {sql: "SELECT * FROM snapshots ORDER BY id DESC LIMIT 30", namespace: "social"}, {rows: []}, 300)
```

### Historical trend tracking (Cron → DB → Charts)

To show growth over time, store periodic snapshots in SQLite and chart the history:

**1. Schema:**
```sql
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id INTEGER PRIMARY KEY,
  date TEXT UNIQUE NOT NULL DEFAULT (date('now')),
  stars INTEGER, forks INTEGER, downloads INTEGER, mentions INTEGER
)
```

**2. Snapshot capture** — two approaches:
- **Manual button:** User clicks "📸 Save Snapshot" → Mutation inserts current values from live queries
- **Cron job:** Automated daily snapshot via cron agentTurn

```openui-lang
// Manual snapshot button (values come from other live queries)
saveSnapshot = Mutation("db_execute", {sql: "INSERT OR REPLACE INTO metrics_snapshots (date, stars, forks, downloads) VALUES (date('now'), $stars, $forks, $downloads)", params: {stars: gh.stars, forks: gh.forks, downloads: npm.totalDownloads}, namespace: "dashboard"})
snapshotBtn = Button("📸 Save Snapshot", Action([@Run(saveSnapshot), @Run(history)]), "primary", "normal", "small")
```

**3. Chart the history:**
```openui-lang
history = Query("db_query", {sql: "SELECT date, stars, downloads, mentions FROM metrics_snapshots ORDER BY date ASC", namespace: "dashboard"}, {rows: []}, 60)
starsChart = @Count(history.rows) > 1 ? AreaChart(history.rows.date, [Series("Stars", history.rows.stars)], "natural") : Callout("info", "Building history…", "Snapshots are saved daily. Come back tomorrow!")
```

Key: always guard charts with `@Count > 1` and show a placeholder for sparse data.

### Creating artifacts

When the user wants a report, document, summary, or reference material saved:

```
create_markdown_artifact({title: "Q1 Report", content: "# Q1 Report\n\n## Revenue\n..."})
```

Call `create_markdown_artifact` as soon as the content is ready so the artifact appears during the run, not only after your final paragraph.

### When to use what

- **Inline UI** (fenced `openui-lang` via the openui-chat-renderer skill) — quick visualizations, previews, one-off charts.
- **App** (`app_create`) — dashboards, tools, forms the user will return to. Persistent.
- **Artifact** (`create_markdown_artifact`) — reports, summaries, documents. Persistent.
- **Plain text** — questions, explanations, conversation.
