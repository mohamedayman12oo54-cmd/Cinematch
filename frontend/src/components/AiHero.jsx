import { useEffect, useState } from 'react';
import ParticleSphere from './ParticleSphere';
import TypewriterHeadline from './TypewriterHeadline';
import GlassSearchPanel from './GlassSearchPanel';

const STAGE = {
  LOGO: 'logo',
  GLITCH: 'glitch',
  ZOOM: 'zoom',
  DONE: 'done',
};

/**
 * Home hero, proof-of-concept pass: black screen → logo emerges from fog →
 * brief glitch → camera zooms out to reveal the full interface (particle
 * sphere + AI-style typed question + glass search).
 */
export default function AiHero({ skipIntro = false, greetingName }) {
  const [stage, setStage] = useState(skipIntro ? STAGE.DONE : STAGE.LOGO);
  const [typingDone, setTypingDone] = useState(skipIntro);

  useEffect(() => {
    if (skipIntro) return;
    const t1 = setTimeout(() => setStage(STAGE.GLITCH), 650);
    const t2 = setTimeout(() => setStage(STAGE.ZOOM), 1450);
    const t3 = setTimeout(() => setStage(STAGE.DONE), 2250);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [skipIntro]);

  const introActive = stage !== STAGE.DONE;

  return (
    <section className="ai-hero">
      <div className="ai-hero__sphere-layer">
        <ParticleSphere />
      </div>

      {introActive && (
        <div className={`ai-hero__intro ai-hero__intro--${stage}`}>
          <span className="ai-hero__intro-logo">CINEMATCH</span>
        </div>
      )}

      <div className={`ai-hero__content ${stage === STAGE.ZOOM || stage === STAGE.DONE ? 'ai-hero__content--visible' : ''}`}>
        {greetingName && <p className="ai-hero__greeting">Welcome back, {greetingName}</p>}
        {(stage === STAGE.ZOOM || stage === STAGE.DONE) && (
          <TypewriterHeadline onDone={() => setTypingDone(true)} />
        )}
        <div className={`ai-hero__search-wrap ${typingDone ? 'ai-hero__search-wrap--visible' : ''}`}>
          <GlassSearchPanel />
        </div>
      </div>
    </section>
  );
}
