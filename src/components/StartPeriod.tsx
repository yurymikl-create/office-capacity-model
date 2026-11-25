import { MONTHS_NOMINATIVE } from '../data/defaults';
import { YearSelect } from './YearSelect';

interface StartPeriodProps {
  startYear: number;
  startMonth: number;
  onChange: (year: number, month: number) => void;
}

export function StartPeriod({ startYear, startMonth, onChange }: StartPeriodProps) {
  return (
    <section className="card start-period" aria-labelledby="start-period-title">
      <div className="start-period__text">
        <h2 className="card__title" id="start-period-title">
          Start period
        </h2>
        <p className="card__hint">Events before this month are ignored.</p>
      </div>
      <div className="start-period__fields">
        <select
          aria-label="Start month"
          value={startMonth}
          onChange={(event) => onChange(startYear, Number(event.target.value))}
        >
          {MONTHS_NOMINATIVE.map((month, index) => (
            <option key={month} value={index}>
              {month}
            </option>
          ))}
        </select>
        <YearSelect
          value={startYear}
          min={2000}
          max={2100}
          onChange={(year) => onChange(year, startMonth)}
          ariaLabel="Start year"
          className="start-period__year"
        />
      </div>
    </section>
  );
}