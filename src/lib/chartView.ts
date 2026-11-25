import type { ChartPoint, Granularity, MonthPoint, ResolvedGranularity } from '../types';

export interface Viewport {
  start: number;
  end: number;
}

export const MIN_VISIBLE_BUCKETS = 2;

export function resolveGranularity(
  pref: Granularity,
  horizonMonths: number,
): ResolvedGranularity {
  if (pref !== 'auto') return pref;
  if (horizonMonths <= 24) return 'month';
  if (horizonMonths <= 60) return 'quarter';
  return 'year';
}

function quarterOf(month: number): number {
  return Math.floor(month / 3) + 1;
}

function bucketKey(point: MonthPoint, granularity: ResolvedGranularity): string {
  if (granularity === 'month') return `${point.year}-${point.month}`;
  if (granularity === 'quarter') return `${point.year}-Q${quarterOf(point.month)}`;
  return String(point.year);
}

/**
 * A bucket is represented by its worst month: maximum deficit first, then
 * maximum utilization, then the earliest month. All values in the bucket come
 * from that single month, so deficit and utilization stay consistent.
 */
function isWorse(candidate: MonthPoint, current: MonthPoint): boolean {
  if (candidate.deficit !== current.deficit) return candidate.deficit > current.deficit;
  return candidate.load > current.load;
}

export function aggregatePoints(
  points: MonthPoint[],
  granularity: ResolvedGranularity,
): ChartPoint[] {
  if (granularity === 'month') {
    return points.map((point) => ({
      ...point,
      chartLabel: point.shortLabel,
      bucketLabel: point.label,
      bucketKind: 'month',
      bucketEndYear: point.year,
      bucketEndMonth: point.month,
    }));
  }

  const groups: { key: string; points: MonthPoint[] }[] = [];
  let currentKey = '';

  for (const point of points) {
    const key = bucketKey(point, granularity);
    if (key !== currentKey) {
      groups.push({ key, points: [] });
      currentKey = key;
    }
    groups[groups.length - 1]?.points.push(point);
  }

  return groups.map((group) => {
    const first = group.points[0];
    const last = group.points[group.points.length - 1];
    if (!first || !last) {
      throw new Error('Empty aggregation bucket');
    }
    const representative = group.points.reduce(
      (best, point) => (isWorse(point, best) ? point : best),
      first,
    );
    const quarter = quarterOf(representative.month);

    return {
      ...representative,
      chartLabel:
        granularity === 'quarter'
          ? `Q${quarter} ${String(representative.year).slice(-2)}`
          : String(representative.year),
      bucketLabel:
        granularity === 'quarter' ? `Q${quarter} ${representative.year}` : String(representative.year),
      bucketKind: granularity,
      bucketEndYear: last.year,
      bucketEndMonth: last.month,
    };
  });
}

/** Index of the bucket whose period contains the given month (or the last bucket). */
export function bucketIndexForMonth(
  points: ChartPoint[],
  year: number,
  month: number,
): number {
  if (points.length === 0) return 0;
  const target = year * 12 + month;
  const index = points.findIndex(
    (point) => point.bucketEndYear * 12 + point.bucketEndMonth >= target,
  );
  return index === -1 ? points.length - 1 : index;
}

export function fullViewport(count: number): Viewport {
  return { start: 0, end: Math.max(0, count - 1) };
}

export function clampViewport(viewport: Viewport, count: number): Viewport {
  if (count <= 1) return fullViewport(count);

  const minSpan = Math.min(MIN_VISIBLE_BUCKETS, count) - 1;
  let start = Math.round(viewport.start);
  let end = Math.round(viewport.end);

  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  if (end - start < minSpan) end = start + minSpan;
  if (start < 0) {
    start = 0;
    end = Math.max(minSpan, end);
  }
  if (end > count - 1) {
    end = count - 1;
    start = Math.min(start, end - minSpan);
  }

  return { start: Math.max(0, start), end: Math.max(0, Math.min(count - 1, end)) };
}

export function zoomViewport(
  viewport: Viewport,
  factor: number,
  count: number,
  anchorIndex?: number,
): Viewport {
  if (count <= 1) return fullViewport(count);

  const minSpan = Math.min(MIN_VISIBLE_BUCKETS, count) - 1;
  const span = viewport.end - viewport.start;
  const nextSpan = Math.max(minSpan, Math.min(count - 1, Math.round(span * factor)));
  const anchor = Math.min(
    viewport.end,
    Math.max(viewport.start, anchorIndex ?? (viewport.start + viewport.end) / 2),
  );
  const ratio = span === 0 ? 0.5 : (anchor - viewport.start) / span;
  const start = Math.round(anchor - nextSpan * ratio);

  return clampViewport({ start, end: start + nextSpan }, count);
}

export function panViewport(viewport: Viewport, delta: number, count: number): Viewport {
  const safe = clampViewport(viewport, count);
  const width = safe.end - safe.start;
  const maxStart = Math.max(0, count - 1 - width);
  const start = Math.min(Math.max(safe.start + Math.round(delta), 0), maxStart);
  return { start, end: start + width };
}