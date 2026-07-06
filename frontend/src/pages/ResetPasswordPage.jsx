import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import FormInput from '../components/FormInput';
import PasswordStrength from '../components/PasswordStrength';
import AuthBackground from '../components/AuthBackground';
import * as authApi from '../api/auth';
import './AuthPage.css';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password, password_confirmation: confirm });
      setDone(true);
      setTimeout(() => navigate('/signin'), 2200);
    } catch (err) {
      setError(err?.message || 'That reset link may have expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nf-page">
      <AuthBackground />

      <header className="nf-header">
        <Link to="/welcome" className="nf-logo__text" style={{ textDecoration: 'none' }}>CINEMATCH</Link>
      </header>

      <main className="nf-main">
        <div className="nf-card nf-card--entrance">
          {!done ? (
            <>
              <p className="nf-eyebrow">Account recovery</p>
              <h1 className="nf-card__title">Set a new password</h1>
              <p className="nf-card__subtitle">Choose something you haven't used before.</p>

              {error && <div className="nf-alert">{error}</div>}
              {!token && (
                <div className="nf-alert">
                  No reset token found in the link. Request a new one from the Forgot Password page.
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <FormInput
                  id="reset-password"
                  type="password"
                  label="New password"
                  icon="lock"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  showToggle
                  animationDelay="0ms"
                />
                <PasswordStrength password={password} />
                <FormInput
                  id="reset-confirm"
                  type="password"
                  label="Confirm new password"
                  icon="lock"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  showToggle
                  valid={confirm.length > 0 && confirm === password}
                  animationDelay="70ms"
                />
                <button type="submit" className="nf-btn-primary" disabled={loading}>
                  <span className="nf-btn-primary__shine" />
                  {loading ? <span className="nf-spinner" /> : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="nf-eyebrow">All set</p>
              <h1 className="nf-card__title">Password updated</h1>
              <p className="nf-card__subtitle">Taking you back to Sign In&hellip;</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
