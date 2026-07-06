import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import AuthBackground from '../components/AuthBackground';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  const [mode, setMode] = useState(location.state?.mode === 'register' ? 'register' : 'login');
  const [curtainActive, setCurtainActive] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(true);
  const [hasSwitchedOnce, setHasSwitchedOnce] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIntroPlaying(false), 1600);
    return () => clearTimeout(timer);
  }, []);

  function switchMode(nextMode) {
    if (nextMode === mode) return;
    setCurtainActive(true);
    setTimeout(() => {
      setMode(nextMode);
      setCurtainActive(false);
      setHasSwitchedOnce(true);
    }, 380);
  }

  async function handleLogin(payload) {
    const user = await login(payload);
    await new Promise(resolve => setTimeout(resolve, 550));
    navigate('/welcome-back', { state: { name: user.email } });
  }

  async function handleRegister(payload) {
    const user = await register(payload);
    await new Promise(resolve => setTimeout(resolve, 1500));
    navigate('/welcome-back', { state: { name: user.email } });
  }

  return (
    <div className="nf-page">
      <div className={`nf-shutter ${introPlaying ? 'nf-shutter--play' : 'nf-shutter--done'}`} aria-hidden="true">
        <div className="nf-shutter__bar nf-shutter__bar--top" />
        <div className="nf-shutter__bar nf-shutter__bar--bottom" />
        <div className="nf-shutter__brand"><span>CINEMATCH</span></div>
      </div>

      <AuthBackground />

      <header className="nf-header">
        <span className="nf-logo__text">CINEMATCH</span>
      </header>

      <main className="nf-main">
        <div className="nf-curtain-wrap">
          {mode === 'login' ? (
            <LoginForm onSubmit={handleLogin} onSwitchToRegister={() => switchMode('register')} entrance={!hasSwitchedOnce} />
          ) : (
            <RegisterForm onSubmit={handleRegister} onSwitchToLogin={() => switchMode('login')} entrance={!hasSwitchedOnce} />
          )}

          <div className={`nf-curtain ${curtainActive ? 'nf-curtain--active' : ''}`} aria-hidden="true">
            <div className="nf-curtain__panel nf-curtain__panel--left" />
            <div className="nf-curtain__panel nf-curtain__panel--right" />
          </div>
        </div>
      </main>

      <footer className="nf-footer">
        <div className="nf-footer__inner">
          <p className="nf-footer__question">Questions? Contact support.</p>
          <div className="nf-footer__grid">
            <a href="#">FAQ</a>
            <a href="#">Help Center</a>
            <a href="#">Terms of Use</a>
            <a href="#">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
