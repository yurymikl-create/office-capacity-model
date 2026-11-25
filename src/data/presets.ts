import type { ModelState, PresetChoice } from '../types';
import { createDefaultState } from './defaults';
import { createId } from '../lib/id';

export interface PresetDefinition {
  id: PresetChoice;
  label: string;
  description: string;
}

export const PRESETS: PresetDefinition[] = [
  {
    id: 'base',
    label: 'Baseline',
    description: 'Every parameter is flat: 100 people, 100 seats, 60% attendance.',
  },
  {
    id: 'growth',
    label: 'Growth',
    description:
      'Headcount trends at 2% of the base per month (+2 people/mo at a base of 100); seats and attendance stay flat. 5-year horizon.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    description:
      '160 people at 40% attendance (64 on site) with 60 seats: a 4-seat deficit in January, then +20 seats in August.',
  },
];

/**
 * Presets define the whole state: the timeline starts in January of the current
 * year so the "Aug 2026" event from the spec falls inside the horizon.
 */
export function buildPresetState(id: PresetChoice, now: Date = new Date()): ModelState {
  const state = createDefaultState(now);

  switch (id) {
    case 'growth': {
      const step = Math.round(state.staff.base * 0.02 * 10) / 10;
      return {
        ...state,
        horizonYears: 5,
        scenarioId: 'growth',
        staff: { ...state.staff, mode: 'trend', step },
      };
    }
    case 'hybrid':
      return {
        ...state,
        scenarioId: 'hybrid',
        staff: { ...state.staff, base: 160 },
        seats: {
          base: 60,
          mode: 'events',
          step: 0,
          events: [{ id: createId(), year: state.startYear, month: 7, kind: 'delta', value: 20 }],
        },
        attendance: { ...state.attendance, base: 40 },
      };
    case 'base':
    default:
      return { ...state, scenarioId: 'base' };
  }
}