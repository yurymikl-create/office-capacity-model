import type { HorizonYears } from '../types';
import { HORIZONS, HORIZON_LABELS } from '../data/defaults';

interface HeaderProps {
  horizonYears: HorizonYears;
  onHorizonChange: (value: HorizonYears) => void;
  onReset: () => void;
}

export function Header({ horizonYears, onHorizonChange, onReset }: HeaderProps) {
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
            On-site = headcount × attendance. Everything runs and stays in your browser.
          </p>
        </div>
      </div>

      <div className="app-header__controls">
        <div className="control">
          <span className="control__label">Horizon</span>
          <div className="segmented" role="radiogroup" aria-label="Planning horizon">
            {HORIZONS.map((horizon) => (
              <label key={horizon} className="segmented__item">
                <input
                  type="radio"
                  name="horizon"
                  value={horizon}
                  checked={horizonYears === horizon}
                  onChange={() => onHorizonChange(horizon)}
                />
                <span>{HORIZON_LABELS[horizon]}</span>
              </label>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn--danger" onClick={onReset}>
          Clear all
        </button>
      </div>
    </header>
  );
}