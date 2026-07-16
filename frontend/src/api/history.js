import { apiClient, USE_MOCK } from './client';
import { mockHistory, mockMarkWatched, mockRemoveHistory } from '../data/mockSession';

// نفس فكرة favorites.js - الباك بيرجع title_name / title_type
function normalizeEntry(entry) {
  return {
    ...entry,
    title: entry.title_name ?? entry.title,
    type: entry.title_type ?? entry.type,
  };
}

export async function listHistory(email) {
  if (USE_MOCK) return mockHistory(email);
  const res = await apiClient.get('/history');
  return { ...res, data: (res.data || []).map(normalizeEntry) };
}

// POST /history — الباك محتاج بس { title_name }
export function markWatched(email, entry) {
  if (USE_MOCK) return mockMarkWatched(email, entry);
  const title = typeof entry === 'string' ? entry : entry?.title;
  return apiClient.post('/history', { title_name: title });
}

// DELETE /history/{title} — remove from history (protected)
export function removeHistoryEntry(email, title) {
  if (USE_MOCK) return mockRemoveHistory(email, title);
  return apiClient.delete(`/history/${encodeURIComponent(title)}`);
}
