import { describe, expect, it } from 'vitest';
import { buildPresetState } from '../data/presets';
import { createDefaultState } from '../data/defaults';
import type { StorageLike } from './storage';
import { clearState, loadState, parseState, saveState, STORAGE_KEY } from './storage';

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
    const state = buildPresetState('hybrid', NOW);

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

  it('rejects state with an invalid horizon', () => {
    const raw = { ...createDefaultState(NOW), horizonYears: 3 };
    expect(parseState(raw, NOW)).toBeNull();
  });

  it('clears the storage', () => {
    const storage = createFakeStorage();
    saveState(buildPresetState('growth', NOW), storage);
    expect(storage.map.size).toBe(1);

    clearState(storage);
    expect(storage.map.size).toBe(0);
  });
});