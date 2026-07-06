import { apiClient, USE_MOCK } from './client';
import { searchCatalog, findByTitle, recommendationsFor } from '../data/catalog';
import { mockIsFavorite, mockIsWatched } from '../data/mockSession';
import { posterFor } from './tmdb';

// GET /search?q=&limit=
export async function search(query, limit = 12) {
  if (USE_MOCK) {
    return { status: 'success', data: searchCatalog(query, limit) };
  }
  return apiClient.get('/search', { params: { q: query, limit } });
}

// GET /titles/{title}
export async function getTitleDetail(title, currentUserEmail) {
  if (USE_MOCK) {
    const found = findByTitle(title);
    if (!found) throw { status: 'error', message: 'Title not found.' };
    return {
      status: 'success',
      data: {
        title: found.title,
        type: found.type,
        genres: found.genres,
        rating: found.rating,
        country: found.country,
        release_year: found.release_year,
        director: found.director,
        is_favorite: currentUserEmail ? mockIsFavorite(currentUserEmail, found.title) : null,
        is_watched: currentUserEmail ? mockIsWatched(currentUserEmail, found.title) : null,
      },
    };
  }
  return apiClient.get(`/titles/${encodeURIComponent(title)}`);
}

// GET /titles/{title}/recommendations?n=
export async function getRecommendations(title, n = 10, authenticated = false) {
  if (USE_MOCK) {
    const seed = findByTitle(title);
    if (!seed) throw { status: 'error', message: 'Title not found.' };
    const results = recommendationsFor(seed, n).map((t, i) => ({
      rank: i + 1,
      title: t.title,
      type: t.type,
      genres: t.genres,
      release_year: t.release_year,
      similarity: t.similarity,
      reason: authenticated ? `Because you liked ${seed.title}` : null,
    }));
    return { status: 'success', data: { matched_title: seed.title, results } };
  }
  return apiClient.get(`/titles/${encodeURIComponent(title)}/recommendations`, { params: { n } });
}

/** Attaches a real TMDB poster URL to a title object; resolves null if unavailable. */
export async function withPoster(item) {
  const url = await posterFor(item.title, item.release_year, item.type);
  return { ...item, posterUrl: url };
}
