import { useMemo, useState, useRef, useEffect } from 'react';
import TITLES from '../data/mockTitles';

export default function SearchBar({ onSelectTitle }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return TITLES.filter(t => t.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search" ref={wrapRef}>
      <svg className="search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" strokeLinecap="round" />
      </svg>
      <input
        className="search__input"
        type="text"
        placeholder="Search titles..."
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />

      {open && results.length > 0 && (
        <div className="search__dropdown">
          {results.map(t => (
            <button
              key={t.id}
              type="button"
              className="search__result"
              onClick={() => {
                onSelectTitle?.(t);
                setQuery(t.name);
                setOpen(false);
              }}
            >
              <span className="search__result-swatch" style={{ background: t.gradient }} />
              <span className="search__result-text">
                <span className="search__result-name">{t.name}</span>
                <span className="search__result-meta">{t.year} &middot; {t.genre}</span>
              </span>
              <span className="search__result-match">{t.match}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
