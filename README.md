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

## Design notes

- **Color** — the Hack Club brand palette (Red, Orange, Yellow, Green, Cyan,
  Blue, Purple), reordered — not recolored — into the one sequence of those
  seven hues that clears Anthropic's data-viz color-vision-deficiency and
  normal-vision adjacency checks in both themes: Red, Cyan, Orange, Blue,
  Yellow, Purple, Green. Hack Club Red doubles as the UI's primary accent in
  both light and dark mode.
- **Type** — Phantom Sans (Hack Club's brand typeface, self-hosted from
  `assets.hackclub.com`) for headings and body text; the system monospace
  stack for data.
- **Shape** — theme.hackclub.com's radius and shadow scale (pill-shaped
  buttons and tabs, 16px cards, button hover-scale) and its light/dark surface
  colors, applied through the same token pattern (`prefers-color-scheme` by
  default, overridable via a `data-theme` attribute on the root element).
- **Logo** — the official Hack Club "flag" icon (`icon-rounded.svg` from
  `hackclub.com/brand`), used unmodified per their usage guidance.
- `npm run build:artifact` (or `node scripts/build-artifact.mjs` after a
  build) produces a single self-contained HTML file — fonts and the logo
  inlined as data URIs — suitable for a static host or a shareable preview.


---------------

Please note, this project was mostly vibe coded, and this doesn't potray my work. However I still contributed my part towards it by making some miscellaneous changes and implementing Hack Club color scheme from (theme.hackclub.com) I'll be working on this (again) very soon to make it more meaningful.

### Future improvements:

- I'm planning on adding

