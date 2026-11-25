# Headcount — Seats — Attendance

**Live demo:** https://yurymikl-create.github.io/office-capacity-model/ · **Repository:** https://github.com/yurymikl-create/office-capacity-model

A static office occupancy model: React + TypeScript + Vite + Recharts. No backend, no network requests at runtime. It shows when the number of people actually coming to the office exceeds the number of seats.

## Formulas

```
On-site[m]  = Headcount[m] × Attendance[m] / 100
Deficit[m]  = max(0, On-site[m] − Seats[m])
Utilization = On-site[m] / Seats[m] × 100
Crossing    = first month where On-site >= Seats
```

Horizon is configurable from 1 to 120 months with quick presets for 1/2/5/10 years; points are computed for `m = 0…N` (start month + horizon). The table and the summary are always monthly; the chart can be aggregated by quarter or year (see “Chart view”).

## Parameter modes

- **Flat** — the value never changes.
- **Trend** — `base + step × m`. For headcount and seats the step is in units/month, for attendance in percentage points/month (40 → 43 → 46%).
- **Events** — a “month/year + change” table. Headcount and seats accept a delta only (+100, −30); attendance accepts an absolute value in % or a delta in pp. An event applies from its month and holds until the next one. Events outside the horizon are dimmed and do not affect the model; multiple events in the same month apply in insertion order.

Value guards: attendance is clamped to 0…100%, headcount ≥ 0, seats ≥ 1.

**Average daily attendance.** `On-site[m]` is the average number of people in the office on a working day, not a monthly total: `headcount × attendance`, e.g. 160 people × 40% = 64 people/day. Seats are compared against this daily average. The UI labels it “On-site / day” and shows the formula next to the KPI (`= 160 staff × 40%`). There is deliberately no weekly profile in the MVP, so the daily figure is an average across working days.

## Defaults and persistence

The model starts with 100 people, 100 seats, 60% attendance and a 24-month horizon beginning in January of the current year. The horizon field accepts any whole number of months from 1 to 120; the quick chips (1/2/5/10 years) simply fill it. A scenario is the current combination of parameters, the start month and the horizon — there are no saved presets to switch between.

The current state is autosaved to `localStorage` under `office-capacity-model:state` (schema version 2). A state saved by the previous version (`office-capacity-model:v1`, with `horizonYears` and `scenarioId`) is migrated automatically: years become months, the scenario label is dropped, and the legacy key is removed. “Clear all” removes both keys and restores the defaults; the next write happens only after the next edit.

Dates are chosen from dropdowns: the start month and start year (years are grouped by decade, 2000–2100), and the month/year of every event. Event years are limited to the model window plus one year on either side; an existing out-of-window event still shows its year.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest: calculations, chart view, storage
npm run lint     # oxlint
npm run build    # tsc --noEmit && vite build → dist/
npm run preview  # preview the built version locally
```

## Architecture

```
src/
  App.tsx                    page composition
  data/defaults.ts           defaults, month labels, parameter metadata
  hooks/useCapacityModel.ts  state, autosave, derived data
  lib/calc.ts                monthly expansion, crossing, deficit
  lib/chartView.ts           granularity, worst-month buckets, viewport zoom/pan
  lib/storage.ts             localStorage with validation and v1 → v2 migration
  lib/format.ts              en-US formatting and month labels
  components/                parameter cards, events table, chart, summary, table
```

## Chart

- “Seats” — stepped line in events mode, linear otherwise (#FFFFFF).
- “On-site / day” — accent #00F6FF; “Headcount” — muted #8A8A8A. Every series can be hidden with the legend chips.
- The green/red fill is a stack of three `Area` series: the base `min(on-site, seats)`, green `max(0, seats − on-site)`, red `max(0, on-site − seats)`. This paints exactly the gap between the lines.
- **Capacity first:** the left axis is scaled to seats and on-site, so a deficit or spare-capacity band is never flattened by a large headcount. If headcount exceeds the capacity peak by more than 25%, it moves to its own right axis (grey ticks); otherwise all three series share one scale.
- **Emphasis:** the spare-capacity band uses a 20% mint fill and the deficit band a 30% red fill; the crossing line is always paired with a persistent red `Crossing: Nov 2028 →` chip in the toolbar that centres the window on that bucket.
- The crossing marker is a `ReferenceLine` plus a `ReferenceDot`; the caption sits in a pill with a dark background, clamped to the plot edges, with a 300 ms fade-in.
- The Y axis uses a hand-calculated “round” step (`niceStep`) so ticks never look like 55/110/165.

## Chart view

- **Scale:** `Auto | M | Q | Y`. Auto uses months up to 24 months, quarters up to 60, years beyond; a manual choice overrides it and is saved with the state.
- **Aggregation rule:** each quarter/year is represented by its **worst month** — maximum deficit first, then maximum utilization, then the earliest month. All values of a bucket come from that single month, so a red month is never hidden by averaging or by a calm year-end. Tooltips show the bucket plus “worst month: Aug 2026”.
- **Scroll:** the brush under the chart pans the timeline when dragged and resizes the window with its handles; the current range is printed in the toolbar. Horizontal trackpad scrolling works over the chart, and on touch screens a one-finger horizontal swipe pans the timeline.
- **Zoom:** `− / Fit / +` buttons (25% steps, at least two buckets), `Ctrl/⌘ + scroll` with the cursor as the anchor, and **pinch-to-zoom** on touch screens. Vertical page scrolling still works over the chart; the Y scale stays stable while scrolling so the axis does not jump.
- **Crossing outside the window:** the vertical marker is hidden and the persistent `Crossing: Nov 2028 →` chip centres the window on that bucket.
- The month-level table, KPIs and alerts always use all monthly points, regardless of the current view.

## Design

The UI follows EPAM’s visual language: a `#060606` canvas, white type, cyan `#00F6FF` as the only interactive accent, EPAM red `#FF4D40` for deficits, mint `#00F4AB` for spare capacity and violet `#B896FF` inside the gradient highlight on “Attendance”. Surfaces are flat — 1 px borders, no shadows, 12 px card radius — while buttons, chips and the horizon switch are pills with 10–12 px uppercase labels and wide tracking. The brand tile in the header is an abstract bar mark, not the EPAM logo.

Fonts: Manrope for display headings and key figures (light 300 weights), Inter for dense UI text. Both are self-hosted through `@fontsource-variable/*`, so the runtime makes no network requests.

## CSP and fonts

The CSP meta tag is injected at build time by the `office-capacity-csp` plugin (`vite.config.ts`): in dev, Vite uses an inline react-refresh script that strict `script-src 'self'` would block. The policy:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self' data:; connect-src 'self';
base-uri 'none'; form-action 'none'
```

`style-src 'unsafe-inline'` is required: Recharts positions the tooltip and legend with inline styles. Scripts stay strict and no external CDN is used — Inter and Manrope are bundled locally via `@fontsource-variable/*`.

## Deploying to GitHub Pages

The build uses `base: './'`, so `dist` works from any subpath. `.github/workflows/deploy.yml` is included: enable Pages with the “GitHub Actions” source and a push to `main` will publish the build.

## MVP limitations

- One mode per parameter: switching modes mid-timeline is not supported.
- No weekly day-by-day profile — monthly average attendance only.
- No money, Excel or OCR; no backend and no network requests.
- Custom named scenarios are not saved: a scenario is defined by the current parameters only.