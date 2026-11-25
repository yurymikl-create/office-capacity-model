import type { ModelEvent, Mode, ParamKey, ParamState } from '../types';
import { PARAM_META } from '../data/defaults';
import { formatNumber } from '../lib/format';
import { ModeTabs } from './ModeTabs';
import { NumberField } from './NumberField';
import { EventsTable } from './EventsTable';

interface ParamCardProps {
  paramKey: ParamKey;
  param: ParamState;
  startYear: number;
  startMonth: number;
  horizonMonths: number;
  onBase: (value: number) => void;
  onMode: (mode: Mode) => void;
  onStep: (value: number) => void;
  onAddEvent: () => void;
  onUpdateEvent: (id: string, patch: Partial<ModelEvent>) => void;
  onRemoveEvent: (id: string) => void;
}

export function ParamCard({
  paramKey,
  param,
  startYear,
  startMonth,
  horizonMonths,
  onBase,
  onMode,
  onStep,
  onAddEvent,
  onUpdateEvent,
  onRemoveEvent,
}: ParamCardProps) {
  const meta = PARAM_META[paramKey];
  const sliderMax = Math.max(meta.sliderMax, param.base);
  const sliderValue = Math.min(Math.max(param.base, meta.min), sliderMax);
  const trendValue = Math.min(
    meta.max,
    Math.max(meta.min, param.base + param.step * 12),
  );

  return (
    <article className="card param">
      <div className="param__head">
        <div>
          <h2 className="param__title">{meta.title}</h2>
          <p className="card__hint">{meta.hint}</p>
        </div>
        <span className="param__value">
          {formatNumber(param.base)}
          <span className="param__unit">{meta.unitShort}</span>
        </span>
      </div>

      <div className="param__row">
        <span className="param__label">Base value</span>
        <div className="param__base">
          <input
            type="range"
            min={meta.min}
            max={sliderMax}
            step={meta.sliderStep}
            value={sliderValue}
            onChange={(event) => onBase(Number(event.target.value))}
            aria-label={`${meta.title}: base value`}
          />
          <NumberField
            value={param.base}
            min={meta.min}
            max={meta.max}
            onCommit={onBase}
            ariaLabel={`${meta.title}: base value, ${meta.unitShort}`}
            suffix={meta.unitShort}
          />
        </div>
      </div>

      <div className="param__row">
        <span className="param__label">Mode</span>
        <ModeTabs name={`mode-${paramKey}`} value={param.mode} onChange={onMode} />
      </div>

      {param.mode === 'trend' ? (
        <div className="param__row">
          <span className="param__label">Monthly step</span>
          <div className="param__trend">
            <NumberField
              value={param.step}
              min={meta.stepMin}
              max={meta.stepMax}
              step={meta.stepStep}
              onCommit={onStep}
              ariaLabel={`${meta.title}: monthly step`}
              suffix={meta.stepUnit}
            />
            <span className="param__note">
              In 12 months: <b>{formatNumber(trendValue)}</b> {meta.unitShort}
            </span>
          </div>
        </div>
      ) : null}

      {param.mode === 'events' ? (
        <EventsTable
          paramKey={paramKey}
          events={param.events}
          startYear={startYear}
          startMonth={startMonth}
          horizonMonths={horizonMonths}
          supportsAbsolute={meta.supportsAbsoluteEvents}
          valueSuffix={meta.unitShort}
          onChange={onUpdateEvent}
          onRemove={onRemoveEvent}
          onAdd={onAddEvent}
        />
      ) : null}
    </article>
  );
}