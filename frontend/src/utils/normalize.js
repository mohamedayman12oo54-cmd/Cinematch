export function genresToString(genres) {
  if (!genres) return '';
  if (Array.isArray(genres)) return genres.join(', ');
  return String(genres);
}

export function validateApiResponse(res) {
  if (!res || res.status !== 'success') {
    throw res || { status: 'error', message: 'Unexpected response format.' };
  }
  return res;
}

export function normalizeTitleItem(item) {
  if (!item) return item;
  return {
    ...item,
    title: item.title ?? item.title_name ?? '',
    type: item.type ?? item.title_type ?? '',
    genres: genresToString(item.genres),
  };
}

export function normalizeTitleDetail(data) {
  if (!data) return data;
  const signals = data.user_signals;
  return {
    ...normalizeTitleItem(data),
    genres: genresToString(data.genres),
    is_favorite: signals == null ? null : Boolean(signals.is_favorite),
    is_watched: signals == null ? null : Boolean(signals.is_watched),
  };
}

export function normalizeHomeSection(section) {
  const type = section.type ?? section.key;
  return {
    key: type,
    type,
    title: section.title,
    seed_title: section.seed_title,
    items: (section.items || [])
      .filter(Boolean)
      .map(item => ({
        ...normalizeTitleItem(item),
        reason:
          type === 'because_you_watched' && section.seed_title
            ? `Because you watched ${section.seed_title}`
            : type === 'because_you_loved' && section.seed_title
              ? `Because you loved ${section.seed_title}`
              : item.reason ?? null,
        similarity: item.similarity_score ?? item.similarity ?? null,
      })),
  };
}

export function normalizeHomeData(data) {
  const sections = (data?.sections || [])
    .map(normalizeHomeSection)
    .filter(section => section.items.length > 0);
  return { stage: data?.stage ?? 'stranger', sections };
}

export function normalizeRecommendationResult(item, index) {
  const normalized = normalizeTitleItem(item);
  return {
    ...normalized,
    rank: index + 1,
    similarity: item.similarity_score ?? item.similarity ?? null,
    reason: item.reason ?? null,
  };
}

export function normalizeFavoriteItem(item) {
  return normalizeTitleItem({
    ...item,
    title: item.title_name,
    type: item.title_type,
  });
}

export function normalizeHistoryItem(item) {
  return normalizeTitleItem({
    ...item,
    title: item.title_name,
    type: item.title_type,
  });
}
