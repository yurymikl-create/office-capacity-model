import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChartPrefs,
  HorizonYears,
  ModelEvent,
  ModelState,
  Mode,
  ParamKey,
  ParamState,
  PresetChoice,
  PresetId,
} from '../types';
import { createDefaultState } from '../data/defaults';
import { buildPresetState } from '../data/presets';
import { addMonths, buildMonthly, chartSeries, compareEvents, summarize } from '../lib/calc';
import { clearState, loadState, saveState } from '../lib/storage';
import { createId } from '../lib/id';

const AUTOSAVE_DELAY = 150;

function withParam(
  state: ModelState,
  key: ParamKey,
  param: ParamState,
  scenarioId: PresetId,
): ModelState {
  const next: ModelState = { ...state, scenarioId };
  if (key === 'staff') return { ...next, staff: param };
  if (key === 'seats') return { ...next, seats: param };
  return { ...next, attendance: param };
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
  const chart = useMemo(() => chartSeries(state, points), [state, points]);

  const crossing = useMemo(() => {
    if (summary.crossingIndex === null) return null;
    const point = points[summary.crossingIndex];
    if (!point) return null;
    return {
      x: chart.isYearly ? String(point.year) : point.shortLabel,
      label: `Seats run out: ${point.label}`,
    };
  }, [summary.crossingIndex, points, chart.isYearly]);

  const updateParam = useCallback((key: ParamKey, patch: Partial<ParamState>) => {
    setState((prev) => withParam(prev, key, { ...prev[key], ...patch }, 'custom'));
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
      return withParam(prev, key, { ...param, events: [...param.events, event] }, 'custom');
    });
  }, []);

  const updateEvent = useCallback((key: ParamKey, id: string, patch: Partial<ModelEvent>) => {
    setState((prev) => {
      const param = prev[key];
      const events = param.events.map((event) => (event.id === id ? { ...event, ...patch } : event));
      return withParam(prev, key, { ...param, events }, 'custom');
    });
  }, []);

  const removeEvent = useCallback((key: ParamKey, id: string) => {
    setState((prev) => {
      const param = prev[key];
      const events = param.events.filter((event) => event.id !== id);
      return withParam(prev, key, { ...param, events }, 'custom');
    });
  }, []);

  const setHorizon = useCallback((horizonYears: HorizonYears) => {
    setState((prev) => ({ ...prev, horizonYears, scenarioId: 'custom' }));
  }, []);

  const setStart = useCallback((startYear: number, startMonth: number) => {
    setState((prev) => ({
      ...prev,
      startYear,
      startMonth: Math.min(11, Math.max(0, startMonth)),
      scenarioId: 'custom',
    }));
  }, []);

  const applyPreset = useCallback((id: PresetChoice) => {
    setState(buildPresetState(id));
  }, []);

  const resetAll = useCallback(() => {
    skipNextSave.current = true;
    clearState();
    setState(createDefaultState());
  }, []);

  const toggleChartLine = useCallback((key: keyof ChartPrefs) => {
    setState((prev) => ({
      ...prev,
      chartPrefs: { ...prev.chartPrefs, [key]: !prev.chartPrefs[key] },
    }));
  }, []);

  return {
    state,
    points,
    summary,
    chartPoints: chart.points,
    isYearly: chart.isYearly,
    crossing,
    setBase,
    setMode,
    setStep,
    addEvent,
    updateEvent,
    removeEvent,
    setHorizon,
    setStart,
    applyPreset,
    resetAll,
    toggleChartLine,
  };
}

export type CapacityModel = ReturnType<typeof useCapacityModel>;