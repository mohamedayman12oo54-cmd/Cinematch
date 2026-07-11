import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import MyListCard from '../components/MyListCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as favoritesApi from '../api/favorites';
import { genreAccent } from '../utils/palette';
import './MyListPage.css';

const SORTS = ['Newest Added', 'Oldest', 'Alphabetical', 'Year'];
const TABS = ['All', 'Movies', 'TV Shows'];

function useCountUp(target, active) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const duration = 900;
    const start = performance.now();
    let frame;
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);
  return value;
}

export default function MyListPage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingTitle, setRemovingTitle] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Newest Added');
  const [tab, setTab] = useState('All');
  const [hoverGenre, setHoverGenre] = useState(null);

  useEffect(() => {
    let cancelled = false;
    favoritesApi.listFavorites(user.email)
      .then(res => {
        if (!cancelled) {
          setItems(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [user.email]);

  async function handleRemove(t) {
    setRemovingTitle(t);
    await favoritesApi.removeFavorite(user.email, t);
    showToast('Removed from My List');
    refreshUser();
    setTimeout(() => {
      setItems(items => items.filter(i => i.title !== t));
      setRemovingTitle(null);
    }, 380);
  }

  function handleRate() {
    showToast('Ratings are coming soon');
  }

  const movieCount = items.filter(i => i.type === 'Movie').length;
  const showCount = items.filter(i => i.type === 'TV Show').length;

  const favoriteGenre = useMemo(() => {
    const counts = {};
    items.forEach(i => {
      const g = i.genres?.split(',')[0]?.trim();
      if (g) counts[g] = (counts[g] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '—';
  }, [items]);

  const hoursOfContent = useMemo(() => {
    return items.reduce((sum, i) => sum + (i.type === 'Movie' ? 1.8 : 6), 0);
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (tab === 'Movies') list = list.filter(i => i.type === 'Movie');
    if (tab === 'TV Shows') list = list.filter(i => i.type === 'TV Show');
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q));
    }
    switch (sort) {
      case 'Oldest':
        list.sort((a, b) => new Date(a.added_at) - new Date(b.added_at));
        break;
      case 'Alphabetical':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'Year':
        list.sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
        break;
      default:
        list.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
    }
    return list;
  }, [items, tab, query, sort]);

  const recentlyAdded = useMemo(
    () => [...items].sort((a, b) => new Date(b.added_at) - new Date(a.added_at)).slice(0, 8),
    [items]
  );

  const statsReady = !loading;
  const moviesUp = useCountUp(movieCount, statsReady);
  const showsUp = useCountUp(showCount, statsReady);
  const hoursUp = useCountUp(Math.round(hoursOfContent), statsReady);

  const ambientColor = hoverGenre ? genreAccent(hoverGenre) : '#e50914';

  return (
    <div className="ml" style={{ '--ml-ambient': ambientColor }}>
      <Header />
      <div className="ml__ambient" />

      <section className="ml__hero">
        <p className="ml__eyebrow">Your Personal Cinema Collection</p>
        <h1 className="ml__title">My List</h1>
        <p className="ml__subtitle">Everything you love, all in one place.</p>
        {!loading && <span className="ml__count-badge">{items.length} Saved Titles</span>}
      </section>

      <main className="ml__main">
        <div className="ml__toolbar">
          <div className="ml__search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search inside your collection..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <select className="ml__sort" value={sort} onChange={e => setSort(e.target.value)}>
            {SORTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="ml__tabs">
          {TABS.map(t => (
            <button
              key={t}
              type="button"
              className={`ml__tab ${tab === t ? 'ml__tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && (
          <div className="sk-grid">
            {Array.from({ length: 10 }).map((_, i) => <div className="sk-card" key={i} />)}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="ml__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="ml__empty-icon">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 4v5M16 4v5" strokeLinecap="round" />
            </svg>
            <h2 className="ml__empty-title">Your List is Empty</h2>
            <p className="ml__empty-subtitle">Start saving movies you love, and they'll appear here.</p>
            <Link to="/home" className="ml__explore-btn">Explore Movies</Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <div className="ml__grid">
              {filtered.map((item, i) => (
                <div
                  key={item.title}
                  className={`ml__grid-item ${removingTitle === item.title ? 'ml__grid-item--removing' : ''}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <MyListCard item={item} onRemove={handleRemove} onRate={handleRate} onHoverGenre={setHoverGenre} />
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="ml__empty-filtered">No titles match &ldquo;{query}&rdquo; in this tab.</p>
              )}
            </div>

            {recentlyAdded.length > 0 && (
              <section className="row ml__recent">
                <h2 className="row__title">Recently Added</h2>
                <div className="row__track">
                  {recentlyAdded.map((item, i) => (
                    <div className="row__item" key={item.title} style={{ animationDelay: `${i * 45}ms` }}>
                      <MyListCard item={item} onRemove={handleRemove} onRate={handleRate} onHoverGenre={setHoverGenre} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="ml__stats">
              <div className="ml__stat">
                <span className="ml__stat-value">{moviesUp}</span>
                <span className="ml__stat-label">Movies Saved</span>
              </div>
              <div className="ml__stat">
                <span className="ml__stat-value">{showsUp}</span>
                <span className="ml__stat-label">TV Shows</span>
              </div>
              <div className="ml__stat">
                <span className="ml__stat-value ml__stat-value--text">{favoriteGenre}</span>
                <span className="ml__stat-label">Favorite Genre</span>
              </div>
              <div className="ml__stat">
                <span className="ml__stat-value">{hoursUp}</span>
                <span className="ml__stat-label">Hours of Content</span>
              </div>
            </section>
          </>
        )}

        <footer className="ml__footer">
          Keep exploring. Your next favorite movie is waiting.
        </footer>
      </main>
    </div>
  );
}
