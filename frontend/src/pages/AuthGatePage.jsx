import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthGatePage.css';

const HEADLINE = 'Before discovering your next favorite movie...';
const SEEN_KEY = 'cinematch_gate_seen';

export default function AuthGatePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const alreadySeen = useMemo(() => sessionStorage.getItem(SEEN_KEY) === '1', []);

  const [typed, setTyped] = useState(alreadySeen ? HEADLINE : '');
  const [typingDone, setTypingDone] = useState(alreadySeen);

  // لو أصلاً مسجل دخول (جه هنا برابط مباشر مثلاً) مفيش داعي يشوف "Sign In"،
  // بس خليه يكمل بريقيه على السبلاش زي أي حد تاني
  useEffect(() => {
    if (isAuthenticated) navigate('/splash', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (alreadySeen) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped(HEADLINE.slice(0, i));
      if (i >= HEADLINE.length) {
        clearInterval(interval);
        setTypingDone(true);
        sessionStorage.setItem(SEEN_KEY, '1');
      }
    }, 28);
    return () => clearInterval(interval);
  }, [alreadySeen]);

  const instant = alreadySeen ? 'gate--instant' : '';

  // بعد ما رسالة الترحيب تخلص، كمّل تلقائي لصفحة السبلاش وبعدها الهوم
  // (الدخول اختياري دلوقتي، مش شرط تسجل عشان تتصفح)
  useEffect(() => {
    if (!typingDone) return;
    const delay = alreadySeen ? 300 : 1400;
    const t = setTimeout(() => navigate('/splash'), delay);
    return () => clearTimeout(t);
  }, [typingDone, alreadySeen, navigate]);

  return (
    <div className={`gate ${instant}`}>
      <div className="gate__bg" />
      <div className="gate__overlay" />

      <div className="gate__content">
        <p className="gate__kicker">WELCOME TO CINEMATCH</p>

        <h1 className="gate__headline">
          {typed}
          {!typingDone && <span className="gate__cursor" />}
          {typingDone && <span className="gate__underline" />}
        </h1>

        <p className="gate__description">
          Sign in to unlock personalized recommendations and save your favorites —
          or just keep browsing, no account needed.
        </p>

        <div className="gate__actions">
          <button
            type="button"
            className="gate__btn gate__btn--primary"
            onClick={() => navigate('/signin', { state: { mode: 'login' } })}
          >
            Sign In
          </button>

          <div className="gate__divider"><span /><em>OR</em><span /></div>

          <button
            type="button"
            className="gate__btn gate__btn--secondary"
            onClick={() => navigate('/signin', { state: { mode: 'register' } })}
          >
            Create Account
          </button>
        </div>

        <button type="button" className="gate__skip" onClick={() => navigate('/home')}>
          Continue browsing &rarr;
        </button>

        <p className="gate__legal">
          By continuing, you agree to our{' '}
          <a href="#" className="gate__legal-link">Terms</a> &amp;{' '}
          <a href="#" className="gate__legal-link">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
