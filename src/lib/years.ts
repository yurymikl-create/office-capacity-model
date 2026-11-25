export function buildYearList(min: number, max: number, value: number): number[] {
  const from = Math.round(Math.min(min, value));
  const to = Math.round(Math.max(max, value));
  const years: number[] = [];
  for (let year = from; year <= to; year += 1) {
    years.push(year);
  }
  return years;
}

export function groupYears(years: number[]): { decade: number; years: number[] }[] {
  const groups: { decade: number; years: number[] }[] = [];
  for (const year of years) {
    const decade = Math.floor(year / 10) * 10;
    const last = groups[groups.length - 1];
    if (!last || last.decade !== decade) {
      groups.push({ decade, years: [year] });
    } else {
      last.years.push(year);
    }
  }
  return groups;
}