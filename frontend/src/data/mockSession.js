// In-memory/localStorage mock of the Laravel backend's stateful bits
// (users, favorites, watch history) so the app works end-to-end before
// the real API is live. All shapes mirror the API contract exactly.

const USERS_KEY = 'cinematch_mock_users';
const FAVORITES_KEY = 'cinematch_mock_favorites';
const HISTORY_KEY = 'cinematch_mock_history';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function delay(ms = 500) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fakeToken(email) {
  return `mock.${btoa(email)}.${Date.now()}`;
}

export async function mockRegister({ email, password, password_confirmation }) {
  await delay();
  if (password !== password_confirmation) {
    throw { status: 'error', message: 'بيانات غير صحيحة', errors: { password_confirmation: ['Passwords do not match.'] } };
  }
  const users = read(USERS_KEY, []);
  if (users.some(u => u.email === email)) {
    throw { status: 'error', message: 'بيانات غير صحيحة', errors: { email: ['This email is already registered.'] } };
  }
  const user = { id: users.length + 1, email };
  users.push({ ...user, password });
  write(USERS_KEY, users);
  return mockLogin({ email, password });
}

export async function mockLogin({ email, password }) {
  await delay();
  const users = read(USERS_KEY, []);
  const found = users.find(u => u.email === email && u.password === password);
  if (!found) {
    throw { status: 'error', message: 'Invalid email or password.' };
  }
  return {
    status: 'success',
    data: {
      user: { id: found.id, email: found.email },
      token: fakeToken(email),
      token_type: 'bearer',
      expires_in: 3600,
    },
  };
}

export async function mockFavorites(email) {
  await delay(300);
  const all = read(FAVORITES_KEY, {});
  return { status: 'success', data: all[email] || [] };
}

export async function mockToggleFavorite(email, entry) {
  await delay(300);
  const all = read(FAVORITES_KEY, {});
  const list = all[email] || [];
  const idx = list.findIndex(f => f.title === entry.title);
  let action;
  if (idx >= 0) {
    list.splice(idx, 1);
    action = 'removed';
  } else {
    list.unshift({ ...entry, added_at: new Date().toISOString() });
    action = 'added';
  }
  all[email] = list;
  write(FAVORITES_KEY, all);
  return { status: 'success', action, message: action === 'added' ? 'تم الإضافة للمفضلة' : 'تم الإزالة من المفضلة' };
}

export async function mockRemoveFavorite(email, title) {
  await delay(250);
  const all = read(FAVORITES_KEY, {});
  const list = all[email] || [];
  const idx = list.findIndex(f => f.title === title);
  if (idx < 0) throw { status: 'error', message: 'Not found in favorites.' };
  list.splice(idx, 1);
  all[email] = list;
  write(FAVORITES_KEY, all);
  return { status: 'success', message: 'تم الإزالة من المفضلة' };
}

export async function mockHistory(email) {
  await delay(300);
  const all = read(HISTORY_KEY, {});
  return { status: 'success', data: all[email] || [] };
}

export async function mockMarkWatched(email, entry) {
  await delay(300);
  const all = read(HISTORY_KEY, {});
  const list = all[email] || [];
  if (!list.some(h => h.title === entry.title)) {
    list.unshift({ ...entry, watched_at: new Date().toISOString() });
  }
  all[email] = list;
  write(HISTORY_KEY, all);
  return { status: 'success', message: 'تم تسجيل المشاهدة' };
}

export async function mockRemoveHistory(email, title) {
  await delay(250);
  const all = read(HISTORY_KEY, {});
  const list = all[email] || [];
  const idx = list.findIndex(h => h.title === title);
  if (idx < 0) throw { status: 'error', message: 'Not found in history.' };
  list.splice(idx, 1);
  all[email] = list;
  write(HISTORY_KEY, all);
  return { status: 'success', message: 'تم حذف العنصر من السجل' };
}

export function mockIsFavorite(email, title) {
  const all = read(FAVORITES_KEY, {});
  return (all[email] || []).some(f => f.title === title);
}

export function mockIsWatched(email, title) {
  const all = read(HISTORY_KEY, {});
  return (all[email] || []).some(h => h.title === title);
}

const AI_SEARCH_KEY = 'cinematch_mock_ai_searches';

export function mockAiSearchHistory(email) {
  const all = read(AI_SEARCH_KEY, {});
  return all[email] || [];
}

export function mockSaveAiSearch(email, query) {
  const all = read(AI_SEARCH_KEY, {});
  const list = all[email] || [];
  list.unshift({ query, searched_at: new Date().toISOString() });
  all[email] = list.slice(0, 8);
  write(AI_SEARCH_KEY, all);
  return all[email];
}
