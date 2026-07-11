import { useState } from 'react';
import FormInput from './FormInput';
import PasswordStrength from './PasswordStrength';

/**
 * Minimal-data signup per API contract BR11: email + password only.
 * onSubmit receives { email, password, password_confirmation } and
 * should return a Promise (resolved with the user object on success).
 */
export default function RegisterForm({ onSubmit, onSwitchToLogin, entrance }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  function triggerShake() {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = {};
    if (!email.trim() || !email.includes('@')) errors.email = 'Please enter a valid email address.';
    if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (password !== confirm) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      triggerShake();
      return;
    }

    setLoading(true);
    setFormError('');
    try {
      await onSubmit({ email, password, password_confirmation: confirm });
      setSuccess(true);
    } catch (err) {
      const apiMessage = err?.errors ? Object.values(err.errors)[0]?.[0] : err?.message;
      const base = apiMessage || "We couldn't create your account. Please try again.";
      setFormError(err?.retry_after ? `${base} (${err.retry_after}s)` : base);
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className={`nf-card ${entrance ? 'nf-card--entrance' : ''} nf-card--success`}>
        <div className="nf-success">
          <div className="nf-success__ring">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="nf-success__title">Account Created Successfully</h1>
          <p className="nf-success__subtitle">Welcome to CINEMATCH.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`nf-card ${entrance ? 'nf-card--entrance' : ''} ${shake ? 'nf-card--shake' : ''}`}
      onAnimationEnd={() => setShake(false)}
    >
      <p className="nf-eyebrow">Let's get you set up</p>
      <h1 className="nf-card__title">Create your account</h1>
      <p className="nf-card__subtitle">Just an email and password — that's all we need.</p>

      {formError && <div className="nf-alert">{formError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <FormInput
          id="register-email"
          type="text"
          label="Email address"
          icon="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={fieldErrors.email}
          valid={email.includes('@')}
          animationDelay="0ms"
        />
        <FormInput
          id="register-password"
          type="password"
          label="Password"
          icon="lock"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={fieldErrors.password}
          showToggle
          animationDelay="70ms"
        />
        <PasswordStrength password={password} />
        <FormInput
          id="register-confirm"
          type="password"
          label="Confirm password"
          icon="lock"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          error={fieldErrors.confirm}
          showToggle
          valid={confirm.length > 0 && confirm === password}
          animationDelay="140ms"
        />

        <button type="submit" className="nf-btn-primary" disabled={loading}>
          <span className="nf-btn-primary__shine" />
          {loading ? <span className="nf-spinner" /> : 'Create Account'}
        </button>
      </form>

      <p className="nf-signup-line">
        Already registered? <button type="button" className="nf-link" onClick={onSwitchToLogin}>Sign in instead</button>.
      </p>
    </div>
  );
}
