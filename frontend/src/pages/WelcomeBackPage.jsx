import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WelcomeBackPage.css';

const STATUS_LINES = [
  'Initializing Recommendation Engine...',
  'Loading your profile...',
  'Analyzing your preferences...',
  'Preparing Discover page...',
  'Ready.',
];

export default function WelcomeBackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const name = (location.state?.name || '').split('@')[0] || 'there';

  const [statusIndex, setStatusIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [logoDocked, setLogoDocked] = useState(false);

  useEffect(() => {
    const dockTimer = setTimeout(() => setLogoDocked(true), 500);

    const start = performance.now();
    const duration = 2000;
    let frame;
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      setProgress(Math.round(p * 100));
      setStatusIndex(Math.min(STATUS_LINES.length - 1, Math.floor(p * STATUS_LINES.length)));
      if (p < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => { clearTimeout(dockTimer); cancelAnimationFrame(frame); };
  }, []);

  const ready = progress >= 100;

  function handleContinue() {
    navigate('/home');
  }

  return (
    <div className="wb">
      <div className="wb__glow" />

      <div className={`wb__logo ${logoDocked ? 'wb__logo--docked' : ''}`}>CINEMATCH</div>

      <div className="wb__content">
        <p className="wb__eyebrow">
          {'WELCOME BACK'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.7 + i * 0.03}s` }}>{ch === ' ' ? '\u00A0' : ch}</span>
          ))}
        </p>
        <h1 className="wb__name">{name}</h1>
        <p className="wb__tagline">Your personalized cinema is ready.</p>

        <div className="wb__status">
          <span key={statusIndex} className="wb__status-text">{STATUS_LINES[statusIndex]}</span>
        </div>

        <div className="wb__progress">
          <div className="wb__progress-track">
            <div className="wb__progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <button
          type="button"
          className={`wb__continue ${ready ? 'wb__continue--visible' : ''}`}
          onClick={handleContinue}
          disabled={!ready}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
