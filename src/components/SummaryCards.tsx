import type { Summary } from '../types';
import { formatInt, formatPercentValue, seatCount } from '../lib/format';

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  danger?: boolean;
}

function Stat({ label, value, unit, hint, danger }: StatProps) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={danger ? 'stat__value is-danger' : 'stat__value'}>
        {value}
        {unit ? <span className="stat__unit">{unit}</span> : null}
      </span>
      <span className="stat__hint">{hint}</span>
    </div>
  );
}

export function SummaryCards({ summary }: { summary: Summary }) {
  const { final } = summary;
  const hasCrossing = summary.crossingIndex !== null;
  const deficit = summary.maxDeficit;

  return (
    <section className="summary-block" aria-label="Summary">
      <div className="summary">
        <Stat
          label="On-site"
          value={formatInt(final.visits)}
          unit="people"
          hint={`as of ${final.label}`}
        />
        <Stat label="Seats" value={formatInt(final.seats)} unit="seats" hint={`as of ${final.label}`} />
        <Stat
          label="Utilization"
          value={formatPercentValue(final.load)}
          hint={final.deficit > 0 ? 'capacity exceeded' : 'within capacity'}
          danger={final.deficit > 0}
        />
      </div>

      <div className="summary-secondary">
        <Stat
          label="Crossing"
          value={
            hasCrossing && summary.crossingLabel ? summary.crossingLabel : 'No crossing'
          }
          hint={
            hasCrossing
              ? 'on-site demand reached capacity'
              : 'seats suffice for the entire horizon'
          }
          danger={hasCrossing}
        />
        <Stat
          label="Max deficit"
          value={deficit > 0 ? seatCount(deficit) : '0'}
          hint={deficit > 0 && summary.maxDeficitLabel ? `peak — ${summary.maxDeficitLabel}` : 'no deficit'}
          danger={deficit > 0}
        />
      </div>
    </section>
  );
}