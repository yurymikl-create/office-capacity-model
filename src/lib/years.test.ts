import { describe, expect, it } from 'vitest';
import { buildYearList, groupYears } from './years';

describe('buildYearList', () => {
  it('builds an inclusive range', () => {
    expect(buildYearList(2024, 2028, 2026)).toEqual([2024, 2025, 2026, 2027, 2028]);
  });

  it('includes the selected value even when it is outside the range', () => {
    expect(buildYearList(2026, 2028, 2020)[0]).toBe(2020);
    expect(buildYearList(2026, 2028, 2035).at(-1)).toBe(2035);
  });

  it('handles a single-year range', () => {
    expect(buildYearList(2026, 2026, 2026)).toEqual([2026]);
  });
});

describe('groupYears', () => {
  it('splits years into decades', () => {
    expect(groupYears([2019, 2020, 2021, 2029, 2030])).toEqual([
      { decade: 2010, years: [2019] },
      { decade: 2020, years: [2020, 2021, 2029] },
      { decade: 2030, years: [2030] },
    ]);
  });
});