import Header from '../components/Header';
import './BrowsePages.css';

export default function RecommendPage() {
  return (
    <div className="bp">
      <Header />
      <main className="bp__main">
        <div className="bp__intro">
          <p className="bp__eyebrow">Coming soon</p>
          <h1 className="bp__title">AI Recommendation Engine</h1>
        </div>
        <p className="bp__empty">
          The full conversational AI assistant experience is next up in the build queue.
        </p>
      </main>
    </div>
  );
}
