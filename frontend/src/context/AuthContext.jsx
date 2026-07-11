import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

const TOKEN_KEY = 'cinematch_token';
const USER_KEY = 'cinematch_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  // checkingSession: بيتحقق من التوكن أول ما التطبيق يفتح (في الباك جراوند،
  // من غير ما يوقف عرض الصفحة - المستخدم شايف نفسه "مسجل دخول" فوراً من
  // البيانات المحفوظة، وفي نفس الوقت بنتأكد إنها لسه صحيحة)
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  // أول ما التطبيق يفتح: لو فيه توكن محفوظ، تأكد إنه لسه شغال وحدّث بيانات
  // المستخدم (خصوصاً الـ stage اللي بيتغير كل ما يضيف مفضلة/مشاهدة)
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setCheckingSession(false);
      return;
    }
    authApi.me()
      .then(res => {
        if (res) setUser(res.data);
      })
      .catch(() => {
        // التوكن مش صالح (وفشل الـ refresh التلقائي جوه apiClient كمان) - امسحه
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // بتنادى بعد أي حاجة ممكن تغيّر الـ stage (إضافة/إزالة مفضلة أو مشاهدة)
  // عشان الـ badge اللي شايفه المستخدم (في الـ Header مثلاً) يفضل متزامن
  async function refreshUser() {
    try {
      const res = await authApi.me();
      if (res) setUser(res.data);
    } catch {
      // لو فشلت، سيب القيمة القديمة - مش لازم نطرد المستخدم عشان تحديث بسيط فشل
    }
  }

  async function login({ email, password }) {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setUser(res.data.user);
      return res.data.user;
    } finally {
      setLoading(false);
    }
  }

  async function register({ email, password, password_confirmation }) {
    setLoading(true);
    try {
      const res = await authApi.register({ email, password, password_confirmation });
      localStorage.setItem(TOKEN_KEY, res.data.token);
      setUser(res.data.user);
      return res.data.user;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loading,
        checkingSession,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
