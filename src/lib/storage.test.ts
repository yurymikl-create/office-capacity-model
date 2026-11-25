import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../data/defaults';
import type { StorageLike } from './storage';
import {
  clearState,
  LEGACY_STORAGE_KEY,
  loadState,
  parseState,
  saveState,
  STORAGE_KEY,
} from './storage';

const NOW = new Date(2026, 0, 15);

function createFakeStorage(initial: Record<string, string> = {}): StorageLike & {
  map: Map<string, string>;
} {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe('storage', () => {
  it('saves and loads state without losses', () => {
    const storage = createFakeStorage();
    const state = createDefaultState(NOW);
    state.staff = {
      base: 160,
      mode: 'trend',
      step: 3,
      events: [{ id: 'e1', year: 2026, month: 2, kind: 'delta', value: 10 }],
    };
    state.seats = {
      base: 90,
      mode: 'events',
      step: 0,
      events: [{ id: 'e2', year: 2026, month: 7, kind: 'delta', value: 20 }],
    };
    state.attendance = { base: 45, mode: 'plateau', step: 0, events: [] };

    saveState(state, storage);
    const loaded = loadState(storage);

    expect(loaded).toEqual(state);
  });

  it('falls back to defaults when there is no data', () => {
    const loaded = loadState(createFakeStorage());
    expect(loaded).toEqual(createDefaultState());
  });

  it('falls back to defaults on broken JSON', () => {
    const loaded = loadState(createFakeStorage({ [STORAGE_KEY]: '{oops' }));
    expect(loaded).toEqual(createDefaultState());
  });

  it('ignores data from another version', () => {
    const storage = createFakeStorage({
      [STORAGE_KEY]: JSON.stringify({ ...createDefaultState(NOW), version: 99 }),
    });
    expect(loadState(storage)).toEqual(createDefaultState());
  });

  it('drops malformed events and keeps valid ones', () => {
    const raw = {
      ...createDefaultState(NOW),
      staff: {
        base: 120,
        mode: 'events',
        step: 0,
        events: [
          { id: 'ok', year: 2026, month: 3, kind: 'delta', value: 10 },
          { year: 2026, month: 'April', kind: 'delta', value: 5 },
          'junk',
        ],
      },
    };

    const parsed = parseState(raw, NOW);
    expect(parsed).not.toBeNull();
    expect(parsed?.staff.base).toBe(120);
    expect(parsed?.staff.events).toHaveLength(1);
    expect(parsed?.staff.events[0]?.id).toBe('ok');
  });

  it('clamps the event month into 0..11', () => {
    const raw = {
      ...createDefaultState(NOW),
      attendance: {
        base: 40,
        mode: 'events',
        step: 0,
        events: [{ id: 'e', year: 2026, month: 42, kind: 'absolute', value: 50 }],
      },
    };

    const parsed = parseState(raw, NOW);
    expect(parsed?.attendance.events[0]?.month).toBe(11);
  });

  it('clamps the horizon into 1..120 months', () => {
    const tooLong = parseState(
      { ...createDefaultState(NOW), horizonMonths: 500 },
      NOW,
    );
    expect(tooLong?.horizonMonths).toBe(120);

    const tooShort = parseState(
      { ...createDefaultState(NOW), horizonMonths: 0 },
      NOW,
    );
    expect(tooShort?.horizonMonths).toBe(1);
  });

  it('migrates v1 horizonYears into horizonMonths', () => {
    const legacy = {
      version: 1,
      startYear: 2026,
      startMonth: 0,
      horizonYears: 5,
      scenarioId: 'growth',
      staff: { base: 120, mode: 'trend', step: 2, events: [] },
      seats: { base: 90, mode: 'plateau', step: 0, events: [] },
      attendance: { base: 50, mode: 'plateau', step: 0, events: [] },
      chartPrefs: { showStaff: true, showVisits: false, showSeats: true },
    };

    const parsed = parseState(legacy, NOW);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(2);
    expect(parsed?.horizonMonths).toBe(60);
    expect(parsed?.chartPrefs.granularity).toBe('auto');
    expect(parsed?.chartPrefs.showVisits).toBe(false);
    expect(parsed && 'scenarioId' in parsed).toBe(false);
  });

  it('reads and migrates the legacy storage key', () => {
    const legacy = {
      version: 1,
      startYear: 2026,
      startMonth: 0,
      horizonYears: 1,
      scenarioId: 'base',
      staff: { base: 80, mode: 'plateau', step: 0, events: [] },
      seats: { base: 70, mode: 'plateau', step: 0, events: [] },
      attendance: { base: 55, mode: 'plateau', step: 0, events: [] },
      chartPrefs: { showStaff: true, showVisits: true, showSeats: true },
    };
    const storage = createFakeStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacy) });

    const loaded = loadState(storage);
    expect(loaded.horizonMonths).toBe(12);
    expect(loaded.staff.base).toBe(80);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('falls back to auto granularity for invalid values', () => {
    const state = createDefaultState(NOW);
    const parsed = parseState(
      {
        ...state,
        chartPrefs: { ...state.chartPrefs, granularity: 'week' },
      },
      NOW,
    );
    expect(parsed?.chartPrefs.granularity).toBe('auto');
  });

  it('clears the storage', () => {
    const storage = createFakeStorage();
    saveState(createDefaultState(NOW), storage);
    expect(storage.map.size).toBe(1);

    clearState(storage);
    expect(storage.map.size).toBe(0);
  });
});