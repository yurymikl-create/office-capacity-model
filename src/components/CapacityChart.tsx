import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  ChartLineKey,
  ChartPoint,
  ChartPrefs,
  Granularity,
  Mode,
  ResolvedGranularity,
} from '../types';
import { formatInt } from '../lib/format';
import {
  clampViewport,
  fullViewport,
  panViewport,
  zoomViewport,
  type Viewport,
} from '../lib/chartView';
import { ChartTooltip } from './ChartTooltip';

const COLORS = {
  staff: '#8a8a8a',
  visits: '#00f6ff',
  seats: '#ffffff',
  danger: '#ff4d40',
  green: '#00f4ab',
  grid: '#1c1c1c',
  axis: '#2c2c2c',
  muted: '#8a8a8a',
};

const LEGEND: { key: ChartLineKey; label: string; color: string }[] = [
  { key: 'showStaff', label: 'Headcount', color: COLORS.staff },
  { key: 'showVisits', label: 'On-site / day', color: COLORS.visits },
  { key: 'showSeats', label: 'Seats', color: COLORS.seats },
];

const ZONES = [
  { label: 'Spare seats', color: COLORS.green },
  { label: 'Deficit', color: COLORS.danger },
];

const GRANULARITY_OPTIONS: { value: Granularity; label: string; title: string }[] = [
  {
    value: 'auto',
    label: 'Auto',
    title: 'Auto: months up to 2 years, quarters up to 5 years, years beyond',
  },
  { value: 'month', label: 'M', title: 'Monthly' },
  { value: 'quarter', label: 'Q', title: 'Quarterly' },
  { value: 'year', label: 'Y', title: 'Yearly' },
];

const GRANULARITY_LABEL: Record<ResolvedGranularity, string> = {
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Yearly',
};

const UNIT_LABEL: Record<ResolvedGranularity, string> = {
  month: 'months',
  quarter: 'quarters',
  year: 'years',
};

interface CapacityChartProps {
  points: ChartPoint[];
  granularity: ResolvedGranularity;
  prefs: ChartPrefs;
  seatsMode: Mode;
  crossing: { index: number; x: string; label: string; monthLabel: string } | null;
  onToggle: (key: ChartLineKey) => void;
  onGranularity: (value: Granularity) => void;
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

/** Round Y-axis ticks with 8% headroom. */
function niceScale(dataMax: number): { max: number; ticks: number[] } {
  const safeMax = Math.max(1, dataMax);
  const step = niceStep(safeMax / 5);
  const max = Math.max(step, Math.ceil((safeMax * 1.08) / step) * step);
  const ticks: number[] = [];
  for (let index = 0; index * step <= max + step / 2; index += 1) {
    ticks.push(Math.round(index * step));
  }
  return { max, ticks };
}

/** Capacity scale: seats and on-site, optionally including headcount. */
function buildYScale(points: ChartPoint[], includeStaff: boolean): { max: number; ticks: number[] } {
  return niceScale(
    Math.max(
      1,
      ...points.map((point) =>
        Math.max(point.seats, point.visits, includeStaff ? point.staff : 0),
      ),
    ),
  );
}

/** Headcount scale for the right axis. */
function buildStaffScale(points: ChartPoint[]): { max: number; ticks: number[] } {
  return niceScale(Math.max(1, ...points.map((point) => point.staff)));
}

interface CrossingLabelProps {
  text: string;
  chartWidth?: number;
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
}

/**
 * Crossing caption: a pill with a dark background so it does not blend into
 * the lines, clamped to the plot bounds.
 */
function CrossingLabel({ text, chartWidth = 720, viewBox }: CrossingLabelProps) {
  const lineX = viewBox?.x;
  if (typeof lineX !== 'number') return null;

  const plotLeft = 60;
  const plotRight = Math.max(plotLeft + 120, chartWidth - 24);
  const available = plotRight - plotLeft;
  const pillWidth = Math.min(available, text.length * 6.2 + 18);
  const left = Math.min(Math.max(lineX - pillWidth / 2, plotLeft), plotRight - pillWidth);
  const top = (viewBox?.y ?? 0) + 8;

  return (
    <g className="crossing-caption" pointerEvents="none">
      <rect
        x={left}
        y={top}
        width={pillWidth}
        height={21}
        rx={6}
        fill="#060606"
        stroke="rgba(255, 77, 64, 0.45)"
        strokeWidth={1}
      />
      <text
        x={left + pillWidth / 2}
        y={top + 14.5}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#ff6b60"
      >
        {text}
      </text>
    </g>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reduced;
}

export function CapacityChart({
  points,
  granularity,
  prefs,
  seatsMode,
  crossing,
  onToggle,
  onGranularity,
}: CapacityChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const animationDuration = reducedMotion ? 0 : 300;
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<Viewport>(fullViewport(points.length));
  const [chartWidth, setChartWidth] = useState(720);
  const [viewport, setViewport] = useState<Viewport>(() => fullViewport(points.length));

  useEffect(() => {
    setViewport(fullViewport(points.length));
  }, [points.length, granularity]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const update = () => setChartWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = element.getBoundingClientRect();
        const plotLeft = 56;
        const plotWidth = Math.max(1, rect.width - plotLeft - 20);
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - plotLeft) / plotWidth));
        const factor = event.deltaY > 0 ? 1.3 : 0.77;
        setViewport((current) => {
          const safe = clampViewport(current, points.length);
          const anchor = safe.start + Math.round(ratio * (safe.end - safe.start));
          return zoomViewport(safe, factor, points.length, anchor);
        });
        return;
      }
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        const delta = Math.round(event.deltaX / 30);
        if (delta !== 0) {
          setViewport((current) =>
            panViewport(clampViewport(current, points.length), delta, points.length),
          );
        }
      }
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [points.length]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    type Gesture =
      | { mode: 'pan'; startViewport: Viewport; startX: number; startY: number }
      | { mode: 'pinch'; lastDistance: number }
      | null;

    let gesture: Gesture = null;

    const touchDistance = (touches: TouchList) => {
      const first = touches[0];
      const second = touches[1];
      if (!first || !second) return 0;
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        gesture = { mode: 'pinch', lastDistance: touchDistance(event.touches) };
        return;
      }
      const touch = event.touches[0];
      if (touch) {
        gesture = {
          mode: 'pan',
          startViewport: viewRef.current,
          startX: touch.clientX,
          startY: touch.clientY,
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      const current = gesture;
      if (!current) return;

      if (current.mode === 'pinch' && event.touches.length >= 2) {
        event.preventDefault();
        const next = touchDistance(event.touches);
        if (!next || !current.lastDistance) return;
        const factor = current.lastDistance / next;
        current.lastDistance = next;

        const rect = element.getBoundingClientRect();
        const first = event.touches[0];
        const second = event.touches[1];
        const midX =
          first && second ? (first.clientX + second.clientX) / 2 : rect.left + rect.width / 2;
        const plotLeft = 56;
        const plotWidth = Math.max(1, rect.width - plotLeft - 20);
        const ratio = Math.min(1, Math.max(0, (midX - rect.left - plotLeft) / plotWidth));

        setViewport((viewportState) => {
          const safe = clampViewport(viewportState, points.length);
          const anchor = safe.start + Math.round(ratio * (safe.end - safe.start));
          return zoomViewport(safe, factor, points.length, anchor);
        });
        return;
      }

      if (current.mode === 'pan' && event.touches.length === 1) {
        const touch = event.touches[0];
        if (!touch) return;
        const dx = current.startX - touch.clientX;
        const dy = current.startY - touch.clientY;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) <= Math.abs(dy)) return;

        event.preventDefault();
        const rect = element.getBoundingClientRect();
        const plotWidth = Math.max(1, rect.width - 76);
        const buckets = current.startViewport.end - current.startViewport.start + 1;
        const delta = Math.round(dx / Math.max(1, plotWidth / buckets));
        if (delta !== 0) {
          setViewport(panViewport(current.startViewport, delta, points.length));
        }
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) {
        gesture = null;
        return;
      }
      if (gesture?.mode === 'pinch' && event.touches.length === 1) {
        const touch = event.touches[0];
        if (touch) {
          gesture = {
            mode: 'pan',
            startViewport: viewRef.current,
            startX: touch.clientX,
            startY: touch.clientY,
          };
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [points.length]);

  const view = useMemo(() => clampViewport(viewport, points.length), [viewport, points.length]);
  viewRef.current = view;
  const visiblePoints = useMemo(
    () => points.slice(view.start, view.end + 1),
    [points, view.start, view.end],
  );
  const peaks = useMemo(
    () =>
      points.reduce(
        (acc, point) => ({
          capacity: Math.max(acc.capacity, point.seats, point.visits),
          staff: Math.max(acc.staff, point.staff),
        }),
        { capacity: 1, staff: 1 },
      ),
    [points],
  );
  const dualAxis = peaks.staff > peaks.capacity * 1.25;
  const yScale = useMemo(() => buildYScale(points, !dualAxis), [points, dualAxis]);
  const staffScale = useMemo(() => buildStaffScale(points), [points]);

  const axisWidth = Math.max(240, chartWidth - 76);
  const maxTicks = Math.max(3, Math.floor(axisWidth / 64));
  const xInterval = Math.max(0, Math.ceil(visiblePoints.length / maxTicks) - 1);
  const brushTickStep = Math.max(1, Math.ceil(points.length / 6));

  const zoomBy = useCallback(
    (factor: number) => {
      setViewport((current) =>
        zoomViewport(clampViewport(current, points.length), factor, points.length),
      );
    },
    [points.length],
  );

  const fit = useCallback(() => setViewport(fullViewport(points.length)), [points.length]);

  const crossingVisible =
    crossing !== null && crossing.index >= view.start && crossing.index <= view.end;
  const crossingPoint = crossingVisible && crossing ? (points[crossing.index] ?? null) : null;

  const jumpToCrossing = useCallback(() => {
    if (!crossing) return;
    const span = Math.max(2, Math.min(view.end - view.start + 1, 6));
    const start = crossing.index - Math.floor(span / 2);
    setViewport(clampViewport({ start, end: start + span - 1 }, points.length));
  }, [crossing, view.start, view.end, points.length]);

  const first = points[view.start];
  const last = points[view.end];
  const rangeLabel =
    first && last
      ? `${first.bucketLabel} — ${last.bucketLabel} · ${view.end - view.start + 1} ${UNIT_LABEL[granularity]}`
      : '';

  const zoneType: 'stepAfter' | 'linear' = seatsMode === 'events' ? 'stepAfter' : 'linear';
  const seatsLineType: 'stepAfter' | 'linear' = seatsMode === 'events' ? 'stepAfter' : 'linear';

  return (
    <section className="card chart-card" aria-labelledby="chart-title">
      <div className="chart-card__head">
        <div>
          <h2 className="card__title" id="chart-title">
            Occupancy forecast
          </h2>
          <p className="card__hint">
            {GRANULARITY_LABEL[granularity]}
            {granularity === 'month' ? '' : ' · worst month per bucket'} · avg/day = headcount ×
            attendance
            {dualAxis && prefs.showStaff ? ' · right: headcount' : ''}
          </p>
        </div>

        <div className="legend" role="group" aria-label="Chart series">
          {LEGEND.map((item) => (
            <button
              key={item.key}
              type="button"
              className="legend__chip"
              aria-pressed={prefs[item.key]}
              title={
                dualAxis
                  ? item.key === 'showStaff'
                    ? 'Headcount — right axis'
                    : `${item.label} — left axis`
                  : `${item.label} — single scale`
              }
              onClick={() => onToggle(item.key)}
            >
              <span className="legend__swatch" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
          {ZONES.map((zone) => (
            <span key={zone.label} className="legend__zone">
              <span
                className="legend__swatch legend__swatch--zone"
                style={{ background: zone.color }}
              />
              {zone.label}
            </span>
          ))}
        </div>
      </div>

      <div className="chart-toolbar">
        <div className="segmented segmented--compact" role="radiogroup" aria-label="Chart scale">
          {GRANULARITY_OPTIONS.map((option) => (
            <label key={option.value} className="segmented__item" title={option.title}>
              <input
                type="radio"
                name="chart-granularity"
                value={option.value}
                checked={prefs.granularity === option.value}
                onChange={() => onGranularity(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        <div className="chart-zoom">
          <button
            type="button"
            className="zoom-button"
            onClick={() => zoomBy(1.35)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button type="button" className="zoom-button zoom-button--fit" onClick={fit}>
            Fit
          </button>
          <button
            type="button"
            className="zoom-button"
            onClick={() => zoomBy(0.75)}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <span className="chart-range">{rangeLabel}</span>

        {crossing ? (
          <button
            type="button"
            className="chart-jump"
            onClick={jumpToCrossing}
            title="Centre the chart on the crossing month"
          >
            Crossing: {crossing.monthLabel} →
          </button>
        ) : null}
      </div>

      <p className="chart-hint">
        Ctrl/⌘ + scroll or pinch to zoom · drag or swipe to scroll
      </p>

      <div className="chart-card__canvas" ref={canvasRef}>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={points} margin={{ top: 40, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="chartLabel"
              tickLine={false}
              axisLine={{ stroke: COLORS.axis }}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              interval={xInterval}
              minTickGap={12}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              width={56}
              allowDecimals={false}
              domain={[0, yScale.max]}
              ticks={yScale.ticks}
              tick={{ fill: '#d6d6d6', fontSize: 11 }}
              tickFormatter={(value: number) => formatInt(value)}
            />
            {dualAxis && prefs.showStaff ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                width={52}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, staffScale.max]}
                ticks={staffScale.ticks}
                tick={{ fill: COLORS.staff, fontSize: 11 }}
                tickFormatter={(value: number) => formatInt(value)}
              />
            ) : null}
            <Tooltip
              content={<ChartTooltip />}
              isAnimationActive={false}
              cursor={{ stroke: '#3a3a3a', strokeDasharray: '4 4' }}
              wrapperStyle={{ outline: 'none', zIndex: 5 }}
            />

            <Area
              yAxisId="left"
              type={zoneType}
              dataKey="zoneBase"
              stackId="zones"
              stroke="none"
              fill="none"
              isAnimationActive={!reducedMotion}
              animationDuration={animationDuration}
              activeDot={false}
            />
            <Area
              yAxisId="left"
              type={zoneType}
              dataKey="zoneGreen"
              stackId="zones"
              stroke="none"
              fill={COLORS.green}
              fillOpacity={0.2}
              isAnimationActive={!reducedMotion}
              animationDuration={animationDuration}
              activeDot={false}
            />
            <Area
              yAxisId="left"
              type={zoneType}
              dataKey="zoneRed"
              stackId="zones"
              stroke="none"
              fill={COLORS.danger}
              fillOpacity={0.3}
              isAnimationActive={!reducedMotion}
              animationDuration={animationDuration}
              activeDot={false}
            />

            {prefs.showStaff ? (
              <Line
                yAxisId={dualAxis ? 'right' : 'left'}
                type="linear"
                dataKey="staff"
                name="Headcount"
                stroke={COLORS.staff}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                isAnimationActive={!reducedMotion}
                animationDuration={animationDuration}
              />
            ) : null}

            {prefs.showVisits ? (
              <Line
                yAxisId="left"
                type="linear"
                dataKey="visits"
                name="On-site / day"
                stroke={COLORS.visits}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={!reducedMotion}
                animationDuration={animationDuration}
              />
            ) : null}

            {prefs.showSeats ? (
              <Line
                yAxisId="left"
                type={seatsLineType}
                dataKey="seats"
                name="Seats"
                stroke={COLORS.seats}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={!reducedMotion}
                animationDuration={animationDuration}
              />
            ) : null}

            {crossing && crossingVisible ? (
              <ReferenceLine
                yAxisId="left"
                x={crossing.x}
                stroke={COLORS.danger}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={<CrossingLabel text={crossing.label} chartWidth={chartWidth} />}
              />
            ) : null}

            {crossingPoint ? (
              <ReferenceDot
                yAxisId="left"
                x={crossingPoint.chartLabel}
                y={crossingPoint.seats}
                r={4}
                fill={COLORS.danger}
                stroke="#060606"
                strokeWidth={2}
                className="crossing-dot"
              />
            ) : null}

            <Brush
              dataKey="chartLabel"
              height={30}
              travellerWidth={8}
              startIndex={view.start}
              endIndex={view.end}
              onChange={(range) => {
                if (
                  typeof range.startIndex === 'number' &&
                  typeof range.endIndex === 'number'
                ) {
                  setViewport(
                    clampViewport(
                      { start: range.startIndex, end: range.endIndex },
                      points.length,
                    ),
                  );
                }
              }}
              tickFormatter={(value, index) =>
                index % brushTickStep === 0 ? String(value) : ''
              }
              fill="rgba(255, 255, 255, 0.03)"
              stroke="#2c2c2c"
              ariaLabel="Timeline scrollbar"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}