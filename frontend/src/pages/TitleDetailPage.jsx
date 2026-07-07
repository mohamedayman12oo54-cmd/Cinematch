import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import TitleCard from '../components/TitleCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as titlesApi from '../api/titles';
import * as favoritesApi from '../api/favorites';
import * as historyApi from '../api/history';
import { genreGradient } from '../utils/palette';
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

  return (
    <div className="bp">
      <Header />

      <section className="td-hero" style={{ background: genreGradient(detail.genres, 145) }}>
        <div className="td-hero__scrim" />

        <div className="td-hero__content">
          <h1 className="td-hero__title">{detail.title}</h1>
          <div className="td-hero__meta">
            <span className="td-hero__badge">{detail.rating}</span>
            <span>{detail.release_year}</span>
            <span>{detail.type}</span>
            <span>{detail.country}</span>
          </div>
          <p className="td-hero__genres">{detail.genres}</p>
          {detail.director && detail.director !== 'Not Given' && (
            <p className="td-hero__director">Directed by {detail.director}</p>
          )}

          <div className="td-hero__actions">
            <button type="button" className="td-btn td-btn--play">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Play
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
              {detail.is_favorite ? 'In My List' : 'My List'}
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

      <main className="bp__main">
        <section className="row">
          <h2 className="row__title">Because you're checking out {detail.title}</h2>
          <div className="row__track">
            {recs.map((r, i) => (
              <div className="row__item" key={r.title} style={{ animationDelay: `${i * 45}ms` }}>
                <TitleCard title={r} reason={r.reason} rank={r.rank} similarity={r.similarity} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
