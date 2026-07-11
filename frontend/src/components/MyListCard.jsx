import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { genreGradient } from '../utils/palette';
import { posterFor } from '../api/tmdb';

export default function MyListCard({ item, onRemove, onRate, onHoverGenre }) {
  const navigate = useNavigate();
  const [posterUrl, setPosterUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPosterUrl(null);
    posterFor(item.title, item.release_year, item.type).then(url => {
      if (!cancelled) setPosterUrl(url);
    });
    return () => { cancelled = true; };
  }, [item.title, item.release_year, item.type]);

  return (
    <div
      className="mlc"
      onMouseEnter={() => onHoverGenre?.(item.genres)}
      onMouseLeave={() => onHoverGenre?.(null)}
      onClick={() => navigate(`/title/${encodeURIComponent(item.title)}`)}
    >
      <div
        className="mlc__poster"
        style={{
          background: posterUrl
            ? `linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url(${posterUrl}) center/cover no-repeat`
            : genreGradient(item.genres),
        }}
      >
        <span className="mlc__saved-badge">Saved</span>
        <div className="mlc__poster-label">{item.title}</div>

        <div className="mlc__overlay">
          <div className="mlc__actions">
            <button type="button" className="mlc__action" title="Play" onClick={e => e.stopPropagation()}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </button>
            <button
              type="button"
              className="mlc__action"
              title="Details"
              onClick={e => { e.stopPropagation(); navigate(`/title/${encodeURIComponent(item.title)}`); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" /></svg>
            </button>
            <button
              type="button"
              className="mlc__action"
              title="Rate"
              onClick={e => { e.stopPropagation(); onRate?.(item.title); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 17l-5.6 3 1.4-6.2-4.8-4.3 6.4-.6z" strokeLinejoin="round" /></svg>
            </button>
            <button
              type="button"
              className="mlc__action mlc__action--danger"
              title="Remove"
              onClick={e => { e.stopPropagation(); onRemove?.(item.title); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" transform="rotate(45 12 12)" /></svg>
            </button>
          </div>

          <p className="mlc__name">{item.title}</p>
          <p className="mlc__meta">{item.genres}{item.release_year ? ` · ${item.release_year}` : ''}</p>
        </div>
      </div>
    </div>
  );
}
