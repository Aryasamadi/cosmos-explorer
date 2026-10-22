import { useId } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled = false }: SwitchProps) {
  const descriptionId = useId();
  return (
    <label className={`switch-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="switch-row__text">
        <span className="switch-row__label">{label}</span>
        {description ? (
          <span id={descriptionId} className="switch-row__description">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch-input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
    </label>
  );
}
