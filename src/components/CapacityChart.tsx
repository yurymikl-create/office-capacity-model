import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
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
import type { ChartPoint, ChartPrefs, Mode } from '../types';
import { formatInt } from '../lib/format';
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

const LEGEND: { key: keyof ChartPrefs; label: string; color: string }[] = [
  { key: 'showStaff', label: 'Headcount', color: COLORS.staff },
  { key: 'showVisits', label: 'On-site', color: COLORS.visits },
  { key: 'showSeats', label: 'Seats', color: COLORS.seats },
];

const ZONES = [
  { label: 'Spare seats', color: COLORS.green },
  { label: 'Deficit', color: COLORS.danger },
];

interface CapacityChartProps {
  points: ChartPoint[];
  prefs: ChartPrefs;
  isYearly: boolean;
  seatsMode: Mode;
  crossing: { x: string; label: string } | null;
  onToggle: (key: keyof ChartPrefs) => void;
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

/** Round Y-axis ticks with 8% headroom so the top line never touches the edge. */
function buildYScale(points: ChartPoint[]): { max: number; ticks: number[] } {
  const dataMax = Math.max(
    1,
    ...points.map((point) => Math.max(point.staff, point.seats, point.visits)),
  );
  const step = niceStep(dataMax / 5);
  const max = Math.max(step, Math.ceil((dataMax * 1.08) / step) * step);
  const ticks: number[] = [];
  for (let index = 0; index * step <= max + step / 2; index += 1) {
    ticks.push(Math.round(index * step));
  }
  return { max, ticks };
}

interface CrossingLabelProps {
  text: string;
  chartWidth?: number;
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
}

/**
 * Crossing caption: a pill with a white background so it does not blend into
 * the lines, clamped to the plot bounds (otherwise the January label is clipped).
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
  prefs,
  isYearly,
  seatsMode,
  crossing,
  onToggle,
}: CapacityChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const animationDuration = reducedMotion ? 0 : 300;
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(720);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const update = () => setChartWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoneType: 'stepAfter' | 'linear' = seatsMode === 'events' ? 'stepAfter' : 'linear';
  const seatsLineType: 'stepAfter' | 'linear' = seatsMode === 'events' ? 'stepAfter' : 'linear';

  const xInterval = isYearly ? 0 : points.length <= 14 ? 0 : points.length <= 26 ? 1 : 3;

  const crossingPoint = useMemo(() => {
    if (!crossing) return null;
    return points.find((point) => point.chartLabel === crossing.x) ?? null;
  }, [crossing, points]);

  const yScale = useMemo(() => buildYScale(points), [points]);

  return (
    <section className="card chart-card" aria-labelledby="chart-title">
      <div className="chart-card__head">
        <div>
          <h2 className="card__title" id="chart-title">
            Occupancy forecast
          </h2>
          <p className="card__hint">
            {isYearly ? 'Yearly aggregation: year-end snapshot' : 'Monthly'} · people and seats
          </p>
        </div>

        <div className="legend" role="group" aria-label="Chart series">
          {LEGEND.map((item) => (
            <button
              key={item.key}
              type="button"
              className="legend__chip"
              aria-pressed={prefs[item.key]}
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

      <div className="chart-card__canvas" ref={canvasRef}>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={points} margin={{ top: 40, right: 20, bottom: 8, left: 0 }}>
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
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              tickFormatter={(value: number) => formatInt(value)}
            />
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
              fillOpacity={0.14}
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
              fillOpacity={0.16}
              isAnimationActive={!reducedMotion}
              animationDuration={animationDuration}
              activeDot={false}
            />

            {prefs.showStaff ? (
              <Line
                yAxisId="left"
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
                name="On-site"
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

            {crossing ? (
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}