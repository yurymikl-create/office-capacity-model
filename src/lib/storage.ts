import type {
  ChartPrefs,
  EventKind,
  Granularity,
  Mode,
  ModelEvent,
  ModelState,
  ParamState,
} from '../types';
import {
  createDefaultState,
  MAX_HORIZON_MONTHS,
  MIN_HORIZON_MONTHS,
  STATE_VERSION,
} from '../data/defaults';
import { createId } from './id';

export const STORAGE_KEY = 'office-capacity-model:state';
export const LEGACY_STORAGE_KEY = 'office-capacity-model:v1';

const LEGACY_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const MODES: Mode[] = ['plateau', 'trend', 'events'];
const GRANULARITIES: Granularity[] = ['auto', 'month', 'quarter', 'year'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseEvent(value: unknown): ModelEvent | null {
  if (!isRecord(value)) return null;
  const year = asFiniteNumber(value.year);
  const month = asFiniteNumber(value.month);
  const eventValue = asFiniteNumber(value.value);
  if (year === null || month === null || eventValue === null) return null;

  const kind: EventKind = value.kind === 'absolute' ? 'absolute' : 'delta';
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    year: Math.round(year),
    month: Math.min(11, Math.max(0, Math.round(month))),
    kind,
    value: eventValue,
  };
}

function parseParam(value: unknown, fallback: ParamState): ParamState {
  if (!isRecord(value)) return fallback;

  const base = asFiniteNumber(value.base);
  const step = asFiniteNumber(value.step);
  const mode = MODES.includes(value.mode as Mode) ? (value.mode as Mode) : null;
  if (base === null || step === null || mode === null) return fallback;

  const events = Array.isArray(value.events)
    ? value.events.map(parseEvent).filter((event): event is ModelEvent => event !== null)
    : [];

  return { base, mode, step, events };
}

function parseChartPrefs(value: unknown, fallback: ChartPrefs): ChartPrefs {
  if (!isRecord(value)) return fallback;
  return {
    showStaff: typeof value.showStaff === 'boolean' ? value.showStaff : fallback.showStaff,
    showVisits: typeof value.showVisits === 'boolean' ? value.showVisits : fallback.showVisits,
    showSeats: typeof value.showSeats === 'boolean' ? value.showSeats : fallback.showSeats,
    granularity: GRANULARITIES.includes(value.granularity as Granularity)
      ? (value.granularity as Granularity)
      : fallback.granularity,
  };
}

function parseHorizonMonths(
  value: Record<string, unknown>,
  version: number,
  fallback: number,
): number {
  const raw =
    version === LEGACY_VERSION
      ? asFiniteNumber(value.horizonYears)
      : asFiniteNumber(value.horizonMonths);
  if (raw === null) return fallback;
  const months = version === LEGACY_VERSION ? raw * 12 : raw;
  return Math.min(MAX_HORIZON_MONTHS, Math.max(MIN_HORIZON_MONTHS, Math.round(months)));
}

/** Returns null when the data is incompatible with the current model version. */
export function parseState(value: unknown, now: Date = new Date()): ModelState | null {
  if (!isRecord(value)) return null;
  const version = asFiniteNumber(value.version);
  if (version !== LEGACY_VERSION && version !== STATE_VERSION) return null;

  const defaults = createDefaultState(now);
  const startYear = asFiniteNumber(value.startYear);
  const startMonth = asFiniteNumber(value.startMonth);
  if (startYear === null || startMonth === null) return null;
  if (startYear < 1990 || startYear > 2200 || startMonth < 0 || startMonth > 11) return null;

  return {
    version: STATE_VERSION,
    startYear: Math.round(startYear),
    startMonth: Math.round(startMonth),
    horizonMonths: parseHorizonMonths(value, version, defaults.horizonMonths),
    staff: parseParam(value.staff, defaults.staff),
    seats: parseParam(value.seats, defaults.seats),
    attendance: parseParam(value.attendance, defaults.attendance),
    chartPrefs: parseChartPrefs(value.chartPrefs, defaults.chartPrefs),
  };
}

export function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadState(storage: StorageLike | null = getBrowserStorage()): ModelState {
  if (!storage) return createDefaultState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = parseState(JSON.parse(raw));
      if (parsed) return parsed;
    }

    const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = parseState(JSON.parse(legacyRaw));
      if (migrated) {
        saveState(migrated, storage);
        storage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }

    return createDefaultState();
  } catch {
    return createDefaultState();
  }
}

export function saveState(
  state: ModelState,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota exceeded: skip silently */
  }
}

export function clearState(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}