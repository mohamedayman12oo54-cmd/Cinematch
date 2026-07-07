// No external images anywhere in the app — every "poster" is a color
// treatment derived from the title's genre instead of a photo.

const GENRE_COLORS = {
  'Sci-Fi': ['#1a0f3d', '#050214'],
  'Drama': ['#3d1a1a', '#140505'],
  'Thriller': ['#1a1a2e', '#050510'],
  'Mystery': ['#241a3d', '#0a0514'],
  'Crime': ['#2e1a1a', '#0f0505'],
  'Romance': ['#3d1a2e', '#140510'],
  'Action': ['#3d1a0f', '#140502'],
  'Horror': ['#1a0f0f', '#050202'],
  'War': ['#2e2414', '#0f0a02'],
  'Comedy': ['#3d3414', '#141002'],
  'Adventure': ['#143d24', '#02140a'],
  'Fantasy': ['#241a3d', '#0a0514'],
  'Cyberpunk': ['#0f2e3d', '#020f14'],
  'Documentary': ['#1a2e2e', '#050f0f'],
};

const DEFAULT_COLORS = ['#2a2a2a', '#0f0f0f'];

function primaryGenre(genres = '') {
  return genres.split(',')[0]?.trim();
}

/** CSS gradient string for a title card / hero background, based on genre. */
export function genreGradient(genres, angle = 155) {
  const [from, to] = GENRE_COLORS[primaryGenre(genres)] || DEFAULT_COLORS;
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

/** A single accent color for the given genre (used for badges, glows). */
export function genreAccent(genres) {
  const [from] = GENRE_COLORS[primaryGenre(genres)] || DEFAULT_COLORS;
  return from;
}
