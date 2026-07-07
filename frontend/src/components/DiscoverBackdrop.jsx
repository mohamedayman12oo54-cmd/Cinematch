import { useEffect, useMemo, useState } from 'react';
import CATALOG from '../data/catalog';
import { posterFor, fallbackPoster } from '../api/tmdb';

function Tile({ item }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    posterFor(item.title, item.release_year, item.type).then(u => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [item.title, item.release_year, item.type]);

  return (
    <div className="dbd__tile">
      <img src={url || fallbackPoster(item.title, item.genres, 200, 300)} alt="" loading="lazy" />
      <span className="dbd__tile-label">{item.title}</span>
    </div>
  );
}

/**
 * Faint, dimmed poster-grid backdrop behind the Discover hero and rows —
 * uses CineMatch's own (fictional) catalog rather than real show names,
 * to keep the ambient effect without borrowing anyone's actual IP.
 */
export default function DiscoverBackdrop() {
  const tiles = useMemo(() => {
    const doubled = [...CATALOG, ...CATALOG];
    return doubled.slice(0, 28);
  }, []);

  return (
    <div className="dbd">
      <div className="dbd__grid">
        {tiles.map((item, i) => <Tile item={item} key={`${item.title}-${i}`} />)}
      </div>
      <div className="dbd__overlay" />
    </div>
  );
}
