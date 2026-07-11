const TOKEN_KEY = 'cinematch_token';
const TOKEN_EXPIRY_KEY = 'cinematch_token_expiry';
const USER_KEY = 'cinematch_user';

export { TOKEN_KEY, TOKEN_EXPIRY_KEY, USER_KEY };

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession({ token, expires_in, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (expires_in) {
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expires_in * 1000));
  }
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isTokenExpired() {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return false;
  return Date.now() >= Number(expiry);
}
