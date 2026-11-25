import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChartLineKey,
  Granularity,
  ModelEvent,
  ModelState,
  Mode,
  ParamKey,
  ParamState,
} from '../types';
import { createDefaultState, MAX_HORIZON_MONTHS, MIN_HORIZON_MONTHS } from '../data/defaults';
import { addMonths, buildMonthly, compareEvents, summarize } from '../lib/calc';
import { aggregatePoints, bucketIndexForMonth, resolveGranularity } from '../lib/chartView';
import { clearState, loadState, saveState } from '../lib/storage';
import { createId } from '../lib/id';

const AUTOSAVE_DELAY = 150;

function withParam(state: ModelState, key: ParamKey, param: ParamState): ModelState {
  if (key === 'staff') return { ...state, staff: param };
  if (key === 'seats') return { ...state, seats: param };
  return { ...state, attendance: param };
}

function nextEventDate(state: ModelState, param: ParamState): { year: number; month: number } {
  if (param.events.length === 0) {
    return { year: state.startYear, month: state.startMonth };
  }
  const latest = [...param.events].sort(compareEvents)[param.events.length - 1];
  if (!latest) return { year: state.startYear, month: state.startMonth };
  return addMonths(latest.year, latest.month, 1);
}

export function useCapacityModel() {
  const [state, setState] = useState<ModelState>(() => loadState());
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => saveState(state), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [state]);

  const points = useMemo(() => buildMonthly(state), [state]);
  const summary = useMemo(() => summarize(points), [points]);
  const granularity = resolveGranularity(state.chartPrefs.granularity, state.horizonMonths);
  const chartPoints = useMemo(
    () => aggregatePoints(points, granularity),
    [points, granularity],
  );

  const crossing = useMemo(() => {
    if (summary.crossingIndex === null) return null;
    const point = points[summary.crossingIndex];
    if (!point) return null;
    const index = bucketIndexForMonth(chartPoints, point.year, point.month);
    const bucket = chartPoints[index];
    if (!bucket) return null;
    return {
      index,
      x: bucket.chartLabel,
      label: `Seats run out: ${point.label}`,
      monthLabel: point.label,
    };
  }, [summary.crossingIndex, points, chartPoints]);

  const updateParam = useCallback((key: ParamKey, patch: Partial<ParamState>) => {
    setState((prev) => withParam(prev, key, { ...prev[key], ...patch }));
  }, []);

  const setBase = useCallback(
    (key: ParamKey, value: number) => updateParam(key, { base: value }),
    [updateParam],
  );

  const setMode = useCallback(
    (key: ParamKey, mode: Mode) => updateParam(key, { mode }),
    [updateParam],
  );

  const setStep = useCallback(
    (key: ParamKey, step: number) => updateParam(key, { step }),
    [updateParam],
  );

  const addEvent = useCallback((key: ParamKey) => {
    setState((prev) => {
      const param = prev[key];
      const date = nextEventDate(prev, param);
      const event: ModelEvent = {
        id: createId(),
        year: date.year,
        month: date.month,
        kind: 'delta',
        value: 0,
      };
      return withParam(prev, key, { ...param, events: [...param.events, event] });
    });
  }, []);

  const updateEvent = useCallback((key: ParamKey, id: string, patch: Partial<ModelEvent>) => {
    setState((prev) => {
      const param = prev[key];
      const events = param.events.map((event) => (event.id === id ? { ...event, ...patch } : event));
      return withParam(prev, key, { ...param, events });
    });
  }, []);

  const removeEvent = useCallback((key: ParamKey, id: string) => {
    setState((prev) => {
      const param = prev[key];
      const events = param.events.filter((event) => event.id !== id);
      return withParam(prev, key, { ...param, events });
    });
  }, []);

  const setHorizonMonths = useCallback((months: number) => {
    const next = Math.min(MAX_HORIZON_MONTHS, Math.max(MIN_HORIZON_MONTHS, Math.round(months)));
    setState((prev) => ({ ...prev, horizonMonths: next }));
  }, []);

  const setStart = useCallback((startYear: number, startMonth: number) => {
    setState((prev) => ({
      ...prev,
      startYear,
      startMonth: Math.min(11, Math.max(0, startMonth)),
    }));
  }, []);

  const resetAll = useCallback(() => {
    skipNextSave.current = true;
    clearState();
    setState(createDefaultState());
  }, []);

  const toggleChartLine = useCallback((key: ChartLineKey) => {
    setState((prev) => ({
      ...prev,
      chartPrefs: { ...prev.chartPrefs, [key]: !prev.chartPrefs[key] },
    }));
  }, []);

  const setGranularity = useCallback((next: Granularity) => {
    setState((prev) => ({
      ...prev,
      chartPrefs: { ...prev.chartPrefs, granularity: next },
    }));
  }, []);

  return {
    state,
    points,
    summary,
    chartPoints,
    granularity,
    crossing,
    setBase,
    setMode,
    setStep,
    addEvent,
    updateEvent,
    removeEvent,
    setHorizonMonths,
    setStart,
    resetAll,
    toggleChartLine,
    setGranularity,
  };
}

export type CapacityModel = ReturnType<typeof useCapacityModel>;