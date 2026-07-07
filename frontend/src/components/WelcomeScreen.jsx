import { useMemo } from 'react';

/**
 * Full-screen cinematic welcome moment shown right after a successful
 * login or signup: converging spotlight rays, a one-shot particle burst,
 * kinetic "WELCOME" typography, then the person's name.
 */
export default function WelcomeScreen({ name, onContinue }) {
  const burst = useMemo(() => {
    return Array.from({ length: 34 }, (_, i) => {
      const angle = (i / 34) * Math.PI * 2 + Math.random() * 0.3;
      const distance = 140 + Math.random() * 220;
      return {
        id: i,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        delay: Math.random() * 0.25,
        size: 2 + Math.random() * 3,
      };
    });
  }, []);

  return (
    <div className="nf-welcome">
      <div className="nf-welcome__rays" />
      <div className="nf-welcome__spotlight" />

      <div className="nf-welcome__burst" aria-hidden="true">
        {burst.map(p => (
          <span
            key={p.id}
            className="nf-welcome__spark"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
            }}
          />
        ))}
      </div>

      <div className="nf-welcome__content">
        <p className="nf-welcome__kicker">You're in</p>
        <h1 className="nf-welcome__title">
          {'WELCOME'.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.55 + i * 0.05}s` }}>{ch}</span>
          ))}
        </h1>
        <p className="nf-welcome__name">{name}</p>

        <button type="button" className="nf-welcome__continue" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
