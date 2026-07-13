import { useState } from 'react';
import { Link } from 'react-router-dom';
import FormInput from '../components/FormInput';
import AuthBackground from '../components/AuthBackground';
import * as authApi from '../api/auth';
import './AuthPage.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nf-page">
      <AuthBackground />

      <header className="nf-header">
        <Link to="/home" className="nf-logo__text" style={{ textDecoration: 'none' }}>CINEMATCH</Link>
      </header>

      <main className="nf-main">
        <div className="nf-card nf-card--entrance">
          {!sent ? (
            <>
              <p className="nf-eyebrow">Account recovery</p>
              <h1 className="nf-card__title">Forgot your password?</h1>
              <p className="nf-card__subtitle">
                Enter the email on your account and we'll send you a link to reset it.
              </p>

              {error && <div className="nf-alert">{error}</div>}

              <form onSubmit={handleSubmit} noValidate>
                <FormInput
                  id="forgot-email"
                  type="text"
                  label="Email address"
                  icon="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  error={error}
                  animationDelay="0ms"
                />
                <button type="submit" className="nf-btn-primary" disabled={loading}>
                  <span className="nf-btn-primary__shine" />
                  {loading ? <span className="nf-spinner" /> : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="nf-eyebrow">Check your inbox</p>
              <h1 className="nf-card__title">Email sent</h1>
              <p className="nf-card__subtitle">
                If an account exists for <b>{email}</b>, a reset link is on its way.
                It can take a couple of minutes to arrive.
              </p>
              <button type="button" className="nf-btn-primary" onClick={() => setSent(false)}>
                Use a different email
              </button>
            </>
          )}

          <p className="nf-signup-line">
            <Link to="/signin" className="nf-link">&larr; Back to Sign In</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
