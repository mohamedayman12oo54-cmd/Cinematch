import { apiClient, USE_MOCK } from './client';
import { searchCatalog } from '../data/catalog';
import { normalizeTitleItem, validateApiResponse } from '../utils/normalize';

// GET /search?q={query}&limit={n}
export async function search(query, limit = 12) {
  if (USE_MOCK) {
    return { status: 'success', data: searchCatalog(query, limit).map(normalizeTitleItem) };
  }
  const res = await apiClient.get('/search', { params: { q: query, limit } });
  const validated = validateApiResponse(res);
  return {
    ...validated,
    data: (validated.data ?? []).map(normalizeTitleItem),
  };
}
