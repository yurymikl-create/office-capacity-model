import { useEffect, useState } from 'react';

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  suffix?: string;
  className?: string;
}

/**
 * Numeric field that does not push state on every unfinished keystroke:
 * commits only valid numbers and normalizes the value on blur.
 */
export function NumberField({
  value,
  min,
  max,
  step = 1,
  onCommit,
  ariaLabel,
  suffix,
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed !== value) {
      setDraft(String(value));
    }
    // draft is intentionally not a dependency: otherwise the field overwrites user input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (input: number) => Math.min(Math.max(input, min), max);

  return (
    <span className={className ? `number-field ${className}` : 'number-field'}>
      <input
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw.trim() === '') return;
          const parsed = Number(raw.replace(',', '.'));
          if (Number.isFinite(parsed)) onCommit(clamp(parsed));
        }}
        onBlur={() => {
          const parsed = Number(draft.replace(',', '.'));
          const next = clamp(Number.isFinite(parsed) ? parsed : value);
          onCommit(next);
          setDraft(String(next));
        }}
      />
      {suffix ? <span className="number-field__suffix">{suffix}</span> : null}
    </span>
  );
}