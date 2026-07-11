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

// الكونتراكت بيقول إن genres بترجع array من GET /titles/{title}
// (["Crime", "Drama", "Thriller"])، بس كل الكومبوننتس (TitleCard, MyListCard,
// palette.js) مكتوبة على أساس إنها string فيها فواصل ("Crime, Drama, Thriller")
// زي ما بترجع من favorites/history - فبنحولها هنا لحاجة موحدة عشان مفيش
// حاجة تتكسر (array.split() مش موجودة أصلاً هتوقع التطبيق)
function normalizeGenres(genres) {
  if (Array.isArray(genres)) return genres.join(', ');
  return genres;
}

// بيحول شكل الـ user_signals الحقيقي (nested object أو null) لحقول
// is_favorite / is_watched مسطحة فوق الـ object نفسه - عشان الصفحات
// اللي مكتوبة بالفعل (زي detail.is_favorite) تفضل شغالة من غير تعديل
function flattenUserSignals(item) {
  if (!item) return item;
  const signals = item.user_signals;
  return {
    ...item,
    genres: normalizeGenres(item.genres),
    is_favorite: signals ? Boolean(signals.is_favorite) : false,
    is_watched: signals ? Boolean(signals.is_watched) : false,
  };
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
  const res = await apiClient.get(`/titles/${encodeURIComponent(title)}`);
  return { ...res, data: flattenUserSignals(res.data) };
}

// GET /recommendations/{title}?n= — ده اسم الـ endpoint الصح حسب الكونتراكت
// (مكانش موجود endpoint اسمه /titles/{title}/recommendations أصلاً)
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
  const res = await apiClient.get(`/recommendations/${encodeURIComponent(title)}`, { params: { n } });
  return {
    ...res,
    data: {
      ...res.data,
      results: (res.data.results || []).map(flattenUserSignals),
    },
  };
}

// GET /recommendations/{title}?n={n} — ML recommendations based on a title
export async function getMLRecommendations(title, n = 10) {
  if (USE_MOCK) {
    const seed = findByTitle(title);
    if (!seed) throw { status: 'error', message: 'Title not found.' };
    const results = recommendationsFor(seed, n).map((t, i) => ({
      title: t.title,
      type: t.type,
      release_year: t.release_year,
      similarity_score: t.similarity || 0.85,
      user_signals: null,
    }));
    return { 
      status: 'success', 
      data: { 
        query: title,
        matched_title: seed.title,
        total: results.length,
        results 
      } 
    };
  }
  const res = await apiClient.get(`/recommendations/${encodeURIComponent(title)}`, { params: { n } });
  return {
    ...res,
    data: {
      ...res.data,
      results: (res.data.results || []).map(flattenUserSignals),
    },
  };
}

/** Attaches a real TMDB poster URL to a title object; resolves null if unavailable. */
export async function withPoster(item) {
  const url = await posterFor(item.title, item.release_year, item.type);
  return { ...item, posterUrl: url };
}
