import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as favoritesApi from '../api/favorites';
import * as historyApi from '../api/history';
import { mockAiSearchHistory, mockUserCreatedAt } from '../data/mockSession';
import CATALOG from '../data/catalog';
import { genreAccent } from '../utils/palette';
import './DashboardPage.css';

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

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

const ACHIEVEMENTS = [
  { key: 'explorer', label: 'Movie Explorer', desc: 'Save your first favorite', test: s => s.favorites >= 1 },
  { key: 'binger', label: 'Weekend Binger', desc: 'Watch 10+ titles', test: s => s.history >= 10 },
  { key: 'genre-fan', label: (s) => `${s.topGenre || 'Genre'} Fan`, desc: 'One genre stands out clearly', test: s => s.topGenreShare >= 0.4 && s.totalSignals >= 3 },
  { key: 'century', label: '100 Movies Watched', desc: 'Watch 100 titles', test: s => s.history >= 100 },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [aiSearches, setAiSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([favoritesApi.listFavorites(user.email), historyApi.listHistory(user.email)])
      .then(([favRes, histRes]) => {
        if (cancelled) return;
        setFavorites(favRes.data);
        setHistory(histRes.data);
        setAiSearches(mockAiSearchHistory(user.email));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFavorites([]);
        setHistory([]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user.email]);

  const createdAt = mockUserCreatedAt(user.email);
  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  const genreCounts = useMemo(() => {
    const counts = {};
    [...favorites, ...history].forEach(item => {
      item.genres?.split(',').forEach(g => {
        const genre = g.trim();
        if (genre) counts[genre] = (counts[genre] || 0) + 1;
      });
    });
    return counts;
  }, [favorites, history]);

  const topGenres = useMemo(
    () => Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
    [genreCounts]
  );

  const totalSignals = favorites.length + history.length;
  const topGenre = topGenres[0]?.[0];
  const topGenreShare = topGenres[0] && totalSignals ? topGenres[0][1] / totalSignals : 0;
  const maxGenreCount = topGenres[0]?.[1] || 1;

  const h = hashString(user.email);
  const avgRating = (4.1 + (h % 9) / 10).toFixed(1);
  const aiRecommendationsCount = aiSearches.length * 8;

  const nextPick = useMemo(() => {
    const known = new Set([...favorites, ...history].map(i => i.title));
    const pool = CATALOG.filter(t => !known.has(t.title) && (!topGenre || t.genres.includes(topGenre)));
    return pool[0] || CATALOG.find(t => !known.has(t.title));
  }, [favorites, history, topGenre]);

  const timelineGroups = useMemo(() => {
    const groups = {};
    history.forEach(item => {
      const days = Math.floor((Date.now() - new Date(item.watched_at)) / 86400000);
      const label = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
      groups[label] = groups[label] || [];
      groups[label].push(item);
    });
    return Object.entries(groups).slice(0, 6);
  }, [history]);

  const stats = { favorites: favorites.length, history: history.length, topGenre, topGenreShare, totalSignals };
  const statsReady = !loading;
  const watchedUp = useCountUp(history.length, statsReady);
  const favUp = useCountUp(favorites.length, statsReady);
  const aiUp = useCountUp(aiRecommendationsCount, statsReady);

  const initial = user.email.trim().charAt(0).toUpperCase();

  return (
    <div className="db">
      <Header />

      <main className="db__main">
        <section className="db__hero">
          <div className="db__avatar">{initial}</div>
          <div className="db__hero-text">
            <p className="db__welcome">Welcome Back,</p>
            <h1 className="db__name">{user.email.split('@')[0]}</h1>
            <p className="db__member-since">Member since {memberSince}</p>
          </div>
          <div className="db__hero-actions">
            <button type="button" className="db-btn" onClick={() => showToast('Profile editing is coming soon')}>Edit Profile</button>
            <button type="button" className="db-btn db-btn--outline" onClick={() => navigate('/settings')}>Settings</button>
          </div>
        </section>

        {!loading && (
          <>
            <section className="db__stats">
              <div className="db__stat-card">
                <span className="db__stat-value">{watchedUp}</span>
                <span className="db__stat-label">Movies Watched</span>
              </div>
              <div className="db__stat-card">
                <span className="db__stat-value">{favUp}</span>
                <span className="db__stat-label">Favorites</span>
              </div>
              <div className="db__stat-card">
                <span className="db__stat-value">{aiUp}</span>
                <span className="db__stat-label">AI Recommendations</span>
              </div>
              <div className="db__stat-card">
                <span className="db__stat-value">{avgRating}</span>
                <span className="db__stat-label">Average Rating</span>
              </div>
            </section>

            {history.length > 0 && (
              <section className="row db__section">
                <h2 className="row__title">Continue Watching</h2>
                <div className="row__track">
                  {history.slice(0, 8).map(item => {
                    const progress = 20 + (hashString(item.title) % 75);
                    return (
                      <button
                        key={item.title}
                        type="button"
                        className="db-continue-card"
                        onClick={() => navigate(`/title/${encodeURIComponent(item.title)}`)}
                      >
                        <div className="db-continue-card__poster" style={{ background: `linear-gradient(150deg, ${genreAccent(item.genres)}, #0a0a0a)` }} />
                        <p className="db-continue-card__title">{item.title}</p>
                        <div className="db-continue-card__bar">
                          <div className="db-continue-card__fill" style={{ width: `${progress}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {topGenres.length > 0 && (
              <section className="db__section">
                <h2 className="db__section-title">Favorite Genres</h2>
                <div className="db__chips">
                  {topGenres.map(([genre]) => (
                    <span key={genre} className="db__chip">{genre}</span>
                  ))}
                </div>
              </section>
            )}

            <section className="db__section">
              <div className="db__dna-card">
                <p className="db__dna-title">Your Cinema Personality</p>

                {topGenres.length > 0 ? (
                  <>
                    <div className="db__dna-bars">
                      {topGenres.map(([genre, count]) => (
                        <div className="db__dna-row" key={genre}>
                          <span className="db__dna-label">{genre}</span>
                          <div className="db__dna-track">
                            <div className="db__dna-fill" style={{ width: `${(count / maxGenreCount) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="db__dna-message">
                      We've learned your taste. You enjoy {topGenres.slice(0, 3).map(([g]) => g.toLowerCase()).join(', ')}
                      {' '}stories. Every recommendation from now on will be tailored specifically for you.
                    </p>

                    {nextPick && (
                      <div className="db__dna-next">
                        <span>Next movie you should watch</span>
                        <button type="button" onClick={() => navigate(`/title/${encodeURIComponent(nextPick.title)}`)}>
                          {nextPick.title}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="db__dna-message">
                    Save a few favorites or watch some titles, and CineMatch will start mapping your taste here.
                  </p>
                )}
              </div>
            </section>

            {timelineGroups.length > 0 && (
              <section className="db__section">
                <h2 className="db__section-title">Watch History Timeline</h2>
                <div className="db__timeline">
                  {timelineGroups.map(([label, entries]) => (
                    <div className="db__timeline-group" key={label}>
                      <span className="db__timeline-label">{label}</span>
                      <div className="db__timeline-items">
                        {entries.map(item => (
                          <button
                            key={item.title}
                            type="button"
                            className="db__timeline-item"
                            onClick={() => navigate(`/title/${encodeURIComponent(item.title)}`)}
                          >
                            <span className="db__timeline-dot" style={{ background: genreAccent(item.genres) }} />
                            {item.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="db__section">
              <h2 className="db__section-title">Achievements</h2>
              <div className="db__achievements">
                {ACHIEVEMENTS.map(a => {
                  const unlocked = a.test(stats);
                  const label = typeof a.label === 'function' ? a.label(stats) : a.label;
                  return (
                    <div key={a.key} className={`db__badge ${unlocked ? 'db__badge--unlocked' : ''}`}>
                      <div className="db__badge-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 17l-5.6 3 1.4-6.2-4.8-4.3 6.4-.6z" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="db__badge-label">{label}</p>
                      <p className="db__badge-desc">{unlocked ? 'Unlocked' : a.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <footer className="db__footer">Your cinematic journey has only just begun.</footer>
      </main>
    </div>
  );
}
