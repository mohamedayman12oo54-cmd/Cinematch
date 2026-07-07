import { apiClient, USE_MOCK } from './client';
import { mockHistory, mockMarkWatched, mockRemoveHistory } from '../data/mockSession';

export function listHistory(email) {
  if (USE_MOCK) return mockHistory(email);
  return apiClient.get('/history');
}

// POST /history — idempotent mark-as-watched.
export function markWatched(email, entry) {
  if (USE_MOCK) return mockMarkWatched(email, entry);
  return apiClient.post('/history', entry);
}

export function removeHistoryEntry(email, title) {
  if (USE_MOCK) return mockRemoveHistory(email, title);
  return apiClient.delete(`/history/${encodeURIComponent(title)}`);
}
