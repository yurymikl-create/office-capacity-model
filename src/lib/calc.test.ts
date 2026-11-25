import { describe, expect, it } from 'vitest';
import type { ModelState } from '../types';
import { createDefaultState } from '../data/defaults';
import { buildPresetState } from '../data/presets';
import {
  addMonths,
  aggregateYearly,
  buildMonthly,
  chartSeries,
  eventWindowStatus,
  findCrossingIndex,
  summarize,
} from './calc';

const NOW = new Date(2026, 0, 15);

function stateWith(patch: Partial<ModelState>): ModelState {
  return { ...createDefaultState(NOW), ...patch };
}

describe('addMonths', () => {
  it('rolls over the year boundary', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, 12)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, 0)).toEqual({ year: 2026, month: 0 });
  });
});

describe('buildMonthly: modes', () => {
  it('flat keeps base values for the whole horizon', () => {
    const points = buildMonthly(createDefaultState(NOW));
    expect(points).toHaveLength(25);
    for (const point of points) {
      expect(point.staff).toBe(100);
      expect(point.seats).toBe(100);
      expect(point.attendancePct).toBe(60);
      expect(point.visits).toBeCloseTo(60);
      expect(point.deficit).toBe(0);
      expect(point.load).toBeCloseTo(60);
    }
  });

  it('headcount trend adds the step every month', () => {
    const state = createDefaultState(NOW);
    state.staff = { base: 100, mode: 'trend', step: 2, events: [] };
    const points = buildMonthly(state);

    expect(points[0]?.staff).toBe(100);
    expect(points[12]?.staff).toBe(124);
    expect(points[24]?.staff).toBe(148);
    expect(points[12]?.visits).toBeCloseTo(74.4);
  });

  it('attendance trend is set in percentage points and multiplies headcount', () => {
    const state = createDefaultState(NOW);
    state.attendance = { base: 40, mode: 'trend', step: 3, events: [] };
    const points = buildMonthly(state);

    expect(points[0]?.attendancePct).toBe(40);
    expect(points[2]?.attendancePct).toBe(46);
    expect(points[2]?.visits).toBeCloseTo(46);
  });

  it('events apply from their month and hold until the next one', () => {
    const state = createDefaultState(NOW);
    state.staff = {
      base: 100,
      mode: 'events',
      step: 0,
      events: [
        { id: 'a', year: 2026, month: 2, kind: 'delta', value: 50 },
        { id: 'b', year: 2026, month: 5, kind: 'delta', value: -30 },
      ],
    };
    const points = buildMonthly(state);

    expect(points[0]?.staff).toBe(100);
    expect(points[1]?.staff).toBe(100);
    expect(points[2]?.staff).toBe(150);
    expect(points[4]?.staff).toBe(150);
    expect(points[5]?.staff).toBe(120);
    expect(points[24]?.staff).toBe(120);
  });

  it('an absolute attendance event sets the value in percent', () => {
    const state = createDefaultState(NOW);
    state.attendance = {
      base: 40,
      mode: 'events',
      step: 0,
      events: [{ id: 'a', year: 2026, month: 7, kind: 'absolute', value: 55 }],
    };
    const points = buildMonthly(state);

    expect(points[6]?.attendancePct).toBe(40);
    expect(points[7]?.attendancePct).toBe(55);
    expect(points[7]?.visits).toBeCloseTo(55);
  });

  it('events in the same month apply in insertion order', () => {
    const state = createDefaultState(NOW);
    state.attendance = {
      base: 40,
      mode: 'events',
      step: 0,
      events: [
        { id: 'a', year: 2026, month: 3, kind: 'delta', value: 10 },
        { id: 'b', year: 2026, month: 3, kind: 'absolute', value: 50 },
      ],
    };
    expect(buildMonthly(state)[3]?.attendancePct).toBe(50);

    const reversed = createDefaultState(NOW);
    reversed.attendance = {
      base: 40,
      mode: 'events',
      step: 0,
      events: [
        { id: 'b', year: 2026, month: 3, kind: 'absolute', value: 50 },
        { id: 'a', year: 2026, month: 3, kind: 'delta', value: 10 },
      ],
    };
    expect(buildMonthly(reversed)[3]?.attendancePct).toBe(60);
  });

  it('an event before the start month is ignored', () => {
    const state = createDefaultState(NOW);
    state.staff = {
      base: 100,
      mode: 'events',
      step: 0,
      events: [{ id: 'a', year: 2025, month: 11, kind: 'delta', value: 500 }],
    };
    expect(buildMonthly(state).every((point) => point.staff === 100)).toBe(true);
  });

  it('attendance is clamped to 0..100%', () => {
    const state = createDefaultState(NOW);
    state.attendance = {
      base: 98,
      mode: 'events',
      step: 0,
      events: [{ id: 'a', year: 2026, month: 1, kind: 'delta', value: 10 }],
    };
    expect(buildMonthly(state)[12]?.attendancePct).toBe(100);
  });

  it('seats never drop below one', () => {
    const state = createDefaultState(NOW);
    state.seats = {
      base: 10,
      mode: 'events',
      step: 0,
      events: [{ id: 'a', year: 2026, month: 1, kind: 'delta', value: -100 }],
    };
    const points = buildMonthly(state);
    expect(points[12]?.seats).toBe(1);
    expect(points[12]?.deficit).toBeGreaterThan(0);
  });
});

describe('crossing and deficit', () => {
  it('finds the first month where on-site demand reached capacity', () => {
    const points = buildMonthly(
      stateWith({
        staff: { base: 100, mode: 'trend', step: 10, events: [] },
        attendance: { base: 50, mode: 'plateau', step: 0, events: [] },
      }),
    );

    expect(findCrossingIndex(points)).toBe(10);
    const summary = summarize(points);
    expect(summary.crossingLabel).toBe('Nov 2026');
    expect(summary.maxDeficit).toBeCloseTo(70);
    expect(summary.maxDeficitLabel).toBe('Jan 2028');
  });

  it('returns null when there is no crossing', () => {
    const points = buildMonthly(createDefaultState(NOW));
    expect(findCrossingIndex(points)).toBeNull();
    const summary = summarize(points);
    expect(summary.crossingIndex).toBeNull();
    expect(summary.crossingLabel).toBeNull();
    expect(summary.needsSeats).toBe(0);
  });

  it('computes the peak deficit and the number of missing seats', () => {
    const summary = summarize(
      buildMonthly(
        stateWith({
          attendance: { base: 100, mode: 'plateau', step: 0, events: [] },
          seats: { base: 80, mode: 'plateau', step: 0, events: [] },
        }),
      ),
    );

    expect(summary.crossingIndex).toBe(0);
    expect(summary.maxDeficit).toBe(20);
    expect(summary.needsSeats).toBe(20);
  });

  it('marks a crossing when on-site equals seats, but needs no extra seats', () => {
    const summary = summarize(
      buildMonthly(
        stateWith({
          attendance: { base: 100, mode: 'plateau', step: 0, events: [] },
          seats: { base: 100, mode: 'plateau', step: 0, events: [] },
        }),
      ),
    );

    expect(summary.crossingIndex).toBe(0);
    expect(summary.maxDeficit).toBe(0);
    expect(summary.needsSeats).toBe(1);
  });
});

describe('yearly aggregation', () => {
  it('only kicks in for horizons longer than two years', () => {
    const state = createDefaultState(NOW);
    expect(chartSeries(state, buildMonthly(state)).isYearly).toBe(false);

    const twoYears = { ...state, horizonYears: 2 as const };
    expect(chartSeries(twoYears, buildMonthly(twoYears)).points).toHaveLength(25);

    const fiveYears = { ...state, horizonYears: 5 as const };
    const monthly = buildMonthly(fiveYears);
    const chart = chartSeries(fiveYears, monthly);
    expect(monthly).toHaveLength(61);
    expect(chart.isYearly).toBe(true);
    expect(chart.points.map((point) => point.chartLabel)).toEqual([
      '2026',
      '2027',
      '2028',
      '2029',
      '2030',
      '2031',
    ]);
    expect(chart.points[chart.points.length - 1]?.key).toBe(monthly[monthly.length - 1]?.key);
  });

  it('takes the last month of every year', () => {
    const state = { ...createDefaultState(NOW), horizonYears: 5 as const };
    const yearly = aggregateYearly(buildMonthly(state));

    expect(yearly[0]?.label).toBe('Dec 2026');
    expect(yearly[1]?.label).toBe('Dec 2027');
  });
});

describe('presets', () => {
  it('Baseline keeps every parameter flat', () => {
    const state = buildPresetState('base', NOW);
    expect(state.scenarioId).toBe('base');
    expect(state.horizonYears).toBe(2);
    for (const key of ['staff', 'seats', 'attendance'] as const) {
      expect(state[key].mode).toBe('plateau');
      expect(state[key].events).toHaveLength(0);
    }
  });

  it('Growth uses a 2% of base monthly trend', () => {
    const state = buildPresetState('growth', NOW);
    expect(state.scenarioId).toBe('growth');
    expect(state.staff.mode).toBe('trend');
    expect(state.staff.step).toBe(2);
    expect(state.horizonYears).toBe(5);
  });

  it('Hybrid sets 40% attendance and a +20 seats event in August', () => {
    const state = buildPresetState('hybrid', NOW);
    expect(state.attendance.base).toBe(40);
    expect(state.staff.base).toBe(160);
    expect(state.seats.mode).toBe('events');
    expect(state.seats.base).toBe(60);
    expect(state.seats.events).toHaveLength(1);
    expect(state.seats.events[0]?.month).toBe(7);
    expect(state.seats.events[0]?.value).toBe(20);

    const points = buildMonthly(state);
    expect(points[0]?.deficit).toBe(4);
    expect(points[7]?.seats).toBe(80);
    expect(points[7]?.deficit).toBe(0);
  });
});

describe('eventWindowStatus', () => {
  it('distinguishes past, horizon and future', () => {
    const past = { id: '1', year: 2025, month: 11, kind: 'delta' as const, value: 1 };
    const within = { id: '2', year: 2026, month: 6, kind: 'delta' as const, value: 1 };
    const future = { id: '3', year: 2029, month: 0, kind: 'delta' as const, value: 1 };

    expect(eventWindowStatus(past, 2026, 0, 2)).toBe('past');
    expect(eventWindowStatus(within, 2026, 0, 2)).toBe('within');
    expect(eventWindowStatus(future, 2026, 0, 2)).toBe('future');
  });
});