import type { Summary } from '../types';
import { formatPercentValue, seatCount } from '../lib/format';

export function AlertBanner({ summary }: { summary: Summary }) {
  if (summary.crossingIndex !== null && summary.crossingLabel) {
    return (
      <div className="alert alert--danger" role="alert">
        <strong>Average daily on-site will exceed the seats in {summary.crossingLabel}.</strong>{' '}
        <span>Need +{seatCount(summary.needsSeats)}.</span>
      </div>
    );
  }

  if (summary.final.load < 50) {
    return (
      <div className="alert alert--warning" role="status">
        <strong>Average daily on-site is below 50% of capacity.</strong>{' '}
        <span>
          Utilization {formatPercentValue(summary.final.load)} as of {summary.final.label}.
        </span>
      </div>
    );
  }

  return null;
}