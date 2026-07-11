import { apiClient, USE_MOCK } from './client';
import { mockFavorites, mockToggleFavorite, mockRemoveFavorite } from '../data/mockSession';

// الباك بيرجع title_name / title_type، لكن باقي الكومبوننتس (TitleCard,
// MyListCard...) مكتوبة تقرا title / type - فبنضيفهملها كـ alias هنا
// عشان مانلمسش كل صفحة وكومبوننت لوحده
function normalizeEntry(entry) {
  return {
    ...entry,
    title: entry.title_name ?? entry.title,
    type: entry.title_type ?? entry.type,
  };
}

export async function listFavorites(email) {
  if (USE_MOCK) return mockFavorites(email);
  const res = await apiClient.get('/favorites');
  return { ...res, data: (res.data || []).map(normalizeEntry) };
}

// POST /favorites — الباك محتاج بس { title_name } (مش الأوبجكت كامل)
export function addFavorite(title) {
  return apiClient.post('/favorites', { title_name: title });
}

// دالة قديمة كانت بتبعت أوبجكت كامل غلط - سايبينها للتوافق مع أي كود
// تاني بينادّيها، بس دلوقتي بتاخد بس الاسم وتبعته صح
export function toggleFavorite(email, entry) {
  if (USE_MOCK) return mockToggleFavorite(email, entry);
  const title = typeof entry === 'string' ? entry : entry?.title;
  return addFavorite(title);
}

// DELETE /favorites/{title} — remove from favorites (protected)
export function removeFavorite(email, title) {
  if (USE_MOCK) return mockRemoveFavorite(email, title);
  return apiClient.delete(`/favorites/${encodeURIComponent(title)}`);
}
