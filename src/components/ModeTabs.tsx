import type { Mode } from '../types';

const MODES: { value: Mode; label: string }[] = [
  { value: 'plateau', label: 'Flat' },
  { value: 'trend', label: 'Trend' },
  { value: 'events', label: 'Events' },
];

interface ModeTabsProps {
  name: string;
  value: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeTabs({ name, value, onChange }: ModeTabsProps) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Change mode">
      {MODES.map((mode) => (
        <label key={mode.value} className="segmented__item">
          <input
            type="radio"
            name={name}
            value={mode.value}
            checked={value === mode.value}
            onChange={() => onChange(mode.value)}
          />
          <span>{mode.label}</span>
        </label>
      ))}
    </div>
  );
}