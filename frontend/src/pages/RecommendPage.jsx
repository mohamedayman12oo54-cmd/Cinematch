import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { analyzeRequest } from '../api/aiRecommend';
import * as titlesApi from '../api/titles';
import { mockAiSearchHistory, mockSaveAiSearch } from '../data/mockSession';
import { genreGradient } from '../utils/palette';
import './RecommendPage.css';

const SUGGESTIONS = [
  'Mind-blowing Sci-Fi',
  'Comedy for family night',
  'Romantic movies',
  'Psychological thrillers',
  'Space adventures',
  'Oscar-winning dramas',
];

const LOADING_LINES = [
  'Analyzing your request...',
  'Searching movie database...',
  'Ranking best matches...',
  'Generating recommendations...',
];

const STAGE = {
  IDLE: 'idle',
  LOADING: 'loading',
  RESULTS: 'results',
  EMPTY: 'empty',
};

export default function RecommendPage() {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [stage, setStage] = useState(STAGE.IDLE);
  const [loadingLine, setLoadingLine] = useState(0);
  const [understood, setUnderstood] = useState(null);
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    // الزائر (من غير تسجيل دخول) مش هيكون عنده سجل بحث محفوظ - سيبه فاضي
    if (!user?.email) {
      setRecent([]);
      return;
    }
    setRecent(mockAiSearchHistory(user.email));
  }, [user?.email]);

  useEffect(() => {
    if (stage !== STAGE.LOADING) return;
    const interval = setInterval(() => {
      setLoadingLine(i => Math.min(i + 1, LOADING_LINES.length - 1));
    }, 500);
    return () => clearInterval(interval);
  }, [stage]);

  function runSearch(text) {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery(q);
    setStage(STAGE.LOADING);
    setLoadingLine(0);

    setTimeout(() => {
      const { understood, results } = analyzeRequest(q, 8);
      setUnderstood(understood);
      setResults(results);
      setStage(results.length ? STAGE.RESULTS : STAGE.EMPTY);
      if (user?.email) setRecent(mockSaveAiSearch(user.email, q));
    }, LOADING_LINES.length * 500 + 300);
  }

  function handleChipClick(text) {
    setQuery(text);
    textareaRef.current?.focus();
  }

  function handleNewSearch() {
    setStage(STAGE.IDLE);
    setQuery('');
    setResults([]);
    setUnderstood(null);
  }

  return (
    <div className="rc">
      <Header />

      <main className="rc__main">
        {stage === STAGE.IDLE && (
          <section className="rc__hero">
            <div className="rc__brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path d="M3 10h18M7.5 6v4M16.5 6v4" strokeLinecap="round" />
                <circle cx="12" cy="14" r="2.2" />
              </svg>
            </div>
            <p className="rc__eyebrow">AI Recommendation Engine</p>
            <h1 className="rc__headline">Tell us what you're in the mood for.</h1>
            <span className="rc__underline" />
            <p className="rc__description">
              Describe the movie or series you're looking for, and our AI will find the perfect match.
            </p>

            <form
              className="rc__box"
              onSubmit={e => { e.preventDefault(); runSearch(); }}
            >
              <textarea
                ref={textareaRef}
                className="rc__textarea"
                placeholder={'Example:\nI want a psychological thriller with a shocking ending, released after 2015, without horror.'}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button type="button" className="rc__voice-btn" title="Voice search (coming soon)" onClick={() => showToast('Voice search is coming soon')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
                </svg>
              </button>
            </form>

            <div className="rc__chips">
              {SUGGESTIONS.map(s => (
                <button key={s} type="button" className="rc__chip" onClick={() => handleChipClick(s)}>
                  {s}
                </button>
              ))}
            </div>

            <button type="button" className="rc__generate" onClick={() => runSearch()}>
              GENERATE RECOMMENDATIONS
            </button>

            {recent.length > 0 && (
              <section className="rc__history">
                <h2 className="rc__history-title">Recent AI Searches</h2>
                <div className="rc__history-list">
                  {recent.map((entry, i) => (
                    <button key={i} type="button" className="rc__history-card" onClick={() => runSearch(entry.query)}>
                      <p className="rc__history-query">{entry.query}</p>
                      <span className="rc__history-date">{new Date(entry.searched_at).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}

        {stage === STAGE.LOADING && (
          <section className="rc__loading">
            <div className="rc__spinner" />
            <p key={loadingLine} className="rc__loading-text">{LOADING_LINES[loadingLine]}</p>
          </section>
        )}

        {stage === STAGE.EMPTY && (
          <section className="rc__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="rc__empty-icon">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <p className="rc__empty-title">No exact match found.</p>
            <p className="rc__empty-subtitle">Try changing your description.</p>
            <button type="button" className="rc__generate rc__generate--inline" onClick={handleNewSearch}>
              Try Again
            </button>
          </section>
        )}

        {stage === STAGE.RESULTS && (
          <section className="rc__results">
            <div className="rc__results-header">
              <p className="rc__results-query">&ldquo;{query}&rdquo;</p>
              <button type="button" className="rc__new-search" onClick={handleNewSearch}>New Search</button>
            </div>

            {understood && (
              <div className="rc__understood">
                <p className="rc__understood-title">AI Understood Your Request</p>
                <div className="rc__understood-grid">
                  <div><span>Genre</span><strong>{understood.genres.join(', ')}</strong></div>
                  <div><span>Mood</span><strong>{understood.moods.join(', ')}</strong></div>
                  <div><span>Ending</span><strong>{understood.endings.join(', ')}</strong></div>
                  <div><span>Release Preference</span><strong>{understood.releasePreference}</strong></div>
                </div>
              </div>
            )}

            <div className="rc__cards">
              {results.map((item, i) => (
                <article className="rc-card" key={item.title} style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="rc-card__poster" style={{ background: genreGradient(item.genres, 145) }}>
                    <span className="rc-card__rank">#{item.rank}</span>
                  </div>

                  <div className="rc-card__body">
                    <div className="rc-card__top">
                      <h3 className="rc-card__title">{item.title}</h3>
                      <span className="rc-card__badge">AI Match {item.match}%</span>
                    </div>

                    <div className="rc-card__meta">
                      <span>{item.release_year}</span>
                      <span>{item.genres}</span>
                      <span>{item.rating}</span>
                      <span>{item.duration}</span>
                    </div>

                    <p className="rc-card__reason-label">Recommended because:</p>
                    <ul className="rc-card__reasons">
                      {item.reasons.map(r => (
                        <li key={r}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {r}
                        </li>
                      ))}
                    </ul>

                    <div className="rc-card__actions">
                      <button type="button" className="rc-btn rc-btn--play" onClick={() => navigate(`/title/${encodeURIComponent(item.title)}`)}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        View Details
                      </button>
                      <button type="button" className="rc-btn rc-btn--outline" title="Save">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
