import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('shopflow_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch {
        localStorage.removeItem('shopflow_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadMe();
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    async login(email: string, password: string) {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('shopflow_token', data.token);
      setToken(data.token);
      setUser(data.user);
    },
    async register(name: string, email: string, password: string) {
      const { data } = await api.post('/auth/register', { name, email, password });
      localStorage.setItem('shopflow_token', data.token);
      setToken(data.token);
      setUser(data.user);
    },
    logout() {
      localStorage.removeItem('shopflow_token');
      setToken(null);
      setUser(null);
    },
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
