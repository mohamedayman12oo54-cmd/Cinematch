import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SplashScreen.css';

const STEPS = [0, 8, 17, 31, 46, 58, 74, 89, 100];

export default function SplashScreen() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  const percent = STEPS[stepIndex];

  useEffect(() => {
    if (stepIndex >= STEPS.length - 1) {
      const t = setTimeout(() => setFadeOut(true), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIndex(i => i + 1), 260);
    return () => clearTimeout(t);
  }, [stepIndex]);

  useEffect(() => {
    if (!fadeOut) return;
    const t = setTimeout(() => navigate('/welcome'), 500);
    return () => clearTimeout(t);
  }, [fadeOut, navigate]);

  return (
    <div className={`splash ${fadeOut ? 'splash--out' : ''}`}>
      <div className="splash__vignette" />
      <div className="splash__glow" />

      <div className="splash__content">
        <div className={`splash__mark ${stepIndex > 0 ? 'splash__mark--pulse' : ''}`} key={stepIndex}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
          </svg>
        </div>

        <p className="splash__kicker">
          {'WELCOME TO'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.1 + i * 0.04}s` }}>{ch === ' ' ? '\u00A0' : ch}</span>
          ))}
        </p>

        <h1 className="splash__title">
          {'CINEMATCH'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.55 + i * 0.05}s` }}>{ch}</span>
          ))}
        </h1>

        <p className="splash__subtitle">Content Recommendation Engine</p>

        <div className="splash__loader">
          <div className="splash__loader-track">
            <div className="splash__loader-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="splash__loader-pct">{percent}%</span>
        </div>
      </div>
    </div>
  );
}
