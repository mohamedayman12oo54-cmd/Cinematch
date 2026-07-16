import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCatalog } from '../data/catalog';

export default function DiscoverSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const results = value.trim().length >= 2 ? searchCatalog(value, 6) : [];

  function submit(q) {
    const query = (q ?? value).trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className={`dsc-search ${focused ? 'dsc-search--focused' : ''}`} ref={wrapRef}>
      <form className="dsc-search__box" onSubmit={e => { e.preventDefault(); submit(); }}>
        <svg className="dsc-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          className="dsc-search__input"
          type="text"
          placeholder="Search a movie or show you love..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
        />
        <button type="submit" className="dsc-search__submit">Search</button>
      </form>

      {focused && results.length > 0 && (
        <div className="dsc-search__dropdown">
          {results.map(item => (
            <button key={item.title} type="button" className="dsc-search__result" onClick={() => submit(item.title)}>
              <span className="dsc-search__result-name">{item.title}</span>
              <span className="dsc-search__result-meta">{item.release_year} &middot; {item.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
