// Mock catalog shaped exactly like the ML microservice / Laravel contract
// fields (title, type, genres, rating, country, release_year, director).
// Swap VITE_API_BASE_URL in .env to point at your real Laravel backend —
// every api/*.js file falls back to this data only when that var is unset.

const RAW = [
  { title: 'Crimson Horizon', type: 'TV Show', genres: 'Sci-Fi, Drama', rating: 'TV-14', country: 'United States', release_year: 2024, director: 'Not Given' },
  { title: 'Echoes of Tomorrow', type: 'Movie', genres: 'Thriller, Mystery', rating: 'TV-MA', country: 'United Kingdom', release_year: 2023, director: 'Not Given' },
  { title: 'The Last Ember', type: 'TV Show', genres: 'Fantasy, Adventure', rating: 'TV-14', country: 'Canada', release_year: 2022, director: 'Not Given' },
  { title: 'Midnight Frequency', type: 'Movie', genres: 'Mystery, Thriller', rating: 'TV-MA', country: 'United States', release_year: 2024, director: 'Not Given' },
  { title: 'Glass City', type: 'TV Show', genres: 'Crime, Drama', rating: 'TV-MA', country: 'United States', release_year: 2021, director: 'Not Given' },
  { title: 'Solar Drift', type: 'Movie', genres: 'Sci-Fi', rating: 'PG-13', country: 'United States', release_year: 2023, director: 'Not Given' },
  { title: 'Paper Lanterns', type: 'Movie', genres: 'Romance, Drama', rating: 'PG-13', country: 'South Korea', release_year: 2020, director: 'Not Given' },
  { title: 'Iron Season', type: 'TV Show', genres: 'Action, Crime', rating: 'TV-MA', country: 'United States', release_year: 2024, director: 'Not Given' },
  { title: 'Velvet Static', type: 'Movie', genres: 'Drama', rating: 'R', country: 'France', release_year: 2022, director: 'Not Given' },
  { title: 'The Quiet Depths', type: 'TV Show', genres: 'Horror, Mystery', rating: 'TV-MA', country: 'United States', release_year: 2023, director: 'Not Given' },
  { title: 'Ashfall', type: 'Movie', genres: 'War, Drama', rating: 'R', country: 'United States', release_year: 2021, director: 'Not Given' },
  { title: 'Nightshift Diaries', type: 'TV Show', genres: 'Comedy', rating: 'TV-14', country: 'United States', release_year: 2024, director: 'Not Given' },
  { title: 'Wire & Bone', type: 'TV Show', genres: 'Sci-Fi, Crime', rating: 'TV-MA', country: 'Germany', release_year: 2022, director: 'Not Given' },
  { title: 'Hollow Meridian', type: 'TV Show', genres: 'Sci-Fi, Drama', rating: 'TV-14', country: 'United States', release_year: 2023, director: 'Not Given' },
  { title: 'Salt Water Kings', type: 'Movie', genres: 'Documentary', rating: 'PG-13', country: 'Australia', release_year: 2020, director: 'Not Given' },
  { title: 'The Amber Line', type: 'TV Show', genres: 'Thriller, Drama', rating: 'TV-MA', country: 'United States', release_year: 2024, director: 'Not Given' },
  { title: 'Ferrous', type: 'Movie', genres: 'Action', rating: 'PG-13', country: 'United States', release_year: 2021, director: 'Not Given' },
  { title: 'Static Bloom', type: 'TV Show', genres: 'Drama', rating: 'TV-14', country: 'United States', release_year: 2023, director: 'Not Given' },
];

const CATALOG = RAW.map((t, i) => ({ ...t, id: i + 1 }));

export function findByTitle(title) {
  const q = title.trim().toLowerCase();
  return (
    CATALOG.find(t => t.title.toLowerCase() === q) ||
    CATALOG.find(t => t.title.toLowerCase().includes(q)) ||
    null
  );
}

export function searchCatalog(query, limit = 12) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return CATALOG.filter(t => t.title.toLowerCase().includes(q))
    .slice(0, limit)
    .map(t => ({ title: t.title, type: t.type, release_year: t.release_year }));
}

/** Placeholder "closest N" — same primary genre first, ranked by a fake similarity score. */
export function recommendationsFor(seed, n = 10) {
  const primaryGenre = seed.genres.split(',')[0].trim();
  const pool = CATALOG.filter(t => t.title !== seed.title);
  const scored = pool.map(t => {
    const sharesGenre = t.genres.includes(primaryGenre);
    const similarity = sharesGenre ? 0.8 + Math.random() * 0.19 : 0.55 + Math.random() * 0.25;
    return { ...t, similarity: Math.round(similarity * 100) / 100 };
  });
  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, n);
}

export default CATALOG;
