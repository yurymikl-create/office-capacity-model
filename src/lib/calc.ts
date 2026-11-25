import type {
  ChartPoint,
  HorizonYears,
  ModelEvent,
  ModelState,
  MonthPoint,
  ParamState,
  Summary,
} from '../types';
import { monthLabel, shortMonthLabel } from './format';

export interface TimelineSlot {
  index: number;
  year: number;
  month: number;
}

export type EventWindowStatus = 'past' | 'within' | 'future';

export function addMonths(year: number, month: number, offset: number): { year: number; month: number } {
  const total = year * 12 + month + offset;
  const nextYear = Math.floor(total / 12);
  return { year: nextYear, month: total - nextYear * 12 };
}

export function buildTimeline(
  startYear: number,
  startMonth: number,
  horizonYears: HorizonYears,
): TimelineSlot[] {
  const count = horizonYears * 12 + 1;
  return Array.from({ length: count }, (_, index) => ({
    index,
    ...addMonths(startYear, startMonth, index),
  }));
}

export function compareEvents(a: ModelEvent, b: ModelEvent): number {
  return a.year - b.year || a.month - b.month;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Expands a parameter across months: flat keeps the base, trend is base + step × m,
 * events apply in their month and hold until the next event.
 * Multiple events in the same month apply in insertion order.
 */
export function resolveSeries(
  param: ParamState,
  timeline: TimelineSlot[],
  clampValue: (value: number) => number,
): number[] {
  const events = param.events
    .map((event, order) => ({ event, order }))
    .sort((a, b) => compareEvents(a.event, b.event) || a.order - b.order)
    .map(({ event }) => event);

  const values: number[] = [];
  let current = clampValue(param.base);

  for (const slot of timeline) {
    if (param.mode === 'trend') {
      current = clampValue(param.base + param.step * slot.index);
    } else if (param.mode === 'events') {
      for (const event of events) {
        if (event.year !== slot.year || event.month !== slot.month) continue;
        current = clampValue(event.kind === 'absolute' ? event.value : current + event.value);
      }
    } else {
      current = clampValue(param.base);
    }
    values.push(current);
  }

  return values;
}

export function buildMonthly(state: ModelState): MonthPoint[] {
  const timeline = buildTimeline(state.startYear, state.startMonth, state.horizonYears);
  const staff = resolveSeries(state.staff, timeline, (value) => Math.max(0, value));
  const seats = resolveSeries(state.seats, timeline, (value) => Math.max(1, value));
  const attendance = resolveSeries(state.attendance, timeline, (value) => clamp(value, 0, 100));

  return timeline.map((slot, index) => {
    const staffValue = staff[index] ?? 0;
    const seatsValue = seats[index] ?? 1;
    const attendancePct = attendance[index] ?? 0;
    const attendanceShare = attendancePct / 100;
    const visits = staffValue * attendanceShare;
    const deficit = Math.max(0, visits - seatsValue);
    const load = seatsValue > 0 ? (visits / seatsValue) * 100 : 0;

    return {
      index: slot.index,
      key: `${slot.year}-${String(slot.month + 1).padStart(2, '0')}`,
      year: slot.year,
      month: slot.month,
      label: monthLabel(slot.year, slot.month),
      shortLabel: shortMonthLabel(slot.year, slot.month),
      staff: staffValue,
      seats: seatsValue,
      attendance: attendanceShare,
      attendancePct,
      visits,
      deficit,
      load,
      zoneBase: Math.min(visits, seatsValue),
      zoneGreen: Math.max(0, seatsValue - visits),
      zoneRed: deficit,
    };
  });
}

/** First month where on-site demand reached capacity (>=). */
export function findCrossingIndex(points: MonthPoint[]): number | null {
  const index = points.findIndex((point) => point.visits >= point.seats);
  return index === -1 ? null : index;
}

export function summarize(points: MonthPoint[]): Summary {
  const final = points[points.length - 1];
  const crossingIndex = findCrossingIndex(points);

  let maxDeficit = 0;
  let maxDeficitIndex: number | null = null;
  points.forEach((point, index) => {
    if (point.deficit > maxDeficit) {
      maxDeficit = point.deficit;
      maxDeficitIndex = index;
    }
  });

  const crossingPoint = crossingIndex === null ? null : points[crossingIndex];
  return {
    final,
    crossingIndex,
    crossingLabel: crossingPoint ? crossingPoint.label : null,
    crossingYear: crossingPoint ? crossingPoint.year : null,
    maxDeficit,
    maxDeficitLabel: maxDeficitIndex === null ? null : (points[maxDeficitIndex]?.label ?? null),
    needsSeats: crossingIndex === null ? 0 : Math.max(1, Math.ceil(maxDeficit)),
  };
}

/** For horizons longer than 24 months: a snapshot at the end of each year. */
export function aggregateYearly(points: MonthPoint[]): ChartPoint[] {
  const lastByYear = new Map<number, MonthPoint>();
  for (const point of points) {
    lastByYear.set(point.year, point);
  }
  return [...lastByYear.values()].map((point) => ({ ...point, chartLabel: String(point.year) }));
}

export function toMonthlyChartPoints(points: MonthPoint[]): ChartPoint[] {
  return points.map((point) => ({ ...point, chartLabel: point.shortLabel }));
}

export function chartSeries(
  state: ModelState,
  points: MonthPoint[],
): { points: ChartPoint[]; isYearly: boolean } {
  const isYearly = state.horizonYears > 2;
  return {
    points: isYearly ? aggregateYearly(points) : toMonthlyChartPoints(points),
    isYearly,
  };
}

export function eventWindowStatus(
  event: ModelEvent,
  startYear: number,
  startMonth: number,
  horizonYears: HorizonYears,
): EventWindowStatus {
  const offset = (event.year - startYear) * 12 + (event.month - startMonth);
  if (offset < 0) return 'past';
  if (offset > horizonYears * 12) return 'future';
  return 'within';
}