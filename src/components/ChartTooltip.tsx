import type { ChartPoint } from '../types';
import { formatInt, formatPercentValue, seatCount } from '../lib/format';

interface TooltipItem {
  payload?: ChartPoint;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
}

interface RowProps {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}

function Row({ label, value, accent, danger }: RowProps) {
  const className = ['chart-tooltip__row', accent ? 'is-accent' : '', danger ? 'is-danger' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const isBucket = point.bucketKind !== 'month';

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{isBucket ? point.bucketLabel : point.label}</p>
      {isBucket ? <p className="chart-tooltip__sub">worst month: {point.label}</p> : null}
      <dl className="chart-tooltip__rows">
        <Row label="Headcount" value={`${formatInt(point.staff)} people`} />
        <Row label="Seats" value={`${formatInt(point.seats)} seats`} />
        <Row label="Attendance" value={formatPercentValue(point.attendancePct)} />
        <Row label="On-site / day" value={`${formatInt(point.visits)} people`} accent />
        <Row
          label="Deficit"
          value={point.deficit > 0 ? seatCount(Math.ceil(point.deficit)) : '0'}
          danger={point.deficit > 0}
        />
        <Row label="Utilization" value={formatPercentValue(point.load)} />
      </dl>
      <p className="chart-tooltip__note">avg/day = headcount × attendance</p>
    </div>
  );
}