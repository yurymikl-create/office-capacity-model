import type { HorizonYears, ModelState, ParamKey, ParamMeta } from '../types';

export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const MONTHS_NOMINATIVE = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const HORIZONS: HorizonYears[] = [1, 2, 5, 10];

export const HORIZON_LABELS: Record<HorizonYears, string> = {
  1: '1 yr',
  2: '2 yrs',
  5: '5 yrs',
  10: '10 yrs',
};

export const PARAM_ORDER: ParamKey[] = ['staff', 'seats', 'attendance'];

export const PARAM_META: Record<ParamKey, ParamMeta> = {
  staff: {
    title: 'Headcount',
    unitShort: 'people',
    hint: 'Everyone on the payroll, including remote staff',
    min: 0,
    max: 100000,
    sliderMax: 500,
    sliderStep: 1,
    stepMin: -50,
    stepMax: 50,
    stepStep: 1,
    stepUnit: 'people/mo',
    supportsAbsoluteEvents: false,
  },
  seats: {
    title: 'Seats',
    unitShort: 'seats',
    hint: 'Physical desks and landing spots in the office',
    min: 1,
    max: 100000,
    sliderMax: 500,
    sliderStep: 1,
    stepMin: -50,
    stepMax: 50,
    stepStep: 1,
    stepUnit: 'seats/mo',
    supportsAbsoluteEvents: false,
  },
  attendance: {
    title: 'Attendance',
    unitShort: '%',
    hint: 'Average share of staff coming to the office',
    min: 0,
    max: 100,
    sliderMax: 100,
    sliderStep: 1,
    stepMin: -10,
    stepMax: 10,
    stepStep: 1,
    stepUnit: 'pp/mo',
    supportsAbsoluteEvents: true,
  },
};

export const DEFAULT_VALUES = {
  staff: 100,
  seats: 100,
  attendance: 60,
} as const;

export const STATE_VERSION = 1;

export function createDefaultState(now: Date = new Date()): ModelState {
  return {
    version: STATE_VERSION,
    startYear: now.getFullYear(),
    startMonth: 0,
    horizonYears: 2,
    staff: { base: DEFAULT_VALUES.staff, mode: 'plateau', step: 0, events: [] },
    seats: { base: DEFAULT_VALUES.seats, mode: 'plateau', step: 0, events: [] },
    attendance: { base: DEFAULT_VALUES.attendance, mode: 'plateau', step: 0, events: [] },
    chartPrefs: { showStaff: true, showVisits: true, showSeats: true },
  };
}