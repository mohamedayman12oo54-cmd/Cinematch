import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import TitleCard from '../components/TitleCard';
import * as titlesApi from '../api/titles';
import './BrowsePages.css';

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    titlesApi.search(q, 24).then(res => {
      if (!cancelled) {
        setResults(res.data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [q]);

  return (
    <div className="bp">
      <Header />
      <main className="bp__main">
        <div className="bp__intro">
          <p className="bp__eyebrow">Search results</p>
          <h1 className="bp__title">&ldquo;{q}&rdquo;</h1>
        </div>

        {loading && (
          <div className="sk-grid">
            {Array.from({ length: 12 }).map((_, i) => <div className="sk-card" key={i} />)}
          </div>
        )}

        {!loading && results.length === 0 && (
          <p className="bp__empty">No titles matched &ldquo;{q}&rdquo;. Try a different spelling.</p>
        )}

        {!loading && results.length > 0 && (
          <div className="results__grid">
            {results.map(t => (
              <TitleCard key={t.title} title={t} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
