import { describe, expect, it } from 'vitest';
import type { MonthPoint } from '../types';
import { monthLabel, shortMonthLabel } from './format';
import {
  aggregatePoints,
  bucketIndexForMonth,
  clampViewport,
  fullViewport,
  panViewport,
  resolveGranularity,
  zoomViewport,
} from './chartView';

function makePoint(
  year: number,
  month: number,
  visits: number,
  seats: number,
): MonthPoint {
  const deficit = Math.max(0, visits - seats);
  const load = seats > 0 ? (visits / seats) * 100 : 0;
  return {
    index: year * 12 + month,
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    year,
    month,
    label: monthLabel(year, month),
    shortLabel: shortMonthLabel(year, month),
    staff: 100,
    seats,
    attendance: visits / 100,
    attendancePct: visits,
    visits,
    deficit,
    load,
    zoneBase: Math.min(visits, seats),
    zoneGreen: Math.max(0, seats - visits),
    zoneRed: deficit,
  };
}

describe('resolveGranularity', () => {
  it('auto switches at 24 and 60 months', () => {
    expect(resolveGranularity('auto', 12)).toBe('month');
    expect(resolveGranularity('auto', 24)).toBe('month');
    expect(resolveGranularity('auto', 25)).toBe('quarter');
    expect(resolveGranularity('auto', 60)).toBe('quarter');
    expect(resolveGranularity('auto', 61)).toBe('year');
  });

  it('respects a manual choice', () => {
    expect(resolveGranularity('year', 12)).toBe('year');
    expect(resolveGranularity('month', 120)).toBe('month');
  });
});

describe('aggregatePoints', () => {
  it('keeps every month in monthly mode', () => {
    const points = [makePoint(2026, 0, 60, 100), makePoint(2026, 1, 70, 100)];
    const chart = aggregatePoints(points, 'month');
    expect(chart).toHaveLength(2);
    expect(chart[0]?.bucketLabel).toBe('Jan 2026');
    expect(chart[0]?.chartLabel).toBe('Jan 26');
    expect(chart[0]?.bucketKind).toBe('month');
  });

  it('groups quarters and uses the worst month of the bucket', () => {
    const points = [
      makePoint(2026, 0, 80, 100),
      makePoint(2026, 1, 104, 100),
      makePoint(2026, 2, 100, 100),
      makePoint(2026, 3, 40, 100),
    ];
    const chart = aggregatePoints(points, 'quarter');

    expect(chart).toHaveLength(2);
    expect(chart[0]?.bucketLabel).toBe('Q1 2026');
    expect(chart[0]?.chartLabel).toBe('Q1 26');
    expect(chart[0]?.label).toBe('Feb 2026');
    expect(chart[0]?.deficit).toBe(4);
    expect(chart[0]?.bucketEndMonth).toBe(2);
    expect(chart[1]?.bucketLabel).toBe('Q2 2026');
    expect(chart[1]?.bucketEndMonth).toBe(3);
  });

  it('falls back to maximum utilization when there is no deficit', () => {
    const points = [
      makePoint(2026, 0, 70, 100),
      makePoint(2026, 1, 95, 100),
      makePoint(2026, 2, 85, 100),
    ];
    const chart = aggregatePoints(points, 'quarter');
    expect(chart[0]?.label).toBe('Feb 2026');
    expect(chart[0]?.load).toBeCloseTo(95);
  });

  it('keeps the earliest month on a full tie', () => {
    const points = [
      makePoint(2026, 0, 80, 100),
      makePoint(2026, 1, 80, 100),
    ];
    const chart = aggregatePoints(points, 'quarter');
    expect(chart[0]?.label).toBe('Jan 2026');
  });

  it('groups years and marks bucket ends', () => {
    const points = [
      makePoint(2026, 10, 60, 100),
      makePoint(2026, 11, 90, 100),
      makePoint(2027, 0, 70, 100),
    ];
    const chart = aggregatePoints(points, 'year');

    expect(chart).toHaveLength(2);
    expect(chart[0]?.bucketLabel).toBe('2026');
    expect(chart[0]?.chartLabel).toBe('2026');
    expect(chart[0]?.label).toBe('Dec 2026');
    expect(chart[0]?.bucketEndMonth).toBe(11);
    expect(chart[1]?.bucketEndMonth).toBe(0);
  });
});

describe('bucketIndexForMonth', () => {
  const chart = aggregatePoints(
    [
      makePoint(2026, 0, 50, 100),
      makePoint(2026, 2, 60, 100),
      makePoint(2026, 3, 70, 100),
      makePoint(2026, 8, 80, 100),
    ],
    'quarter',
  );

  it('maps a month to the bucket that contains it', () => {
    expect(bucketIndexForMonth(chart, 2026, 0)).toBe(0);
    expect(bucketIndexForMonth(chart, 2026, 3)).toBe(1);
    expect(bucketIndexForMonth(chart, 2026, 8)).toBe(2);
  });

  it('clamps to the last bucket when the month is beyond the data', () => {
    expect(bucketIndexForMonth(chart, 2027, 5)).toBe(chart.length - 1);
  });
});

describe('viewport', () => {
  it('builds and clamps the full range', () => {
    expect(fullViewport(25)).toEqual({ start: 0, end: 24 });
    expect(clampViewport({ start: -5, end: 40 }, 25)).toEqual({ start: 0, end: 24 });
    expect(clampViewport({ start: 20, end: 19 }, 25)).toEqual({ start: 19, end: 20 });
  });

  it('enforces a two-bucket minimum', () => {
    expect(clampViewport({ start: 5, end: 5 }, 25)).toEqual({ start: 5, end: 6 });
  });

  it('zooms around the centre and around a given anchor', () => {
    const zoomed = zoomViewport({ start: 0, end: 9 }, 0.5, 25);
    expect(zoomed.end - zoomed.start).toBe(5);
    expect(zoomed).toEqual({ start: 2, end: 7 });

    const anchored = zoomViewport({ start: 0, end: 9 }, 0.5, 25, 0);
    expect(anchored).toEqual({ start: 0, end: 5 });
  });

  it('does not zoom below two buckets', () => {
    const view = zoomViewport({ start: 0, end: 3 }, 0.1, 25, 0);
    expect(view).toEqual({ start: 0, end: 1 });
  });

  it('pans within the bounds and keeps the window width', () => {
    expect(panViewport({ start: 2, end: 6 }, 3, 10)).toEqual({ start: 5, end: 9 });
    expect(panViewport({ start: 2, end: 6 }, -5, 10)).toEqual({ start: 0, end: 4 });
    expect(panViewport({ start: 2, end: 6 }, 20, 10)).toEqual({ start: 5, end: 9 });
  });
});