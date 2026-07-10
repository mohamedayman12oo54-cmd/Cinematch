import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import TitleCard from '../components/TitleCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as titlesApi from '../api/titles';
import * as favoritesApi from '../api/favorites';
import * as historyApi from '../api/history';
import { genreGradient, genreAccent } from '../utils/palette';
import {
  scoresFor, overviewFor, movieInfoFor, castFor,
  recommendationReasonsFor, reviewsFor, aiSummaryFor,
} from '../utils/enrich';
import './TitleDetailPage.css';

export default function TitleDetailPage() {
  const { title } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [detail, setDetail] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  const [parallax, setParallax] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      titlesApi.getTitleDetail(title, user?.email),
      titlesApi.getRecommendations(title, 10, isAuthenticated),
    ])
      .then(([detailRes, recsRes]) => {
        if (cancelled) return;
        setDetail(detailRes.data);
        setRecs(recsRes.data.results);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [title, user?.email, isAuthenticated]);

  useEffect(() => {
    function onScroll() { setParallax(window.scrollY * 0.35); }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function handleToggleFavorite() {
    if (!isAuthenticated) return navigate('/');
    setFavBusy(true);
    try {
      const res = await favoritesApi.toggleFavorite(user.email, {
        title: detail.title,
        type: detail.type,
        genres: detail.genres,
        release_year: detail.release_year,
      });
      setDetail(d => ({ ...d, is_favorite: res.action === 'added' }));
      showToast(res.message);
    } finally {
      setFavBusy(false);
    }
  }

  async function handleMarkWatched() {
    if (!isAuthenticated) return navigate('/');
    setWatchBusy(true);
    try {
      const res = await historyApi.markWatched(user.email, {
        title: detail.title,
        type: detail.type,
        genres: detail.genres,
        release_year: detail.release_year,
      });
      setDetail(d => ({ ...d, is_watched: true }));
      showToast(res.message);
    } finally {
      setWatchBusy(false);
    }
  }

  function handleShare() {
    if (navigator.clipboard) navigator.clipboard.writeText(window.location.href);
    showToast('Link copied to clipboard');
  }

  if (loading) {
    return (
      <div className="bp">
        <Header />
        <div className="td-skeleton-hero" />
        <main className="bp__main">
          <div className="sk-title" />
          <div className="sk-row__track">
            {Array.from({ length: 6 }).map((_, i) => <div className="sk-card" key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="bp">
        <Header />
        <main className="bp__main">
          <p className="bp__empty">Couldn't find &ldquo;{title}&rdquo; in the catalog.</p>
        </main>
      </div>
    );
  }

  const scores = scoresFor(detail.title);
  const info = movieInfoFor(detail);
  const cast = castFor(detail);
  const reasons = recommendationReasonsFor(detail);
  const reviews = reviewsFor(detail);
  const accent = genreAccent(detail.genres);

  return (
    <div className="bp" style={{ '--td-accent': accent }}>
      <Header />

      <section className="td-hero" ref={heroRef}>
        <div
          className="td-hero__bg"
          style={{ background: genreGradient(detail.genres, 150), transform: `translateY(${parallax}px)` }}
        />
        <div className="td-hero__scrim" />

        <div className="td-hero__content">
          <h1 className="td-hero__title">{detail.title}</h1>

          <div className="td-hero__score-badges">
            <span className="td-score-badge">IMDb {scores.imdb}</span>
            <span className="td-score-badge">Rotten Tomatoes {scores.rottenTomatoes}%</span>
            <span className="td-score-badge td-score-badge--ai">AI Match {scores.aiMatch}%</span>
          </div>

          <div className="td-hero__genre-caps">
            {detail.genres.split(',').map(g => (
              <span key={g} className="td-genre-cap">{g.trim()}</span>
            ))}
          </div>

          <div className="td-hero__meta">
            <span className="td-hero__badge">{detail.rating}</span>
            <span>{detail.release_year}</span>
            <span>{detail.type}</span>
            <span>{detail.country}</span>
          </div>

          <div className="td-hero__actions">
            <button type="button" className="td-btn td-btn--play">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Watch Trailer
            </button>

            <button
              type="button"
              className={`td-btn td-btn--outline ${detail.is_favorite ? 'td-btn--active' : ''}`}
              onClick={handleToggleFavorite}
              disabled={favBusy}
            >
              <svg viewBox="0 0 24 24" fill={detail.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" style={{ display: detail.is_favorite ? 'none' : 'block' }} />
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" style={{ display: detail.is_favorite ? 'block' : 'none' }} />
              </svg>
              {detail.is_favorite ? 'In My List' : 'Add to My List'}
            </button>

            <button type="button" className="td-btn td-btn--outline" onClick={handleShare}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="m8.6 10.5 6.8-3.9M8.6 13.5l6.8 3.9" strokeLinecap="round" />
              </svg>
              Share
            </button>

            <button
              type="button"
              className={`td-btn td-btn--outline ${detail.is_watched ? 'td-btn--active' : ''}`}
              onClick={handleMarkWatched}
              disabled={watchBusy || detail.is_watched}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {detail.is_watched ? 'Watched' : 'Mark as Watched'}
            </button>
          </div>

          {!isAuthenticated && (
            <p className="td-hero__hint">Sign in to save favorites and get personalized picks.</p>
          )}
        </div>
      </section>

      <main className="td-body">
        <section className="td-section">
          <h2 className="td-section__title">Overview</h2>
          <p className="td-overview">{overviewFor(detail)}</p>
        </section>

        <section className="td-section">
          <h2 className="td-section__title">Movie Information</h2>
          <div className="td-info-grid">
            <div className="td-info-card"><span>Release Year</span><strong>{info.releaseYear}</strong></div>
            <div className="td-info-card"><span>Runtime</span><strong>{info.runtime}</strong></div>
            <div className="td-info-card"><span>Language</span><strong>{info.language}</strong></div>
            <div className="td-info-card"><span>Country</span><strong>{info.country}</strong></div>
            <div className="td-info-card"><span>Director</span><strong>{info.director}</strong></div>
            <div className="td-info-card"><span>Studio</span><strong>{info.studio}</strong></div>
          </div>
        </section>

        <section className="td-section td-score-section">
          <h2 className="td-section__title">Why We Recommend It</h2>
          <div className="td-score-layout">
            <div className="td-score-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" className="td-score-ring__track" />
                <circle
                  cx="60" cy="60" r="52"
                  className="td-score-ring__fill"
                  style={{ strokeDasharray: `${2 * Math.PI * 52}`, strokeDashoffset: `${2 * Math.PI * 52 * (1 - scores.aiMatch / 100)}` }}
                />
              </svg>
              <span className="td-score-ring__label">{scores.aiMatch}%</span>
            </div>

            <ul className="td-reasons">
              {reasons.map(r => (
                <li key={r}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="td-section">
          <h2 className="td-section__title">Cast</h2>
          <div className="td-cast-grid">
            {cast.map(c => (
              <div className="td-cast-card" key={c.name}>
                <div className="td-cast-avatar">{c.name.split(' ').map(n => n[0]).join('')}</div>
                <p className="td-cast-name">{c.name}</p>
                <p className="td-cast-role">{c.role}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="td-section">
          <h2 className="td-section__title">Trailer</h2>
          <div className="td-trailer" style={{ background: genreGradient(detail.genres, 120) }}>
            <button type="button" className="td-trailer__play" title="Play trailer">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </button>
          </div>
        </section>

        <section className="td-section">
          <h2 className="td-section__title">Screenshots</h2>
          <div className="td-gallery">
            {[60, 110, 200, 260].map(angle => (
              <div key={angle} className="td-gallery__tile" style={{ background: genreGradient(detail.genres, angle) }} />
            ))}
          </div>
        </section>

        <section className="row td-similar">
          <h2 className="row__title">You May Also Like</h2>
          <div className="row__track">
            {recs.map((r, i) => (
              <div className="row__item" key={r.title} style={{ animationDelay: `${i * 45}ms` }}>
                <TitleCard title={r} reason={r.reason} rank={r.rank} similarity={r.similarity} />
              </div>
            ))}
          </div>
        </section>

        <section className="td-section">
          <h2 className="td-section__title">Reviews</h2>
          <div className="td-reviews">
            {reviews.map(r => (
              <div className="td-review-card" key={r.name}>
                <div className="td-review-head">
                  <span className="td-review-avatar">{r.name[0]}</span>
                  <span className="td-review-name">{r.name}</span>
                  <span className="td-review-stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} viewBox="0 0 24 24" fill={i < r.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                        <path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 17l-5.6 3 1.4-6.2-4.8-4.3 6.4-.6z" strokeLinejoin="round" />
                      </svg>
                    ))}
                  </span>
                </div>
                <p className="td-review-comment">{r.comment}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="td-ai-summary">
          <p className="td-ai-summary__label">AI Summary</p>
          <p className="td-ai-summary__text">{aiSummaryFor(detail)}</p>
        </section>

        <footer className="td-footer">More stories are waiting for you...</footer>
      </main>
    </div>
  );
}
