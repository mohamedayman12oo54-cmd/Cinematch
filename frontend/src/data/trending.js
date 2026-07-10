import CATALOG from '../data/catalog';

export const REGIONS = ['Global', 'USA', 'Egypt', 'Korea', 'Japan'];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deterministic "trending" ranking per region — no real trending signal
 * exists yet, so this shuffles the catalog with a per-region seed and
 * fabricates stable stats (ratings, last week's rank) from a hash of the
 * title, so numbers don't jump around between renders.
 */
export function getTrending(region = 'Global') {
  const ranked = [...CATALOG]
    .map(item => ({ item, seed: hashString(item.title + region) }))
    .sort((a, b) => b.seed - a.seed)
    .map(({ item, seed }, i) => {
      const rank = i + 1;
      const lastWeekOffset = (seed % 7) - 3; // -3..3
      const lastWeekRank = Math.max(1, Math.min(18, rank + lastWeekOffset));
      return {
        ...item,
        rank,
        imdb: (7 + (seed % 28) / 10).toFixed(1),
        netflixScore: 80 + (seed % 19),
        aiScore: 82 + ((seed >> 3) % 17),
        lastWeekRank,
        rising: lastWeekRank > rank + 1,
        duration: item.type === 'Movie' ? `${95 + (seed % 45)} min` : `${1 + (seed % 5)} Season${(seed % 5) ? 's' : ''}`,
      };
    });

  return ranked;
}
