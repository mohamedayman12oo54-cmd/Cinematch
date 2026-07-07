import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCatalog } from '../data/catalog';

const SAMPLES = ['Crimson Horizon', 'Solar Drift', 'The Amber Line', 'Wire & Bone', 'Iron Season'];

export default function HeroSearch({ style }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let wordIndex = 0, charIndex = 0, deleting = false, timeout;
    function tick() {
      const word = SAMPLES[wordIndex];
      charIndex += deleting ? -1 : 1;
      setTyped(word.slice(0, charIndex));
      if (!deleting && charIndex === word.length) { deleting = true; timeout = setTimeout(tick, 1500); return; }
      if (deleting && charIndex === 0) { deleting = false; wordIndex = (wordIndex + 1) % SAMPLES.length; }
      timeout = setTimeout(tick, deleting ? 35 : 85);
    }
    timeout = setTimeout(tick, 600);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    function onOutside(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false); }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const suggestions = value.trim().length >= 2 ? searchCatalog(value, 6) : [];

  function submit(q) {
    const query = (q ?? value).trim();
    if (!query) return inputRef.current?.focus();
    setFocused(false);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className={`hs ${focused ? 'hs--focused' : ''}`} ref={wrapRef} style={style}>
      <form className="hs__box" onSubmit={e => { e.preventDefault(); submit(); }}>
        <svg className="hs__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="hs__input"
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
        />
        {!value && (
          <span className="hs__ghost" aria-hidden="true">
            Try &ldquo;{typed}<span className="hs__caret" />&rdquo;
          </span>
        )}
        <button type="submit" className="hs__submit">Find Matches</button>
      </form>

      {focused && suggestions.length > 0 && (
        <div className="hs__dropdown">
          {suggestions.map(t => (
            <button key={t.title} type="button" className="hs__suggestion" onClick={() => submit(t.title)}>
              <span className="hs__suggestion-name">{t.title}</span>
              <span className="hs__suggestion-meta">{t.release_year} &middot; {t.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
