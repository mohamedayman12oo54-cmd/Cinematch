import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './SettingsPage.css';

const STAGE_INFO = {
  stranger: { label: 'Stranger', desc: "You haven't added any Favorites or Watch History yet." },
  explorer: { label: 'Explorer', desc: "You've started building your taste profile." },
  regular: { label: 'Regular', desc: 'CineMatch has a solid picture of what you like.' },
  loyal: { label: 'Loyal', desc: 'CineMatch knows your taste really well by now.' },
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  const stageInfo = STAGE_INFO[user?.stage] || STAGE_INFO.stranger;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/home');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="bp">
      <Header />
      <main className="bp__main settings-page">
        <div className="bp__intro">
          <p className="bp__eyebrow">Account</p>
          <h1 className="bp__title">Settings</h1>
        </div>

        <section className="settings-card">
          <h2 className="settings-card__title">Account Info</h2>
          <div className="settings-row">
            <span className="settings-row__label">Email</span>
            <span className="settings-row__value">{user?.email}</span>
          </div>
          <div className="settings-row">
            <span className="settings-row__label">Stage</span>
            <span className="settings-row__value">{stageInfo.label}</span>
          </div>
          <p className="settings-card__hint">{stageInfo.desc}</p>
        </section>

        <section className="settings-card">
          <h2 className="settings-card__title">Profile</h2>
          <p className="settings-card__hint">
            Editing your email or password isn't available yet — this needs a backend
            endpoint that doesn't exist in the current API. Ask the backend team to add
            it whenever you're ready to wire it up.
          </p>
          <button
            type="button"
            className="settings-btn settings-btn--outline"
            onClick={() => showToast('Profile editing is coming soon')}
          >
            Edit Profile
          </button>
        </section>

        <section className="settings-card settings-card--danger">
          <h2 className="settings-card__title">Session</h2>
          <p className="settings-card__hint">Sign out of CineMatch on this device.</p>
          <button
            type="button"
            className="settings-btn settings-btn--danger"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </section>
      </main>
    </div>
  );
}
