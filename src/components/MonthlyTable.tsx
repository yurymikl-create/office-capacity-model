import type { MonthPoint } from '../types';
import { formatInt, formatPercentValue } from '../lib/format';

interface MonthlyTableProps {
  points: MonthPoint[];
  crossingIndex: number | null;
}

export function MonthlyTable({ points, crossingIndex }: MonthlyTableProps) {
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <details className="card monthly">
      <summary className="monthly__summary">
        <span className="monthly__title">Monthly table</span>
        <span className="monthly__meta">
          {points.length} months · {first?.label} — {last?.label}
        </span>
      </summary>

      <div className="monthly__wrap">
        <table className="monthly__table">
          <caption className="visually-hidden">
            Headcount, seats, attendance, on-site, deficit and utilization by month
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Headcount</th>
              <th scope="col">Seats</th>
              <th scope="col">Attendance</th>
              <th scope="col">On-site / day</th>
              <th scope="col">Deficit</th>
              <th scope="col">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={point.key} className={index === crossingIndex ? 'is-crossing' : undefined}>
                <td>{point.label}</td>
                <td>{formatInt(point.staff)}</td>
                <td>{formatInt(point.seats)}</td>
                <td>{formatPercentValue(point.attendancePct)}</td>
                <td>{formatInt(point.visits)}</td>
                <td className={point.deficit > 0 ? 'is-deficit' : undefined}>
                  {formatInt(Math.ceil(point.deficit))}
                </td>
                <td>{formatPercentValue(point.load)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}