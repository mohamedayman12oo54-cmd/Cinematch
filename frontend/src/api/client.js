import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// If no backend URL is configured, every api/*.js module falls back to the
// in-memory mock implementation so the app is fully runnable on its own.
export const USE_MOCK = !API_BASE_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let pendingQueue = []; // { resolve, reject } لكل request مستني نتيجة الـ refresh

// بتنادى مرة واحدة لما الـ refresh يخلص - سواء نجح (بتبعتلهم التوكن الجديد)
// أو فشل (بترفض كل الـ requests المستنية بدل ما تسيبها عالقة للأبد)
function processQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('cinematch_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints بتاعة auth نفسها - لو حصلها 401 (يعني إيميل/باسورد غلط أو توكن الـ
// refresh نفسه غير صالح) منحاولش نعمل refresh، لأن ده مش توكن منتهي أصلاً
const AUTH_ENDPOINTS_NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

apiClient.interceptors.response.use(
  res => res.data,
  async err => {
    const originalRequest = err.config;
    const payload = err.response?.data || { status: 'error', message: 'Network error' };

    const isAuthEndpoint = AUTH_ENDPOINTS_NO_REFRESH.some(path =>
      originalRequest?.url?.includes(path)
    );

    // If 401 and not already retrying and not an auth endpoint itself
    if (err.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // فيه refresh شغال بالفعل - استنى نتيجته بدل ما تعمل واحد جديد
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(newToken => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // مفيش "refresh token" منفصل في الباك ده - بتاخد نفس التوكن الحالي
        // (اللي لسه لتوه منتهي) وتبعته تاني لـ /auth/refresh يرجعلك واحد جديد
        const currentToken = localStorage.getItem('cinematch_token');
        if (!currentToken) {
          throw new Error('No token available');
        }

        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          }
        });

        const newToken = res.data.data.token;
        localStorage.setItem('cinematch_token', newToken);
        isRefreshing = false;
        processQueue(null, newToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        // Refresh failed - reject anyone waiting in the queue too, clear
        // the token and redirect to login
        const rejection = { status: 'error', message: 'Session expired. Please login again.' };
        processQueue(rejection);
        localStorage.removeItem('cinematch_token');
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(rejection);
      }
    }

    if (err.response?.status === 401 && !isAuthEndpoint) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(payload);
  }
);
