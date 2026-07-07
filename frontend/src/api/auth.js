import { apiClient, USE_MOCK } from './client';
import { mockRegister, mockLogin } from '../data/mockSession';

// POST /auth/register — BR11: minimal data only (email + password).
export function register({ email, password, password_confirmation }) {
  if (USE_MOCK) return mockRegister({ email, password, password_confirmation });
  return apiClient.post('/auth/register', { email, password, password_confirmation });
}

// POST /auth/login
export function login({ email, password }) {
  if (USE_MOCK) return mockLogin({ email, password });
  return apiClient.post('/auth/login', { email, password });
}

// POST /auth/logout  (protected)
export function logout() {
  if (USE_MOCK) return Promise.resolve({ status: 'success' });
  return apiClient.post('/auth/logout');
}

// GET /auth/me  (protected)
export function me() {
  if (USE_MOCK) return Promise.resolve(null);
  return apiClient.get('/auth/me');
}

// NOTE: not in the current API contract — coordinate the exact route/shape
// with the backend team before wiring the real branch. Mocked here so the
// full auth flow (including "forgot password") is demoable end to end.
export function requestPasswordReset(email) {
  if (USE_MOCK) {
    return new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 700));
  }
  return apiClient.post('/auth/forgot-password', { email });
}

export function resetPassword({ token, password, password_confirmation }) {
  if (USE_MOCK) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (password !== password_confirmation) {
          reject({ status: 'error', message: 'Passwords do not match.' });
        } else {
          resolve({ status: 'success' });
        }
      }, 700);
    });
  }
  return apiClient.post('/auth/reset-password', { token, password, password_confirmation });
}
