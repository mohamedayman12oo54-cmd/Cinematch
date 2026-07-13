import { useEffect, useRef, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as titlesApi from '../api/titles';
import '../pages/BrowsePages.css';

const NAV_LINKS = [
  { to: '/home', label: 'Discover' },
  { to: '/recommend', label: 'Recommend' },
  { to: '/trending', label: 'Trending' },
];

const AUTH_ONLY_LINKS = [
  { to: '/favorites', label: 'My List' },
];

export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 20); }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function onOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const initial = (user?.email || '?').trim().charAt(0).toUpperCase();
  const navLinks = isAuthenticated ? [...NAV_LINKS, ...AUTH_ONLY_LINKS] : NAV_LINKS;

  return (
    <>
      <header className={`hdr ${scrolled ? 'hdr--scrolled' : ''}`}>
        <div className="hdr__inner">
          <NavLink to="/home" className="hdr__brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="hdr__brand-icon">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 4v5M16 4v5" strokeLinecap="round" />
            </svg>
            <span className="hdr__logo">CINEMATCH</span>
          </NavLink>

          <nav className="hdr__nav">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `hdr__link ${isActive ? 'hdr__link--active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hdr__right">
            <button type="button" className="hdr__search-trigger" onClick={() => setPaletteOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              <span className="hdr__kbd">/</span>
            </button>

            {isAuthenticated ? (
              <div className="hdr__profile" ref={profileRef}>
                <button
                  type="button"
                  className="hdr__auth-btn hdr__auth-btn--solid hdr__dashboard-btn"
                  onClick={() => navigate('/dashboard')}
                >
                  Dashboard
                </button>
                <button type="button" className="hdr__avatar" onClick={() => setMenuOpen(m => !m)}>{initial}</button>
                <div className={`hdr__profile-menu ${menuOpen ? 'hdr__profile-menu--open' : ''}`}>
                  <p className="hdr__profile-email">{user?.email}</p>

                  <button type="button" className="hdr__menu-item" onClick={() => { setMenuOpen(false); navigate('/dashboard'); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
                    Dashboard
                  </button>
                  <button type="button" className="hdr__menu-item" onClick={() => { setMenuOpen(false); navigate('/favorites'); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                    My List
                  </button>
                  <button type="button" className="hdr__menu-item" onClick={() => { setMenuOpen(false); navigate('/history'); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    History
                  </button>
                  <button type="button" className="hdr__menu-item" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    Settings
                  </button>
                  <div className="hdr__menu-divider" />
                  <button type="button" className="hdr__menu-item hdr__menu-item--danger" onClick={() => { logout(); navigate('/home'); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="hdr__auth-buttons">
                <button
                  type="button"
                  className="hdr__auth-btn hdr__auth-btn--ghost"
                  onClick={() => navigate('/signin', { state: { mode: 'login' } })}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="hdr__auth-btn hdr__auth-btn--solid"
                  onClick={() => navigate('/signin', { state: { mode: 'register' } })}
                >
                  Create Account
                </button>
              </div>
            )}

            <button type="button" className="hdr__hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <div className={`hdr__mobile-panel ${mobileOpen ? 'hdr__mobile-panel--open' : ''}`}>
        {navLinks.map(link => (
          <NavLink key={link.to} to={link.to} className="hdr__mobile-link" onClick={() => setMobileOpen(false)}>
            {link.label}
          </NavLink>
        ))}
        {!isAuthenticated && (
          <div className="hdr__mobile-auth">
            <button
              type="button"
              className="hdr__auth-btn hdr__auth-btn--ghost"
              onClick={() => { setMobileOpen(false); navigate('/signin', { state: { mode: 'login' } }); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className="hdr__auth-btn hdr__auth-btn--solid"
              onClick={() => { setMobileOpen(false); navigate('/signin', { state: { mode: 'register' } }); }}
            >
              Create Account
            </button>
          </div>
        )}
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}

function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    titlesApi.search(query, 8).then(res => {
      if (!cancelled) {
        setResults(res.data);
        setActiveIndex(0);
      }
    });
    return () => { cancelled = true; };
  }, [query]);

  function goTo(t) {
    onClose();
    navigate(`/title/${encodeURIComponent(t.title)}`);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      goTo(results[activeIndex]);
    } else if (e.key === 'Enter' && query.trim()) {
      onClose();
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={e => e.stopPropagation()}>
        <div className="cmdk__input-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cmdk__icon">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="cmdk__input"
            type="text"
            placeholder="Search for a title..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="cmdk__esc">esc</span>
        </div>

        {results.length > 0 && (
          <div className="cmdk__results">
            {results.map((t, i) => (
              <button
                key={t.title}
                type="button"
                className={`cmdk__result ${i === activeIndex ? 'cmdk__result--active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => goTo(t)}
              >
                <span className="cmdk__result-name">{t.title}</span>
                <span className="cmdk__result-meta">{t.release_year} &middot; {t.type}</span>
              </button>
            ))}
          </div>
        )}

        {query.trim().length >= 2 && results.length === 0 && (
          <p className="cmdk__empty">No titles found for &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
