import type { Summary } from '../types';
import { formatPercentValue, seatCount } from '../lib/format';

export function AlertBanner({ summary }: { summary: Summary }) {
  if (summary.crossingIndex !== null && summary.crossingLabel) {
    return (
      <div className="alert alert--danger" role="alert">
        <strong>The office will run out of seats in {summary.crossingLabel}.</strong>{' '}
        <span>Need +{seatCount(summary.needsSeats)}.</span>
      </div>
    );
  }

  if (summary.final.load < 50) {
    return (
      <div className="alert alert--warning" role="status">
        <strong>Office utilization is below 50%.</strong>{' '}
        <span>
          Utilization {formatPercentValue(summary.final.load)} as of {summary.final.label}.
        </span>
      </div>
    );
  }

  return null;
}