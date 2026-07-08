import CATALOG from '../data/catalog';

const GENRE_KEYWORDS = {
  'Sci-Fi': ['sci-fi', 'science fiction', 'space', 'alien', 'futuristic'],
  'Thriller': ['thriller', 'suspense', 'tense'],
  'Mystery': ['mystery', 'whodunit', 'detective'],
  'Drama': ['drama', 'emotional', 'moving'],
  'Comedy': ['comedy', 'funny', 'family night', 'lighthearted'],
  'Romance': ['romance', 'romantic', 'love story'],
  'Action': ['action', 'explosive', 'fight'],
  'Horror': ['horror', 'scary', 'terrifying'],
  'Crime': ['crime', 'heist', 'gangster'],
  'Fantasy': ['fantasy', 'magic', 'mythical'],
  'War': ['war', 'military', 'soldier'],
  'Documentary': ['documentary', 'true story', 'real life'],
  'Adventure': ['adventure', 'journey', 'quest'],
};

const MOOD_KEYWORDS = {
  Dark: ['dark', 'grim', 'bleak'],
  Emotional: ['emotional', 'moving', 'heartbreaking'],
  Intense: ['intense', 'shocking', 'tense'],
  Uplifting: ['uplifting', 'feel-good', 'happy', 'family'],
  'Mind-bending': ['mind-bending', 'mind bending', 'psychological', 'trippy'],
};

const ENDING_KEYWORDS = {
  Unexpected: ['twist', 'shocking ending', 'unexpected'],
  Happy: ['happy ending', 'uplifting ending'],
  Open: ['open ending', 'ambiguous'],
  Emotional: ['emotional ending', 'bittersweet'],
};

function detect(query, dict, fallback) {
  const q = query.toLowerCase();
  const hits = Object.entries(dict).filter(([, kws]) => kws.some(k => q.includes(k)));
  return hits.length ? hits.map(([label]) => label) : [fallback];
}

function detectReleasePreference(query) {
  const q = query.toLowerCase();
  if (/(after 20\d\d|recent|new release|modern)/.test(q)) return 'Modern Movies';
  if (/(classic|old|90s|80s)/.test(q)) return 'Classic Titles';
  return 'Any Era';
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic fake runtime, so it's stable across renders for the same title. */
export function durationFor(item) {
  const h = hashString(item.title);
  if (item.type === 'Movie') return `${95 + (h % 45)} min`;
  return `${1 + (h % 5)} Season${(h % 5) ? 's' : ''}`;
}

const REASON_BANK = [
  'Strong tonal match with what you described',
  'Similar pacing to titles you searched for',
  'Matches the mood you asked for',
  'Highly rated by viewers with similar taste',
  'Fits the release window you asked about',
  'Shares key genre elements with your request',
];

/**
 * Mock "AI understanding" of a free-text request. Swap this for a real
 * call to your NLP/LLM endpoint once it exists — the shape returned
 * (genres, moods, endings, releasePreference, results) is what the UI
 * expects either way.
 */
export function analyzeRequest(query, count = 8) {
  const genres = detect(query, GENRE_KEYWORDS, 'Drama');
  const moods = detect(query, MOOD_KEYWORDS, 'Engaging');
  const endings = detect(query, ENDING_KEYWORDS, 'Satisfying');
  const releasePreference = detectReleasePreference(query);

  const excludeHorror = /without horror|no horror/i.test(query);

  let pool = CATALOG.filter(item => {
    if (excludeHorror && item.genres.includes('Horror')) return false;
    return genres.some(g => item.genres.includes(g));
  });

  if (pool.length < count) {
    const rest = CATALOG.filter(item => !pool.includes(item) && !(excludeHorror && item.genres.includes('Horror')));
    pool = [...pool, ...rest];
  }

  const results = pool.slice(0, count).map((item, i) => {
    const h = hashString(item.title + query);
    const match = 80 + (h % 19); // 80-98
    const reasonCount = 2 + (h % 3);
    const reasons = Array.from({ length: reasonCount }, (_, j) => REASON_BANK[(h + j) % REASON_BANK.length]);
    return {
      ...item,
      rank: i + 1,
      match,
      duration: durationFor(item),
      reasons,
    };
  });

  return {
    understood: { genres, moods, endings, releasePreference },
    results,
  };
}
