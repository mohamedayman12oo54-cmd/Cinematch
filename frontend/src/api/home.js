import { apiClient, USE_MOCK } from './client';
import CATALOG from '../data/catalog';
import { mockFavorites, mockHistory } from '../data/mockSession';

function toItem(t, reason = null) {
  return { title: t.title, genres: t.genres, reason };
}

function popularSection() {
  const shuffled = [...CATALOG].sort((a, b) => b.release_year - a.release_year).slice(0, 10);
  return [{ key: 'popular', title: 'Popular on CineMatch', items: shuffled.map(t => toItem(t)) }];
}

async function personalizedSections(email) {
  const [favRes, histRes] = await Promise.all([mockFavorites(email), mockHistory(email)]);
  const favorites = favRes.data;
  const history = histRes.data;
  const signalCount = favorites.length + history.length;

  let stage;
  if (signalCount === 0) stage = 'explorer';
  else if (signalCount < 4) stage = 'explorer';
  else if (signalCount < 8) stage = 'regular';
  else stage = 'loyal';

  if (signalCount === 0) {
    return { stage, sections: popularSection() };
  }

  const seedTitles = new Set([...favorites, ...history].map(f => f.title));
  const primaryGenre = (favorites[0] || history[0])?.genres?.split(',')[0].trim();
  const pool = CATALOG.filter(t => !seedTitles.has(t.title));

  const recommended = pool
    .filter(t => primaryGenre && t.genres.includes(primaryGenre))
    .slice(0, 10);

  const sections = [
    {
      key: 'recommended_for_you',
      title: 'Recommended For You',
      items: (recommended.length ? recommended : pool.slice(0, 10)).map(t =>
        toItem(t, favorites[0] ? `Because you liked ${favorites[0].title}` : `Because you watched ${history[0]?.title}`)
      ),
    },
  ];

  if (history[0]) {
    sections.push({
      key: 'because_you_watched',
      title: `Because You Recently Watched ${history[0].title}`,
      items: pool.slice(3, 11).map(t => toItem(t)),
    });
  }

  if (favorites.length) {
    sections.push({
      key: 'based_on_favorites',
      title: 'Based on Your Favorites',
      items: pool.slice(6, 14).map(t => toItem(t)),
    });
  }

  return { stage, sections };
}

// GET /home — Optional Auth. Returns different `stage` + `sections` for
// guests vs. authenticated users with signals (episode 6/7 UX pattern).
export async function getHome(email) {
  if (USE_MOCK) {
    if (!email) {
      return { status: 'success', data: { stage: 'stranger', sections: popularSection() } };
    }
    const { stage, sections } = await personalizedSections(email);
    return { status: 'success', data: { stage, sections } };
  }
  return apiClient.get('/home');
}
