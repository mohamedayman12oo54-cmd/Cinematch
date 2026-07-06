import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// If no backend URL is configured, every api/*.js module falls back to the
// in-memory mock implementation so the app is fully runnable on its own.
export const USE_MOCK = !API_BASE_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('cinematch_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  res => res.data,
  err => {
    const payload = err.response?.data || { status: 'error', message: 'Network error' };
    if (err.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(payload);
  }
);
