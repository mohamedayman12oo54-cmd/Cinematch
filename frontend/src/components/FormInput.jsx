import { useState } from 'react';

const ICONS = {
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5 12 13l8.5-6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/**
 * Premium floating-label input:
 * - optional leading icon (email / lock / user)
 * - label floats up on focus/fill
 * - rotating conic-gradient glow ring while focused
 * - small checkmark once a value is present and valid (non-password fields only)
 */
export default function FormInput({
  id,
  type = 'text',
  label,
  icon,
  value,
  onChange,
  error,
  showToggle = false,
  valid,
  animationDelay,
}) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && reveal ? 'text' : type;
  const active = focused || (value && value.length > 0);
  const showValid = valid && !error && value && value.length > 0 && !isPassword;
  const hasTrailing = showToggle || showValid;

  return (
    <div
      className={[
        'nf-field',
        'nf-stagger-item',
        error && 'nf-field--error',
        focused && 'nf-field--focused',
        icon && 'nf-field--icon',
        hasTrailing && 'nf-field--trailing',
      ].filter(Boolean).join(' ')}
      style={{ animationDelay }}
    >
      <div className="nf-field__glow" aria-hidden="true" />

      {icon && <span className="nf-field__icon">{ICONS[icon]}</span>}

      <input
        id={id}
        type={inputType}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="nf-field__input"
        placeholder=" "
        autoComplete={isPassword ? 'current-password' : 'email'}
      />
      <label htmlFor={id} className={`nf-field__label ${active ? 'nf-field__label--active' : ''}`}>
        {label}
      </label>

      {showValid && <span className="nf-field__check">&#10003;</span>}

      {showToggle && isPassword && (
        <button
          type="button"
          className="nf-field__toggle"
          onClick={() => setReveal(r => !r)}
          tabIndex={-1}
        >
          {reveal ? 'Hide' : 'Show'}
        </button>
      )}

      {error && <p className="nf-field__error">{error}</p>}
    </div>
  );
}
