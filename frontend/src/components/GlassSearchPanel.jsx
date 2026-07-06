import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { searchCatalog } from '../data/catalog';
import { posterFor, fallbackPoster } from '../api/tmdb';

function ResultThumb({ item }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    posterFor(item.title, item.release_year, item.type).then(u => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [item.title, item.release_year, item.type]);
  return <img className="ai-result__poster" src={url || fallbackPoster(item.title, '')} alt={item.title} />;
}

export default function GlassSearchPanel() {
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);
  const [value, setValue] = useState('');
  const [scanKey, setScanKey] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  function handleFocus() {
    setFocused(true);
    setScanKey(k => k + 1);
  }

  const results = value.trim().length >= 2 ? searchCatalog(value, 6) : [];

  function submit(q) {
    const query = (q ?? value).trim();
    if (!query) return inputRef.current?.focus();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className={`ai-search ${focused ? 'ai-search--focused' : ''}`} ref={wrapRef}>
      <form
        className="ai-search__panel"
        onSubmit={e => { e.preventDefault(); submit(); }}
      >
        {focused && <span key={scanKey} className="ai-search__scan" />}

        <svg className="ai-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="ai-search__input"
          type="text"
          placeholder="Search a title..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={handleFocus}
        />
        <button type="submit" className="ai-search__submit">Search</button>
      </form>

      <AnimatePresence>
        {focused && results.length > 0 && (
          <motion.div
            className="ai-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {results.map((item, i) => (
              <motion.button
                key={item.title}
                type="button"
                className="ai-result"
                onClick={() => submit(item.title)}
                initial={{ opacity: 0, y: 26, scale: 0.9, rotateX: -25, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.35, delay: i * 0.045, ease: [0.16, 1, 0.3, 1] }}
              >
                <ResultThumb item={item} />
                <span className="ai-result__info">
                  <span className="ai-result__title">{item.title}</span>
                  <span className="ai-result__meta">{item.release_year} &middot; {item.type}</span>
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
