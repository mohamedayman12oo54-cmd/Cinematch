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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

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
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
