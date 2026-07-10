// Deterministic "extra detail" generator for the Movie Details page —
// everything here is derived from a hash of the title so numbers/text
// stay stable across renders, without needing a real content API yet.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const STUDIOS = ['Meridian Pictures', 'Northlight Films', 'Aperture Studios', 'Blackwave Media', 'Cobalt Entertainment'];
const LANGUAGES = { 'United States': 'English', 'United Kingdom': 'English', Canada: 'English', 'South Korea': 'Korean', France: 'French', Germany: 'German', Australia: 'English' };
const FIRST_NAMES = ['Maya', 'Daniel', 'Sofia', 'Ethan', 'Lena', 'Marcus', 'Nadia', 'Owen', 'Priya', 'Victor'];
const LAST_NAMES = ['Rhodes', 'Bennett', 'Kowalski', 'Farrow', 'Okafor', 'Lindqvist', 'Moreau', 'Castillo', 'Whitfield', 'Nakamura'];
const ROLES = ['Lead', 'Supporting', 'Supporting', 'Antagonist', 'Ensemble'];
const REVIEW_LINES = [
  "A gripping watch from start to finish — didn't see the ending coming.",
  'Great performances, though the pacing drags a little in the middle.',
  "One of the better titles I've found through the recommendations here.",
  'Visually striking, and the score really elevates the tense scenes.',
  'Solid writing, even if a couple of plot threads feel underused.',
];

function pick(arr, seed) { return arr[seed % arr.length]; }

export function durationFor(item) {
  const h = hashString(item.title);
  if (item.type === 'Movie') return `${95 + (h % 45)} min`;
  return `${1 + (h % 5)} Season${(h % 5) ? 's' : ''}`;
}

export function scoresFor(title) {
  const h = hashString(title);
  return {
    imdb: (7 + (h % 28) / 10).toFixed(1),
    rottenTomatoes: 60 + (h % 39),
    aiMatch: 82 + ((h >> 3) % 17),
  };
}

export function overviewFor(item) {
  const h = hashString(item.title);
  const primaryGenre = item.genres.split(',')[0].trim();
  const templates = [
    `A ${primaryGenre.toLowerCase()} ${item.type === 'Movie' ? 'film' : 'series'} that follows a small cast of characters as a single decision spirals into consequences none of them saw coming, set against the backdrop of ${item.country}.`,
    `${item.title} blends ${item.genres.toLowerCase()} in a story built around trust, consequence, and the choices people make when there's no clean way out.`,
    `Set in ${item.release_year}, this ${primaryGenre.toLowerCase()}-driven ${item.type === 'Movie' ? 'movie' : 'show'} spends most of its runtime on the people at the center of the story rather than the plot mechanics around them.`,
  ];
  return templates[h % templates.length];
}

export function movieInfoFor(item) {
  const h = hashString(item.title);
  return {
    releaseYear: item.release_year,
    runtime: durationFor(item),
    language: LANGUAGES[item.country] || 'English',
    country: item.country,
    director: item.director && item.director !== 'Not Given' ? item.director : `${pick(FIRST_NAMES, h)} ${pick(LAST_NAMES, h + 1)}`,
    studio: pick(STUDIOS, h + 2),
  };
}

export function castFor(item, count = 5) {
  const h = hashString(item.title);
  return Array.from({ length: count }, (_, i) => {
    const seed = h + i * 7;
    return {
      name: `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, seed + 3)}`,
      role: pick(ROLES, seed + 5),
    };
  });
}

export function recommendationReasonsFor(item) {
  const genres = item.genres.split(',').map(g => g.trim());
  const reasons = [
    `You enjoy ${genres[0]?.toLowerCase()} stories`,
    genres[1] ? `You've shown interest in ${genres[1].toLowerCase()} titles` : 'It matches your recent activity',
    "Similar pacing to titles you've watched",
    `Strong audience reception in ${item.release_year >= 2023 ? 'recent releases' : 'its release window'}`,
  ];
  return reasons.filter(Boolean);
}

export function reviewsFor(item, count = 3) {
  const h = hashString(item.title);
  return Array.from({ length: count }, (_, i) => {
    const seed = h + i * 11;
    return {
      name: `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, seed + 2)[0]}.`,
      rating: 3 + (seed % 3),
      comment: pick(REVIEW_LINES, seed),
    };
  });
}

export function aiSummaryFor(item) {
  const info = movieInfoFor(item);
  return `${item.title} is a ${item.genres.toLowerCase()} ${item.type === 'Movie' ? 'film' : 'series'} directed by ${info.director}. It's a strong fit for viewers who enjoy character-driven stories with ${item.genres.split(',')[0].trim().toLowerCase()} at the core, and pairs well with other titles from ${info.releaseYear >= 2022 ? 'the last couple of years' : 'the same era'}.`;
}
