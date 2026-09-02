# Hackatime Heartbeats Visualizer

A React + TypeScript app that reads a Hackatime / WakaTime-style heartbeat export
(the `{ "heartbeats": [ { "t", "project", "file", "language", "editor", "write", … } ] }`
shape) and turns it into activity charts, session breakdowns, and coding stats —
entirely client-side. Nothing is uploaded anywhere; parsing happens in the browser.

Styled after the [Hack Club brand](https://hackclub.com/brand) and
[theme.hackclub.com](https://theme.hackclub.com) — this is an unofficial, fan-made
tool, not affiliated with or endorsed by Hack Club.

## Stack

- **React 18 + TypeScript** (strict mode), built with **Vite**
- No UI/charting library — every chart is a hand-built SVG/HTML component
  (see `src/components/charts/`), so mark shapes and hover behavior follow
  Anthropic's data-visualization method, while color and type follow Hack Club's
- Hand-written CSS design system (`src/styles/index.css`): light/dark tokens
  driven by CSS custom properties, no Tailwind/CSS-in-JS

## Run it

```sh
npm install
npm run dev        # local dev server with HMR
npm run build       # typecheck (tsc -b) + production build to dist/
npm run preview     # serve the production build locally
npm run typecheck   # tsc only, no build
```

## Project layout

```
public/
  hack-club-icon.svg    # the official Hack Club "flag" icon, used as-is
src/
  lib/
    normalize.ts     # tolerant parsing of raw heartbeat JSON → Heartbeat[]
    stats.ts          # the analytics core: durations, sessions, buckets, file stats
    format.ts         # duration/clock/number formatting
    palette.ts         # the 7-slot categorical color assignment
    sampleData.ts       # the bundled 299-heartbeat sample dataset
  hooks/
    useHeartbeatStats.ts # memoized derivation of every KPI/chart/table from the
                          # loaded heartbeats + the idle-threshold setting
  components/
    charts/            # BarList, StackedBar, Meter, PulseStrip, and the shared Tooltip
    ChartCard.tsx        # figure/figcaption shell + "View as table" toggle
    DataTable.tsx         # generic table with a show-more affordance
    IntakePanel.tsx        # sample / upload / paste / fetch-URL tabs
    FiltersRow.tsx           # the idle-threshold control
  App.tsx                     # composes the page and owns top-level state
scripts/
  build-artifact.mjs            # inlines a production build into one shareable HTML file
```

## Loading data

Four ways to get data in, all client-side:

- **Sample data** — loaded by default (a 299-heartbeat session across three editors)
- **Upload file** — drag a `.json` export onto the drop zone, or browse for one
- **Paste JSON** — paste an export straight into a text box
- **Fetch URL** — pull a JSON file from a URL that allows cross-origin requests

The parser (`src/lib/normalize.ts`) is tolerant of minor shape differences: a bare
array of heartbeats, a `{ heartbeats: [...] }` wrapper, `t` (seconds since the
first heartbeat) or `time`/`timestamp` (a Unix timestamp) as the time field, and
missing/`null` fields all fall back sensibly.

## What it computes

- **Active coding time**, estimated the way WakaTime-style trackers do: gaps
  between consecutive heartbeats under an adjustable idle threshold (1–30 min)
  count as active; longer gaps end a session. Every stat and chart recomputes
  live when the threshold changes.
- KPIs: active time, heartbeat count, sessions, longest session, files touched,
  projects, languages, editors, write ratio, and an estimated lines-added count
  (from positive deltas in the `lines` field per file).
- Charts: activity over elapsed time (a bucketed histogram), time by language,
  time by editor, time by project, AI-assisted vs. manual coding, write vs. view
  heartbeats, a ranked file table, and a session table.
- Every chart has a "View as table" toggle for an accessible, non-visual
  equivalent of the same data.
- **Authenticity check** (`src/lib/authenticity.ts`) — a heuristic read on whether
  the logged hours look human-driven, based on two signals: how irregular the
  gaps between heartbeats are (real activity is close to memoryless; a script
  pinging on a fixed timer clusters tightly around one interval), and whether
  frequently-written files ever actually gained lines. It escalates from "looks
  genuine" to "worth a second look" to "automation signals found" only when
  signals agree, and always shows the numbers behind the call — it's explicitly
  not proof, just a starting point for manual review.

## Design notes

Follows Anthropic's data-visualization method: a fixed 8-hue categorical
palette assigned in order (never cycled or re-assigned by rank), one hue for
magnitude, hover tooltips plus keyboard-focus parity on every mark, and a
light/dark theme pair driven entirely by CSS custom properties (`prefers-color-scheme`
by default, overridable via a `data-theme` attribute on the root element).


---------------

Please note, this project was mostly vibe coded, and this doesn't potray my work. However I still contributed my part towards it by making some miscellaneous changes and implementing Hack Club color scheme from (theme.hackclub.com) I'll be working on this (again) very soon to make it more meaningful.

### Future improvements:

- I'm planning on adding more data visualization and a way to connect it directly to ysws (you ship - we ship) sites which are part of Hack Club.

