import { useMemo } from 'react';
import { buildYearList, groupYears } from '../lib/years';

interface YearSelectProps {
  value: number;
  onChange: (year: number) => void;
  min: number;
  max: number;
  ariaLabel: string;
  className?: string;
}

export function YearSelect({
  value,
  onChange,
  min,
  max,
  ariaLabel,
  className,
}: YearSelectProps) {
  const years = useMemo(() => buildYearList(min, max, value), [min, max, value]);
  const grouped = years.length > 20;
  const groups = useMemo(() => (grouped ? groupYears(years) : []), [grouped, years]);

  return (
    <select
      className={className}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {grouped
        ? groups.map((group) => (
            <optgroup key={group.decade} label={`${group.decade}s`}>
              {group.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </optgroup>
          ))
        : years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
    </select>
  );
}