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

export default function HomePage() {
  const { user } = useAuth();

  const [headlineDone, setHeadlineDone] = useState(false);
  const [stage, setStage] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    homeApi.getHome(user?.email).then(res => {
      if (cancelled) return;
      setStage(res.data.stage);
      setSections(res.data.sections);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.email]);

  const copy = STAGE_COPY[stage] || STAGE_COPY.stranger;

  return (
    <div className="hp">
      <Header />

      <section className="discover-hero">
        <TypewriterHeadline
          text="Find Your Next Obsession"
          className="discover-hero__headline"
          cursorClassName="discover-hero__cursor"
          onDone={() => setHeadlineDone(true)}
        />
        <span className={`discover-hero__underline ${headlineDone ? 'discover-hero__underline--drawn' : ''}`} />

        <div className={`discover-hero__search ${headlineDone ? 'discover-hero__search--visible' : ''}`}>
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

        {!loading && sections.map((section, sIdx) => (
          <section key={section.key} className="row">
            <h2 className="row__title">{section.title}</h2>
            <div className="row__track">
              {section.items.map((item, i) => (
                <div className="row__item" key={item.title} style={{ animationDelay: `${sIdx * 80 + i * 45}ms` }}>
                  <TitleCard title={item} reason={item.reason} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
