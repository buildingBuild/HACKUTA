import { useId } from 'react';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  prefix?: string;
  hint?: string;
  autoFocus?: boolean;
  maxLength?: number;
}

/** Underline input with a red line that draws in on focus. */
export function Field({ label, value, onChange, onBlur, placeholder, prefix, hint, autoFocus, maxLength = 64 }: Props) {
  const id = useId();
  return (
    <div className={`field ${value ? 'field--filled' : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="field__row">
        {prefix && <span className="field__prefix">{prefix}</span>}
        <input
          id={id}
          className="field__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          maxLength={maxLength}
        />
        <span className="field__check" aria-hidden="true">✓</span>
        {hint && (
          <span className="field__info" tabIndex={0} aria-describedby={`${id}-tip`}>
            i
            <span role="tooltip" id={`${id}-tip`} className="field__tip">
              {hint}
            </span>
          </span>
        )}
      </div>
      <span className="field__underline" aria-hidden="true" />
    </div>
  );
}
