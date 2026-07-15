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
import './TitleDetailPage.css';

// 148 -> "2h 28min"
function formatRuntime(minutes) {
  if (minutes === null || minutes === undefined) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export default function TitleDetailPage() {
  const { title } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [detail, setDetail] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [favBusy, setFavBusy] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  const [parallax, setParallax] = useState(0);
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const heroRef = useRef(null);
  const trailerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setPlayingTrailer(false);

    Promise.all([
      titlesApi.getTitleDetail(title, user?.email),
      titlesApi.getRecommendations(title, 10, isAuthenticated),
    ])
      .then(([detailRes, recsRes]) => {
        if (cancelled) return;
        setDetail(detailRes.data);
        setRecs(recsRes.data.results);
      })
      .catch(err => {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          setNotFound(true);
        } else {
          setLoadError(getErrorMessage(err, "Couldn't load this title right now. Please try again."));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [title, user?.email, isAuthenticated]);

  useEffect(() => {
    function onScroll() { setParallax(window.scrollY * 0.35); }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function handleToggleFavorite() {
    if (!isAuthenticated) {
      showToast('Sign in to add titles to your list');
      return navigate('/signin', { state: { mode: 'login' } });
    }
    setFavBusy(true);
    try {
      if (detail.is_favorite) {
        const res = await favoritesApi.removeFavorite(user.email, detail.title);
        setDetail(d => ({ ...d, is_favorite: false }));
        showToast(res.message);
      } else {
        const res = await favoritesApi.addFavorite(user.email, {
          title: detail.title,
          type: detail.type,
          genres: detail.genres,
          release_year: detail.release_year,
        });
        setDetail(d => ({ ...d, is_favorite: true }));
        showToast(res.message);
      }
      refreshUser();
    } finally {
      setFavBusy(false);
    }
  }

  async function handleMarkWatched() {
    if (!isAuthenticated) {
      showToast('Sign in to track what you\u2019ve watched');
      return navigate('/signin', { state: { mode: 'login' } });
    }
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
      refreshUser();
    } finally {
      setWatchBusy(false);
    }
  }

  function handleShare() {
    if (navigator.clipboard) navigator.clipboard.writeText(window.location.href);
    showToast('Link copied to clipboard');
  }

  function handleWatchTrailer() {
    if (!detail?.trailer_key) return;
    setPlayingTrailer(true);
    trailerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const accent = genreAccent(detail.genres);
  const genreList = detail.genres ? detail.genres.split(',').map(g => g.trim()).filter(Boolean) : [];
  const hasBackdrop = detail.tmdb_available && detail.backdrop_url;
  const runtime = formatRuntime(detail.runtime);
  const voteAverage = detail.vote_average != null ? Number(detail.vote_average).toFixed(1) : null;
  const cast = Array.isArray(detail.cast) ? detail.cast : [];
  const hasTrailer = detail.tmdb_available && Boolean(detail.trailer_key);

  return (
    <div className="bp" style={{ '--td-accent': accent }}>
      <Header />

      <section className="td-hero" ref={heroRef}>
        <div
          className="td-hero__bg"
          style={{
            background: hasBackdrop
              ? `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.35)), url(${detail.backdrop_url}) center/cover no-repeat`
              : genreGradient(detail.genres, 150),
            transform: `translateY(${parallax}px)`,
          }}
        />
        <div className="td-hero__scrim" />

        <div className="td-hero__content">
          <h1 className="td-hero__title">{detail.title}</h1>

          <div className="td-hero__score-badges">
            {voteAverage && <span className="td-score-badge td-score-badge--ai">TMDB {voteAverage}/10</span>}
            {detail.rating && <span className="td-score-badge">{detail.rating}</span>}
          </div>

          <div className="td-hero__genre-caps">
            {genreList.map(g => (
              <span key={g} className="td-genre-cap">{g}</span>
            ))}
          </div>

          <div className="td-hero__meta">
            <span>{detail.release_year}</span>
            <span>{detail.type}</span>
            {runtime && <span>{runtime}</span>}
            <span>{detail.country}</span>
          </div>

          <div className="td-hero__actions">
            <button
              type="button"
              className="td-btn td-btn--play"
              onClick={handleWatchTrailer}
              disabled={!hasTrailer}
              title={hasTrailer ? 'Watch Trailer' : 'Trailer not available'}
            >
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
          <p className="td-overview">{detail.overview || 'No overview available for this title yet.'}</p>
        </section>

        <section className="td-section">
          <h2 className="td-section__title">Movie Information</h2>
          <div className="td-info-grid">
            <div className="td-info-card"><span>Release Year</span><strong>{detail.release_year}</strong></div>
            <div className="td-info-card"><span>Runtime</span><strong>{runtime || '—'}</strong></div>
            <div className="td-info-card"><span>Rating</span><strong>{detail.rating || '—'}</strong></div>
            <div className="td-info-card"><span>Country</span><strong>{detail.country || '—'}</strong></div>
            <div className="td-info-card"><span>Director</span><strong>{detail.director || '—'}</strong></div>
            <div className="td-info-card"><span>TMDB Score</span><strong>{voteAverage ? `${voteAverage}/10` : '—'}</strong></div>
          </div>
        </section>

        {cast.length > 0 && (
          <section className="td-section">
            <h2 className="td-section__title">Cast</h2>
            <div className="td-cast-grid">
              {cast.map(name => (
                <div className="td-cast-card" key={name}>
                  <div className="td-cast-avatar">{name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                  <p className="td-cast-name">{name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="td-section" ref={trailerRef}>
          <h2 className="td-section__title">Trailer</h2>
          <div className="td-trailer" style={!hasTrailer ? { background: genreGradient(detail.genres, 120) } : undefined}>
            {hasTrailer ? (
              playingTrailer ? (
                <iframe
                  className="td-trailer__frame"
                  src={`https://www.youtube.com/embed/${detail.trailer_key}?autoplay=1`}
                  title={`${detail.title} trailer`}
                  allow="accelerate; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <>
                  <img
                    className="td-trailer__thumb"
                    src={`https://img.youtube.com/vi/${detail.trailer_key}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                  />
                  <button
                    type="button"
                    className="td-trailer__play"
                    title="Play trailer"
                    onClick={() => setPlayingTrailer(true)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                </>
              )
            ) : (
              <div className="td-trailer__empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 5v14l11-7z" opacity="0.5" />
                </svg>
                <p>No trailer available for this title yet</p>
              </div>
            )}
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

        <footer className="td-footer">More stories are waiting for you...</footer>
      </main>
    </div>
  );
}
