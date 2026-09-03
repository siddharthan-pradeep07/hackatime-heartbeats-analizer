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
    authenticity.ts      # heuristic timing/write-integrity signals + verdict
  hooks/
    useHeartbeatStats.ts # memoized derivation of every KPI/chart/table from the
                          # loaded heartbeats + the idle-threshold setting
  components/
    charts/            # BarList, StackedBar, Meter, PulseStrip, and the shared Tooltip
    ChartCard.tsx        # figure/figcaption shell + "View as table" toggle
    DataTable.tsx         # generic table with a show-more affordance
    IntakePanel.tsx        # upload / paste / fetch-URL tabs
    FiltersRow.tsx           # the idle-threshold control
  App.tsx                     # composes the page and owns top-level state
scripts/
  build-artifact.mjs            # inlines a production build into one shareable HTML file
  eval-authenticity.mts          # dev-only harness: runs authenticity.ts against fixtures/ and prints the verdict + evidence for each
  fixtures/                        # real and synthetic heartbeat logs used to calibrate authenticity.ts (gitignored)
```

## Loading data

The app opens empty — no data is shown until you load a real export. Three ways
to do that, all client-side:

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
  the logged hours look human-driven, based on three signals: how irregular the
  *pacing* gaps between heartbeats are (real activity is close to memoryless; a
  script pinging on a fixed timer clusters tightly around one interval);
  whether frequently-written files ever actually gained lines; and whether any
  file's reported line count swings by a large amount repeatedly within a
  short window instead of trending toward a final size. Gaps of ≤2s are set
  aside before the timing read, since AI coding agents (Claude, Cursor, etc.)
  routinely touch a dozen files within the same second as one turn — that
  burst rhythm, not the pacing between turns, is what would otherwise make a
  legitimate agent-heavy session look like a fixed-interval script; a burst
  that keeps re-hitting the *same* file instead of sweeping across many
  doesn't get that benefit of the doubt. Deliberately tuned to lean sensitive:
  a single file with even a couple of concrete markers is named directly in a
  "flagged files" list with its own plain-language reason, rather than
  waiting for a large share of the whole session to look suspicious before
  saying anything — every claim is checkable against the exact numbers shown
  alongside it. It's explicitly not proof, just a starting point for manual
  review of the files it names. `scripts/eval-authenticity.mts` runs it
  against real and synthetic fixtures in `scripts/fixtures/` (gitignored —
  real heartbeat data) for calibration; run it with `npm run eval:authenticity`.

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

