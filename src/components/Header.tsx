import { HORIZON_PRESETS, MAX_HORIZON_MONTHS, MIN_HORIZON_MONTHS } from '../data/defaults';
import { formatDuration } from '../lib/format';
import { NumberField } from './NumberField';

interface HeaderProps {
  horizonMonths: number;
  onHorizonChange: (months: number) => void;
  onReset: () => void;
}

export function Header({ horizonMonths, onHorizonChange, onReset }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="app-header__titles">
          <p className="app-header__eyebrow">Office capacity model</p>
          <h1 className="app-header__title">
            Headcount — Seats — <span className="text-gradient">Attendance</span>
          </h1>
          <p className="app-header__subtitle">
            Average daily on-site = headcount × attendance. Everything runs and stays in your browser.
          </p>
        </div>
      </div>

      <div className="app-header__controls">
        <div className="control control--horizon">
          <span className="control__label">Horizon</span>
          <div className="horizon">
            <div className="chips">
              {HORIZON_PRESETS.map((preset) => (
                <button
                  key={preset.months}
                  type="button"
                  className="chip"
                  aria-pressed={horizonMonths === preset.months}
                  onClick={() => onHorizonChange(preset.months)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="horizon__custom">
              <NumberField
                value={horizonMonths}
                min={MIN_HORIZON_MONTHS}
                max={MAX_HORIZON_MONTHS}
                onCommit={onHorizonChange}
                ariaLabel="Horizon in months"
                suffix="mo"
              />
              <span className="horizon__hint">{formatDuration(horizonMonths)}</span>
            </div>
          </div>
        </div>

        <button type="button" className="btn btn--danger" onClick={onReset}>
          Clear all
        </button>
      </div>
    </header>
  );
}