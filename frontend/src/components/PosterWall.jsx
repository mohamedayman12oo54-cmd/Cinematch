import { useMemo, useRef } from 'react';

const THEMES = [
  'cinema,filmreel',
  'movietheater,screen',
  'filmset,camera',
  'neoncity,noir',
  'spacefilm,scifi',
  'dramaportrait,moody',
];

/**
 * Ambient poster-wall background built from royalty-free, cinema-themed
 * placeholder photography (loremflickr, tag-based) — swap for your own
 * licensed poster art whenever it's ready. Heavily darkened and blurred
 * so it reads as atmosphere, not a literal photo grid.
 */
export default function PosterWall() {
  const wallRef = useRef(null);

  const tiles = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      theme: THEMES[i % THEMES.length],
      delay: (i % 6) * 1.6,
      duration: 20 + (i % 5) * 4,
    }));
  }, []);

  function handleMouseMove(e) {
    if (!wallRef.current) return;
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 10;
    const y = (e.clientY / innerHeight - 0.5) * 10;
    wallRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.08)`;
  }

  return (
    <div className="nf-posterwall-viewport" onMouseMove={handleMouseMove}>
      <div className="nf-posterwall" ref={wallRef}>
        {tiles.map(t => (
          <div
            key={t.id}
            className="nf-posterwall__tile"
            style={{ animationDelay: `${t.delay}s`, animationDuration: `${t.duration}s` }}
          >
            <img src={`https://loremflickr.com/300/450/${t.theme}?lock=${t.id}`} alt="" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}
