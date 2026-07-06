import { useState } from 'react';
import { Link } from 'react-router-dom';
import FormInput from './FormInput';

/**
 * Login form.
 * onSubmit receives { email, password } and should return a Promise.
 * Throw an Error with a `.message` inside onSubmit to surface a form-level error.
 */
export default function LoginForm({ onSubmit, onSwitchToRegister, entrance }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  function validate() {
    const errors = {};
    if (!email.trim() || !email.includes('@')) errors.email = 'Please enter a valid email or phone number.';
    if (!password) errors.password = 'Your password must contain between 4 and 60 characters.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      triggerShake();
      return;
    }

    setLoading(true);
    setFormError('');
    try {
      await onSubmit({ email, password });
      setSuccess(true);
    } catch (err) {
      setFormError(err?.message || 'Sign-in failed. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  function triggerShake() {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  }

  return (
    <div
      className={`nf-card ${entrance ? 'nf-card--entrance' : ''} ${shake ? 'nf-card--shake' : ''}`}
      onAnimationEnd={() => setShake(false)}
    >
      <p className="nf-eyebrow">Welcome back</p>
      <h1 className="nf-card__title">Sign In</h1>
      <p className="nf-card__subtitle">Welcome back to CINEMATCH.</p>

      {formError && <div className="nf-alert">{formError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <FormInput
          id="login-email"
          type="text"
          label="Email or phone number"
          icon="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={fieldErrors.email}
          valid={email.includes('@')}
          animationDelay="0ms"
        />
        <FormInput
          id="login-password"
          type="password"
          label="Password"
          icon="lock"
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={fieldErrors.password}
          showToggle
          animationDelay="70ms"
        />

        <button type="submit" className={`nf-btn-primary ${success ? 'nf-btn-primary--success' : ''}`} disabled={loading || success}>
          <span className="nf-btn-primary__shine" />
          {success ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="nf-btn-check">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : loading ? (
            <span className="nf-spinner" />
          ) : (
            'Sign In'
          )}
        </button>

        <div className="nf-row-between">
          <label className="nf-remember">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password" className="nf-link-muted">Need help?</Link>
        </div>
      </form>

      <div className="nf-divider">OR</div>

      <div className="nf-social">
        <button type="button" className="nf-social-btn">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.9 2 2.7 6.1 2.7 11.2S6.9 20.4 12 20.4c6.9 0 9.6-4.9 9.6-7.4 0-.5-.1-.9-.1-1.3H12z" />
          </svg>
          Google
        </button>
        <button type="button" className="nf-social-btn">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.58 2 12.2c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.5v-1.75c-2.78.62-3.37-1.37-3.37-1.37-.46-1.2-1.11-1.52-1.11-1.52-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.34 1.12 2.91.85.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.05 0-1.12.39-2.03 1.03-2.74-.1-.26-.45-1.32.1-2.75 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.9-1.33 2.75-1.05 2.75-1.05.55 1.43.2 2.49.1 2.75.64.71 1.03 1.62 1.03 2.74 0 3.92-2.34 4.78-4.57 5.04.36.32.68.94.68 1.9v2.82c0 .28.18.6.69.5A10.03 10.03 0 0 0 22 12.2C22 6.58 17.52 2 12 2z" />
          </svg>
          GitHub
        </button>
      </div>

      <p className="nf-signup-line">
        New here? <button type="button" className="nf-link" onClick={onSwitchToRegister}>Create an account now</button>.
      </p>

      <p className="nf-legal">
        This page is protected by reCAPTCHA to ensure you're not a bot.{' '}
        <a href="#" className="nf-link-muted">Learn more.</a>
      </p>
    </div>
  );
}
