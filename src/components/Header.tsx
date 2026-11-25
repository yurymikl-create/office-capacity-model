import type { HorizonYears, PresetChoice, PresetId } from '../types';
import { HORIZONS, HORIZON_LABELS } from '../data/defaults';
import { PRESETS } from '../data/presets';

interface HeaderProps {
  horizonYears: HorizonYears;
  scenarioId: PresetId;
  onHorizonChange: (value: HorizonYears) => void;
  onPreset: (id: PresetChoice) => void;
  onReset: () => void;
}

export function Header({
  horizonYears,
  scenarioId,
  onHorizonChange,
  onPreset,
  onReset,
}: HeaderProps) {
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

        <div className="control">
          <span className="control__label">Scenario</span>
          <div className="chips">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="chip"
                aria-pressed={scenarioId === preset.id}
                title={preset.description}
                onClick={() => onPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
            {scenarioId === 'custom' ? <span className="chip chip--static">Custom</span> : null}
          </div>
        </div>

        <button type="button" className="btn btn--danger" onClick={onReset}>
          Clear all
        </button>
      </div>
    </header>
  );
}