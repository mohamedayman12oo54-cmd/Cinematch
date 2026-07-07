const PALETTE = [
  ['#4a0509', '#150202'],
  ['#1a1a1a', '#050505'],
  ['#5c1210', '#1a0403'],
  ['#2b0a0e', '#0a0202'],
  ['#3a2410', '#0f0a02'],
  ['#0f1a2b', '#020509'],
  ['#241a3a', '#08040f'],
  ['#0f2b1e', '#020a05'],
];

function tile(i) {
  const [from, to] = PALETTE[i % PALETTE.length];
  return `linear-gradient(155deg, ${from}, ${to})`;
}

const GENRE_KEYWORDS = {
  'Sci-Fi Drama': 'space,futuristic',
  'Thriller': 'noir,nightcity',
  'Fantasy': 'mystic,forest',
  'Mystery': 'fog,darkstreet',
  'Crime Drama': 'rain,city',
  'Sci-Fi': 'space,stars',
  'Romance': 'sunset,silhouette',
  'Action': 'motion,explosion',
  'Drama': 'portrait,moody',
  'Horror': 'darkforest,fog',
  'War Drama': 'smoke,soldier',
  'Comedy': 'colorful,friends',
  'Cyberpunk': 'neoncity,cyberpunk',
  'Docudrama': 'documentary,street',
};

function poster(id, genre, w = 400, h = 225) {
  const keywords = GENRE_KEYWORDS[genre] || 'cinema,film';
  return `https://loremflickr.com/${w}/${h}/${keywords}?lock=${id}`;
}

const TITLES = [
  { id: 1, name: 'Crimson Horizon', year: 2024, genre: 'Sci-Fi Drama', match: 97, seasons: '3 Seasons' },
  { id: 2, name: 'Echoes of Tomorrow', year: 2023, genre: 'Thriller', match: 91, seasons: '1 Season' },
  { id: 3, name: 'The Last Ember', year: 2022, genre: 'Fantasy', match: 88, seasons: '2 Seasons' },
  { id: 4, name: 'Midnight Frequency', year: 2024, genre: 'Mystery', match: 95, seasons: '1 Season' },
  { id: 5, name: 'Glass City', year: 2021, genre: 'Crime Drama', match: 84, seasons: '4 Seasons' },
  { id: 6, name: 'Solar Drift', year: 2023, genre: 'Sci-Fi', match: 92, seasons: 'Film' },
  { id: 7, name: 'Paper Lanterns', year: 2020, genre: 'Romance', match: 79, seasons: '2 Seasons' },
  { id: 8, name: 'Iron Season', year: 2024, genre: 'Action', match: 89, seasons: '1 Season' },
  { id: 9, name: 'Velvet Static', year: 2022, genre: 'Drama', match: 86, seasons: 'Film' },
  { id: 10, name: 'The Quiet Depths', year: 2023, genre: 'Horror', match: 93, seasons: '2 Seasons' },
  { id: 11, name: 'Ashfall', year: 2021, genre: 'War Drama', match: 81, seasons: 'Film' },
  { id: 12, name: 'Nightshift Diaries', year: 2024, genre: 'Comedy', match: 90, seasons: '5 Seasons' },
  { id: 13, name: 'Wire & Bone', year: 2022, genre: 'Cyberpunk', match: 94, seasons: '1 Season' },
  { id: 14, name: 'Hollow Meridian', year: 2023, genre: 'Sci-Fi', match: 87, seasons: '3 Seasons' },
  { id: 15, name: 'Salt Water Kings', year: 2020, genre: 'Docudrama', match: 82, seasons: 'Film' },
  { id: 16, name: 'The Amber Line', year: 2024, genre: 'Thriller', match: 96, seasons: '1 Season' },
  { id: 17, name: 'Ferrous', year: 2021, genre: 'Action', match: 85, seasons: 'Film' },
  { id: 18, name: 'Static Bloom', year: 2023, genre: 'Drama', match: 91, seasons: '2 Seasons' },
].map((t, i) => ({ ...t, gradient: tile(i), image: poster(t.id, t.genre) }));

export const SAMPLE_QUERIES = ['Crimson Horizon', 'Solar Drift', 'The Amber Line', 'Wire & Bone', 'Iron Season'];

export function findTitle(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    TITLES.find(t => t.name.toLowerCase() === q) ||
    TITLES.find(t => t.name.toLowerCase().includes(q)) ||
    null
  );
}

export function searchSuggestions(query, limit = 6) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return TITLES.filter(t => t.name.toLowerCase().includes(q)).slice(0, limit);
}

/**
 * Placeholder "closest 10" — same-genre titles first, ranked by match score.
 * Swap this for a real call to /api/recommend/:title once the ML service
 * from Sprint 1 is wired up; the shape (array of title objects) stays the same.
 */
export function getRecommendations(seedTitle, count = 10) {
  const pool = TITLES.filter(t => t.id !== seedTitle.id);
  const sameGenre = pool.filter(t => t.genre === seedTitle.genre);
  const rest = pool.filter(t => t.genre !== seedTitle.genre);
  return [...sameGenre, ...rest].sort((a, b) => b.match - a.match).slice(0, count);
}

export default TITLES;
