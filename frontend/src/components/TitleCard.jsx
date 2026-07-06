import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { posterFor, fallbackPoster } from '../api/tmdb';

export default function TitleCard({ title, reason, rank, similarity }) {
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const [posterUrl, setPosterUrl] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    let cancelled = false;
    posterFor(title.title, title.release_year, title.type).then(url => {
      if (!cancelled) setPosterUrl(url);
    });
    return () => { cancelled = true; };
  }, [title.title, title.release_year, title.type]);

  // Trigger shimmer + match-percentage count-up only once the card has
  // actually finished its own entrance fade and is visible on screen —
  // not the instant it mounts, which could be while it's still hidden
  // behind a staggered parent fade-in.
  useEffect(() => {
    if (!cardRef.current) return;
    const node = cardRef.current;
    let revealTimer;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Small buffer so this lines up with the card's own staggered
          // fade-in finishing, instead of firing while it's still hidden.
          revealTimer = setTimeout(() => setRevealed(true), 350);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => { observer.disconnect(); clearTimeout(revealTimer); };
  }, []);

  const targetPct = similarity ? Math.round(similarity * 100) : null;

  useEffect(() => {
    if (!revealed || !targetPct) return;
    const duration = 700;
    const start = performance.now();
    let frame;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayPct(Math.round(targetPct * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [revealed, targetPct]);

  const img = posterUrl || fallbackPoster(title.title, title.genres);

  return (
    <div className="tc" ref={cardRef} onClick={() => navigate(`/title/${encodeURIComponent(title.title)}`)}>
      <div className="tc__poster">
        <img className="tc__img" src={img} alt={title.title} loading="lazy" />
        <div className="tc__scrim" />
        {revealed && <div className="tc__shimmer" />}
        {rank && <span className="tc__rank">#{rank}</span>}
        <div className="tc__poster-label">{title.title}</div>

        <div className="tc__overlay">
          <div className="tc__overlay-actions">
            <button type="button" className="tc__icon-btn tc__icon-btn--play" title="Play" onClick={e => e.stopPropagation()}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </button>
          </div>

          <p className="tc__name">{title.title}</p>

          <div className="tc__meta">
            {targetPct && <span className="tc__match">{displayPct}% Match</span>}
            {title.release_year && <span>{title.release_year}</span>}
            {title.type && <span>{title.type}</span>}
          </div>

          {targetPct && (
            <div className="tc__score-track">
              <div className="tc__score-fill" style={{ width: `${displayPct}%` }} />
            </div>
          )}

          <p className="tc__genre">{title.genres}</p>
          {reason && <p className="tc__reason">{reason}</p>}
        </div>
      </div>
    </div>
  );
}
