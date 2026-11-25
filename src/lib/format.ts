import { MONTHS_SHORT } from '../data/defaults';

const intFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatInt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return intFormatter.format(Math.round(value));
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter.format(value);
}

export function formatPercentValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${intFormatter.format(Math.round(value))}%`;
}

export function formatDuration(months: number): string {
  const total = Math.max(1, Math.round(months));
  const years = Math.floor(total / 12);
  const rest = total % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
  if (rest > 0) parts.push(`${rest} mo`);
  return parts.join(' ');
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_SHORT[month]} ${year}`;
}

export function shortMonthLabel(year: number, month: number): string {
  return `${MONTHS_SHORT[month]} ${String(year).slice(-2)}`;
}

export function seatCount(value: number): string {
  return `${formatInt(value)} ${Math.round(Math.abs(value)) === 1 ? 'seat' : 'seats'}`;
}