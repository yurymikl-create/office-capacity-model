import type { ModelEvent, ParamKey } from '../types';
import { MONTHS_NOMINATIVE, PARAM_META } from '../data/defaults';
import { eventWindowStatus } from '../lib/calc';
import { NumberField } from './NumberField';

interface EventsTableProps {
  paramKey: ParamKey;
  events: ModelEvent[];
  startYear: number;
  startMonth: number;
  horizonMonths: number;
  supportsAbsolute: boolean;
  valueSuffix: string;
  onChange: (id: string, patch: Partial<ModelEvent>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export function EventsTable({
  paramKey,
  events,
  startYear,
  startMonth,
  horizonMonths,
  supportsAbsolute,
  valueSuffix,
  onChange,
  onRemove,
  onAdd,
}: EventsTableProps) {
  const sorted = [...events].sort((a, b) => a.year - b.year || a.month - b.month);
  const hasOutside = sorted.some(
    (event) => eventWindowStatus(event, startYear, startMonth, horizonMonths) !== 'within',
  );

  return (
    <div className="events">
      <div className={`events__head events__head--${supportsAbsolute ? 'percent' : 'count'}`}>
        <span>Date</span>
        <span>Year</span>
        {supportsAbsolute ? <span>Format</span> : null}
        <span>Change</span>
        <span aria-hidden="true" />
      </div>

      {sorted.length === 0 ? (
        <p className="events__empty">No events yet — the value stays at its base.</p>
      ) : (
        sorted.map((event) => {
          const status = eventWindowStatus(event, startYear, startMonth, horizonMonths);
          const valueMin = supportsAbsolute && event.kind === 'absolute' ? 0 : -100000;
          const valueMax = supportsAbsolute && event.kind === 'absolute' ? 100 : 100000;
          return (
            <div
              key={event.id}
              className={`event-row event-row--${supportsAbsolute ? 'percent' : 'count'}${
                status === 'within' ? '' : ' event-row--outside'
              }`}
            >
              <select
                aria-label={`${PARAM_META[paramKey].title}: event month`}
                value={event.month}
                onChange={(changeEvent) => onChange(event.id, { month: Number(changeEvent.target.value) })}
              >
                {MONTHS_NOMINATIVE.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>

              <NumberField
                value={event.year}
                min={2000}
                max={2100}
                onCommit={(year) => onChange(event.id, { year })}
                ariaLabel="Event year"
              />

              {supportsAbsolute ? (
                <select
                  aria-label="Change format"
                  value={event.kind}
                  onChange={(changeEvent) =>
                    onChange(event.id, {
                      kind: changeEvent.target.value === 'absolute' ? 'absolute' : 'delta',
                    })
                  }
                >
                  <option value="delta">delta (pp)</option>
                  <option value="absolute">value (%)</option>
                </select>
              ) : null}

              <NumberField
                value={event.value}
                min={valueMin}
                max={valueMax}
                step={1}
                onCommit={(value) => onChange(event.id, { value })}
                ariaLabel={`Change: ${MONTHS_NOMINATIVE[event.month]} ${event.year}`}
                suffix={valueSuffix}
              />

              <button
                type="button"
                className="icon-button"
                onClick={() => onRemove(event.id)}
                aria-label={`Delete event ${MONTHS_NOMINATIVE[event.month]} ${event.year}`}
                title="Delete event"
              >
                ×
              </button>
            </div>
          );
        })
      )}

      <div className="events__footer">
        <button type="button" className="btn btn--ghost" onClick={onAdd}>
          + Add event
        </button>
        {hasOutside ? (
          <span className="events__note">Events outside the horizon do not affect the model.</span>
        ) : null}
      </div>
    </div>
  );
}