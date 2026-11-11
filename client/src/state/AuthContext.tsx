import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { readStorage, writeStorage } from '../lib/storage';
import { api } from '../lib/api';
import type { User } from '../types';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  sessionError: string;
  retrySession: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(readStorage('shopflow_token'));
  const [loading, setLoading] = useState(true);

  const [sessionError, setSessionError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const loadMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setSessionError('');
      try {
        const { data } = await api.get('/auth/me');
        if (active) setUser(data.user);
      } catch (error) {
        if (!active) return;
        if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status || 0)) {
          writeStorage('shopflow_token', null);
          setToken(null);
          setUser(null);
        } else {
          setSessionError('Session could not be checked. Your sign-in is saved; retry when the connection returns.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMe();
    return () => { active = false; };
  }, [token, retry]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    sessionError,
    retrySession: () => setRetry((v) => v + 1),
    async login(email: string, password: string) {
      const { data } = await api.post('/auth/login', { email, password });
      writeStorage('shopflow_token', data.token);
      api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      setToken(data.token);
      setUser(data.user);
    },
    async register(name: string, email: string, password: string) {
      const { data } = await api.post('/auth/register', { name, email, password });
      writeStorage('shopflow_token', data.token);
      api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      setToken(data.token);
      setUser(data.user);
    },
    logout() {
      writeStorage('shopflow_token', null);
      delete api.defaults.headers.common.Authorization;
      setToken(null);
      setUser(null);
    },
  }), [user, token, loading, sessionError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
