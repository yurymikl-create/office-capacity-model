export type Mode = 'plateau' | 'trend' | 'events';

/** absolute — attendance only (set a value in %), delta — increment. */
export type EventKind = 'delta' | 'absolute';

export type ParamKey = 'staff' | 'seats' | 'attendance';

export type HorizonYears = 1 | 2 | 5 | 10;

export interface ModelEvent {
  id: string;
  year: number;
  /** 0 — January, 11 — December */
  month: number;
  kind: EventKind;
  /** For counts: delta; for attendance: % (absolute) or pp (delta). */
  value: number;
}

export interface ParamState {
  base: number;
  mode: Mode;
  step: number;
  events: ModelEvent[];
}

export interface ChartPrefs {
  showStaff: boolean;
  showVisits: boolean;
  showSeats: boolean;
}

export interface ModelState {
  version: number;
  startYear: number;
  startMonth: number;
  horizonYears: HorizonYears;
  staff: ParamState;
  seats: ParamState;
  attendance: ParamState;
  chartPrefs: ChartPrefs;
}

export interface MonthPoint {
  index: number;
  key: string;
  year: number;
  month: number;
  /** "Jan 2026" */
  label: string;
  /** "Jan 26" */
  shortLabel: string;
  staff: number;
  seats: number;
  /** Share 0..1 */
  attendance: number;
  attendancePct: number;
  visits: number;
  deficit: number;
  /** Utilization in % (on-site / seats) */
  load: number;
  zoneBase: number;
  zoneGreen: number;
  zoneRed: number;
}

export interface ChartPoint extends MonthPoint {
  /** X-axis label: month for short horizons, year for aggregation. */
  chartLabel: string;
}

export interface Summary {
  final: MonthPoint;
  crossingIndex: number | null;
  crossingLabel: string | null;
  crossingYear: number | null;
  maxDeficit: number;
  maxDeficitLabel: string | null;
  needsSeats: number;
}

export interface ParamMeta {
  title: string;
  /** "people" / "seats" / "%" */
  unitShort: string;
  hint: string;
  min: number;
  max: number;
  sliderMax: number;
  sliderStep: number;
  stepMin: number;
  stepMax: number;
  stepStep: number;
  stepUnit: string;
  supportsAbsoluteEvents: boolean;
}