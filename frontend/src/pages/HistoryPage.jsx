import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import TitleCard from '../components/TitleCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as historyApi from '../api/history';
import './BrowsePages.css';
import './ListPages.css';

export default function HistoryPage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingTitle, setRemovingTitle] = useState(null);

  useEffect(() => {
    let cancelled = false;
    historyApi.listHistory(user.email)
      .then(res => {
        if (!cancelled) {
          setItems(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [user.email]);

  async function handleRemove(t) {
    setRemovingTitle(t);
    await historyApi.removeHistoryEntry(user.email, t);
    showToast('تم حذف العنصر من السجل');
    refreshUser();
    setTimeout(() => {
      setItems(items => items.filter(i => i.title !== t));
      setRemovingTitle(null);
    }, 260);
  }

  return (
    <div className="bp">
      <Header />
      <main className="bp__main">
        <div className="bp__intro">
          <p className="bp__eyebrow">Your activity</p>
          <h1 className="bp__title">Watch History</h1>
        </div>

        {loading && (
          <div className="sk-grid">
            {Array.from({ length: 8 }).map((_, i) => <div className="sk-card" key={i} />)}
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="bp__empty">
            Nothing watched yet. <Link to="/home" className="bp__empty-link">Browse titles.</Link>
          </p>
        )}

        {!loading && items.length > 0 && (
          <div className="results__grid">
            {items.map(item => (
              <div
                key={item.title}
                className={`lc ${removingTitle === item.title ? 'lc--removing' : ''}`}
              >
                <TitleCard title={item} />
                <button
                  type="button"
                  className="lc__remove"
                  title="Remove from history"
                  onClick={e => { e.stopPropagation(); handleRemove(item.title); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
