import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import TitleCard from '../components/TitleCard';
import { getTrending, REGIONS } from '../api/trending';
import { genreGradient } from '../utils/palette';
import './TrendingPage.css';

export default function TrendingPage() {
  const navigate = useNavigate();
  const [region, setRegion] = useState('Global');
  const [query, setQuery] = useState('');
  const [countdownActive, setCountdownActive] = useState(true);
  const [countdownValue, setCountdownValue] = useState(10);

  const ranked = useMemo(() => getTrending(region), [region]);
  const top10 = ranked.slice(0, 10);
  const featured = top10[0];
  const movies = ranked.filter(t => t.type === 'Movie').slice(0, 10);
  const shows = ranked.filter(t => t.type === 'TV Show').slice(0, 10);
  const rising = ranked.filter(t => t.rising).slice(0, 8);

  const filteredTop10 = query.trim()
    ? top10.filter(t => t.title.toLowerCase().includes(query.trim().toLowerCase()))
    : top10;

  useEffect(() => {
    if (!countdownActive) return;
    if (countdownValue <= 1) {
      const timer = setTimeout(() => setCountdownActive(false), 500);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCountdownValue(v => v - 1), 150);
    return () => clearTimeout(timer);
  }, [countdownActive, countdownValue]);

  return (
    <div className="tr">
      <Header />

      {countdownActive && (
        <div className="tr__countdown">
          <span key={countdownValue} className="tr__countdown-num">
            {String(countdownValue).padStart(2, '0')}
          </span>
        </div>
      )}

      <div className={`tr__content ${countdownActive ? 'tr__content--hidden' : ''}`}>
        <p className="tr__slogan">What's Everyone Watching Right Now?</p>

        {featured && (
          <section className="tr__hero" style={{ background: genreGradient(featured.genres, 140) }}>
            <div className="tr__hero-scrim" />
            <div className="tr__hero-content">
              <span className="tr__hero-badge">#1 WORLDWIDE</span>
              <h1 className="tr__hero-title">{featured.title}</h1>
              <p className="tr__hero-subtitle">The most watched title this week.</p>

              <div className="tr__hero-actions">
                <Link to={`/title/${encodeURIComponent(featured.title)}`} className="tr-btn tr-btn--play">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Watch Details
                </Link>
                <button type="button" className="tr-btn tr-btn--outline">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 5v14l11-7z" /></svg>
                  Watch Trailer
                </button>
              </div>

              <div className="tr__hero-stats">
                <div className="tr__stat-card">
                  <span>IMDb</span>
                  <strong>{featured.imdb}</strong>
                </div>
                <div className="tr__stat-card">
                  <span>Netflix Score</span>
                  <strong>{featured.netflixScore}%</strong>
                </div>
                <div className="tr__stat-card">
                  <span>AI Score</span>
                  <strong>{featured.aiScore}%</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        <main className="tr__main">
          <div className="tr__toolbar">
            <div className="tr__tabs">
              {REGIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`tr__tab ${region === r ? 'tr__tab--active' : ''}`}
                  onClick={() => setRegion(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="tr__search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search within trending..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>

          <section className="tr__top10">
            <h2 className="tr__section-title">Top 10 in {region} Today</h2>
            <div className="tr__top10-list">
              {filteredTop10.map(item => (
                <div
                  key={item.title}
                  className="tr__top10-row"
                  onClick={() => navigate(`/title/${encodeURIComponent(item.title)}`)}
                >
                  <span className="tr__top10-rank">{String(item.rank).padStart(2, '0')}</span>
                  <div className="tr__top10-poster" style={{ background: genreGradient(item.genres) }} />
                  <div className="tr__top10-info">
                    <p className="tr__top10-name">{item.title}</p>
                    <p className="tr__top10-meta">{item.genres} &middot; {item.release_year} &middot; {item.duration}</p>
                    <div className="tr__top10-badges">
                      <span className="tr__badge tr__badge--trending">Trending</span>
                      <span className="tr__badge">{item.imdb} IMDb</span>
                      <span className="tr__badge">{item.aiScore}% Match</span>
                    </div>
                  </div>
                  <button type="button" className="tr__top10-btn" onClick={e => { e.stopPropagation(); navigate(`/title/${encodeURIComponent(item.title)}`); }}>
                    More Details
                  </button>
                </div>
              ))}
              {filteredTop10.length === 0 && (
                <p className="tr__empty">No trending titles match &ldquo;{query}&rdquo;.</p>
              )}
            </div>
          </section>

          <section className="row">
            <h2 className="row__title">Trending Movies</h2>
            <div className="row__track">
              {movies.map((item, i) => (
                <div className="row__item" key={item.title} style={{ animationDelay: `${i * 45}ms` }}>
                  <TitleCard title={item} similarity={item.aiScore / 100} />
                </div>
              ))}
            </div>
          </section>

          <section className="row">
            <h2 className="row__title">Trending TV Shows</h2>
            <div className="row__track">
              {shows.map((item, i) => (
                <div className="row__item" key={item.title} style={{ animationDelay: `${i * 45}ms` }}>
                  <TitleCard title={item} similarity={item.aiScore / 100} />
                </div>
              ))}
            </div>
          </section>

          <section className="tr__rising">
            <h2 className="tr__section-title">Rising Fast</h2>
            <div className="tr__rising-list">
              {rising.map(item => (
                <button
                  key={item.title}
                  type="button"
                  className="tr__rising-card"
                  onClick={() => navigate(`/title/${encodeURIComponent(item.title)}`)}
                >
                  <span className="tr__rising-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="tr__rising-name">{item.title}</span>
                  <span className="tr__rising-jump">#{item.lastWeekRank} &rarr; #{item.rank}</span>
                </button>
              ))}
              {rising.length === 0 && <p className="tr__empty">Nothing moving up sharply this week.</p>}
            </div>
          </section>

          <section className="tr__chart">
            <h2 className="tr__section-title">Weekly Chart</h2>
            <div className="tr__chart-list">
              {top10.slice(0, 5).map(item => {
                const delta = item.lastWeekRank - item.rank;
                const trendUp = delta > 0;
                const trendSame = delta === 0;
                return (
                  <div key={item.title} className="tr__chart-row">
                    <span className="tr__chart-name">{item.title}</span>
                    <span className="tr__chart-track">
                      <span className="tr__chart-point">Last Week #{item.lastWeekRank}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`tr__chart-arrow ${trendUp ? 'tr__chart-arrow--up' : trendSame ? '' : 'tr__chart-arrow--down'}`}>
                        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="tr__chart-point tr__chart-point--now">This Week #{item.rank}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
