import { apiClient, USE_MOCK } from './client';
import { mockFavorites, mockToggleFavorite, mockRemoveFavorite } from '../data/mockSession';

export function listFavorites(email) {
  if (USE_MOCK) return mockFavorites(email);
  return apiClient.get('/favorites');
}

// POST /favorites — toggle add/remove, full metadata required (BR6/BR7 weighting).
export function toggleFavorite(email, entry) {
  if (USE_MOCK) return mockToggleFavorite(email, entry);
  return apiClient.post('/favorites', entry);
}

export function removeFavorite(email, title) {
  if (USE_MOCK) return mockRemoveFavorite(email, title);
  return apiClient.delete(`/favorites/${encodeURIComponent(title)}`);
}
