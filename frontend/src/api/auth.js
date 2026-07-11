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

// POST /auth/refresh  (protected) - refresh JWT token
export function refreshToken() {
  if (USE_MOCK) {
    return new Promise(resolve => setTimeout(() => resolve({ 
      status: 'success', 
      data: { 
        token: 'new_mock_token_' + Date.now(),
        token_type: 'bearer',
        expires_in: 3600
      } 
    }), 500));
  }
  return apiClient.post('/auth/refresh');
}

// ⚠️ الـ endpoints دي (forgot/reset password) مش موجودة في الـ API Contract
// اللي الباك بعتهولنا خالص. لو حاولنا نبعتلها، هتاخد 404 أو حاجة غير متوقعة.
// لحد ما فريق الباك يضيفها فعلياً، بنرجع رسالة واضحة بدل محاولة فاشلة صامتة.
const NOT_IMPLEMENTED = () =>
  Promise.reject({
    status: 'error',
    message: 'الخدمة دي لسه مش متاحة من السيرفر. كلم فريق الباك إند لإضافتها.',
  });

export function requestPasswordReset(email) {
  if (USE_MOCK) {
    return new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 700));
  }
  return NOT_IMPLEMENTED();
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
  return NOT_IMPLEMENTED();
}
