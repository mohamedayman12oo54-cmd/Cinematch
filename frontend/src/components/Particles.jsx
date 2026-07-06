import { useMemo } from 'react';

/**
 * Faint drifting light particles — evokes dust in a cinema projector beam.
 * Pure CSS-driven, cheap to render, respects prefers-reduced-motion via CSS.
 */
export default function Particles({ count = 22 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      delay: Math.random() * 10,
      duration: 9 + Math.random() * 10,
      drift: (Math.random() - 0.5) * 60,
    }));
  }, [count]);

  return (
    <div className="nf-particles" aria-hidden="true">
      {particles.map(p => (
        <span
          key={p.id}
          className="nf-particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
