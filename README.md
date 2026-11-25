# Headcount — Seats — Attendance

A static office occupancy model: React + TypeScript + Vite + Recharts. No backend, no network requests at runtime. It shows when the number of people actually coming to the office exceeds the number of seats.

## Formulas

```
On-site[m]  = Headcount[m] × Attendance[m] / 100
Deficit[m]  = max(0, On-site[m] − Seats[m])
Utilization = On-site[m] / Seats[m] × 100
Crossing    = first month where On-site >= Seats
```

Horizon 1 / 2 / 5 / 10 years; points are computed for `m = 0…N` (start month + 12 × years). The table and the summary are always monthly; the chart aggregates by year only for 5- and 10-year horizons (2 years is 24 months, so the “> 24” condition does not apply).

## Parameter modes

- **Flat** — the value never changes.
- **Trend** — `base + step × m`. For headcount and seats the step is in units/month, for attendance in percentage points/month (40 → 43 → 46%).
- **Events** — a “month/year + change” table. Headcount and seats accept a delta only (+100, −30); attendance accepts an absolute value in % or a delta in pp. An event applies from its month and holds until the next one. Events outside the horizon are dimmed and do not affect the model; multiple events in the same month apply in insertion order.

Value guards: attendance is clamped to 0…100%, headcount ≥ 0, seats ≥ 1.

## Defaults and persistence

The model starts with 100 people, 100 seats, 60% attendance and a 2-year horizon beginning in January of the current year. A scenario is simply the current combination of parameters, the start month and the horizon — there are no saved presets to switch between.

The current state is autosaved to `localStorage` under `office-capacity-model:v1` (with version and shape validation). “Clear all” removes the key and restores the defaults; the next write happens only after the next edit.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest: calculations, storage
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
  lib/calc.ts                monthly expansion, crossing, deficit, aggregation
  lib/storage.ts             localStorage with validation
  lib/format.ts              en-US formatting and month labels
  components/                parameter cards, events table, chart, summary, table
```

## Chart

- “Seats” — stepped line in events mode, linear otherwise (#FFFFFF).
- “On-site” — accent #00F6FF; “Headcount” — muted #8A8A8A. Every series can be hidden with the legend chips.
- The green/red fill is a stack of three `Area` series: the base `min(on-site, seats)`, green `max(0, seats − on-site)`, red `max(0, on-site − seats)`. This paints exactly the gap between the lines.
- The crossing marker is a `ReferenceLine` plus a `ReferenceDot`; the caption sits in a pill with a white background, clamped to the plot edges, with a 300 ms fade-in.
- The Y axis uses a hand-calculated “round” step (`niceStep`) so ticks never look like 55/110/165.

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