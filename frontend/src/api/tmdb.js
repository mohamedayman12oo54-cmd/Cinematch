// Real movie/show posters via The Movie Database (TMDB) — official, free API
// meant exactly for this kind of lookup. Get a free key in ~2 minutes at
// https://www.themoviedb.org/settings/api, then add to `.env`:
//
//   VITE_TMDB_API_KEY=your_key_here
//
// Without a key, posterFor() resolves to null and callers fall back to
// themed placeholder art — the app still works out of the box.

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

const cache = new Map();
const backdropCache = new Map();

export async function posterFor(title, year, type) {
  if (!TMDB_KEY) return null;

  const cacheKey = `${title}__${year}__${type}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const searchType = type === 'Movie' ? 'movie' : 'tv';
  const url = new URL(`https://api.themoviedb.org/3/search/${searchType}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('query', title);
  if (year) url.searchParams.set(searchType === 'movie' ? 'year' : 'first_air_date_year', year);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('TMDB request failed');
    const data = await res.json();
    const match = data.results?.find(r => r.poster_path) || null;
    const posterUrl = match ? `${IMG_BASE}${match.poster_path}` : null;
    cache.set(cacheKey, posterUrl);
    return posterUrl;
  } catch {
    cache.set(cacheKey, null);
    return null;
  }
}

export const TMDB_ENABLED = Boolean(TMDB_KEY);

const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

/** Wide backdrop image for hero banners (falls back to a themed poster shot). */
export async function backdropFor(title, year, type) {
  if (!TMDB_KEY) return null;

  const cacheKey = `${title}__${year}__${type}`;
  if (backdropCache.has(cacheKey)) return backdropCache.get(cacheKey);

  const searchType = type === 'Movie' ? 'movie' : 'tv';
  const url = new URL(`https://api.themoviedb.org/3/search/${searchType}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('query', title);
  if (year) url.searchParams.set(searchType === 'movie' ? 'year' : 'first_air_date_year', year);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('TMDB request failed');
    const data = await res.json();
    const match = data.results?.find(r => r.backdrop_path) || null;
    const backdropUrl = match ? `${BACKDROP_BASE}${match.backdrop_path}` : null;
    backdropCache.set(cacheKey, backdropUrl);
    return backdropUrl;
  } catch {
    backdropCache.set(cacheKey, null);
    return null;
  }
}

const GENRE_KEYWORDS = {
  'Sci-Fi': 'space,futuristic',
  'Drama': 'portrait,moody',
  'Thriller': 'noir,nightcity',
  'Mystery': 'fog,darkstreet',
  'Fantasy': 'mystic,forest',
  'Adventure': 'mountain,journey',
  'Crime': 'rain,city',
  'Romance': 'sunset,silhouette',
  'Action': 'motion,explosion',
  'Horror': 'darkforest,fog',
  'War': 'smoke,soldier',
  'Comedy': 'colorful,friends',
  'Documentary': 'documentary,street',
};

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic, genre-themed placeholder used when TMDB has no match. */
export function fallbackPoster(title, genres = '', w = 400, h = 600) {
  const primary = genres.split(',')[0]?.trim();
  const keywords = GENRE_KEYWORDS[primary] || 'cinema,film';
  const lock = hashString(title) % 1000;
  return `https://loremflickr.com/${w}/${h}/${keywords}?lock=${lock}`;
}
