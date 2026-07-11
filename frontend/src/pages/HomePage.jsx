import { useEffect, useState } from 'react';
import Header from '../components/Header';
import TitleCard from '../components/TitleCard';
import TypewriterHeadline from '../components/TypewriterHeadline';
import DiscoverSearch from '../components/DiscoverSearch';
import { useAuth } from '../context/AuthContext';
import * as homeApi from '../api/home';
import './HomePage.css';
import './BrowsePages.css';

const STAGE_COPY = {
  stranger: { eyebrow: 'Welcome', title: "See what's popular right now" },
  explorer: { eyebrow: 'Just getting started', title: 'Add a few favorites to sharpen your picks' },
  regular: { eyebrow: 'Your taste, mapped', title: 'Picked for you' },
  loyal: { eyebrow: 'We know you well by now', title: 'New for you' },
};

const HEADLINE = 'Find Your Next Obsession.';
const HEADLINE_SPLIT = 'Find Your Next '.length;

export default function HomePage() {
  const { user } = useAuth();

  const [headlineShown, setHeadlineShown] = useState('');
  const [headlineDone, setHeadlineDone] = useState(false);
  const [taglineDone, setTaglineDone] = useState(false);
  const [stage, setStage] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceDown, setServiceDown] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setHeadlineShown(HEADLINE.slice(0, i));
      if (i >= HEADLINE.length) {
        clearInterval(interval);
        setHeadlineDone(true);
      }
    }, 45);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setServiceDown(false);
    homeApi.getHome(user?.email)
      .then(res => {
        if (cancelled) return;
        setStage(res.data.stage);
        setSections(res.data.sections);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        if (err?.status === 'error' && err?.message?.toLowerCase().includes('unavailable')) {
          setServiceDown(true);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.email]);

  const copy = STAGE_COPY[stage] || STAGE_COPY.stranger;
  const headlinePlain = headlineShown.slice(0, HEADLINE_SPLIT);
  const headlineAccent = headlineShown.slice(HEADLINE_SPLIT);

  return (
    <div className="hp">
      <Header />

      <section className="discover-hero">
        <h1 className="discover-hero__headline">
          {headlinePlain}
          <span className="discover-hero__accent">{headlineAccent}</span>
          {!headlineDone && <span className="discover-hero__cursor" />}
        </h1>
        <span className={`discover-hero__underline ${headlineDone ? 'discover-hero__underline--drawn' : ''}`} />

        <div className="discover-hero__tagline-wrap">
          {headlineDone && (
            <TypewriterHeadline
              text="8,790 titles. One search. Infinite recommendations."
              className="discover-hero__tagline"
              cursorClassName="discover-hero__tagline-cursor"
              onDone={() => setTaglineDone(true)}
            />
          )}
        </div>

        <div className={`discover-hero__search ${taglineDone ? 'discover-hero__search--visible' : ''}`}>
          <DiscoverSearch />
        </div>
      </section>

      <main className="bp__main">
        <p className="hp__stage-label">{copy.eyebrow} — {copy.title}</p>

        {loading && (
          <>
            {[0, 1, 2].map(i => (
              <section className="row" key={i}>
                <div className="sk-title" />
                <div className="sk-row__track">
                  {Array.from({ length: 6 }).map((_, j) => <div className="sk-card" key={j} />)}
                </div>
              </section>
            ))}
          </>
        )}

        {!loading && serviceDown && (
          <p className="bp__empty">الخدمة غير متاحة حالياً، حاول تاني كمان شوية</p>
        )}

        {!loading && !serviceDown && sections.length === 0 && (
          <p className="bp__empty">Start exploring to get recommendations</p>
        )}

        {!loading && !serviceDown && sections.map((section, sIdx) => {
          // items: [] -> الباك بيقولنا نخفي السكشن ده بالكامل
          if (!section.items || section.items.length === 0) return null;

          return (
            <section key={section.type ?? sIdx} className="row">
              <h2 className="row__title">{section.title}</h2>
              <div className="row__track">
                {section.items.map((item, i) => (
                  <div className="row__item" key={item.title} style={{ animationDelay: `${sIdx * 80 + i * 45}ms` }}>
                    <TitleCard title={item} reason={item.reason} similarity={item.similarity_score} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
