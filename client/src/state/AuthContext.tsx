import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setApiToken } from '../lib/api';
import type { User } from '../types';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  persistenceWarning: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const tokenKey = 'shopflow_token';
const failedRemovalWarning = 'Signed out in this tab, but the saved sign-in could not be removed. It may return after reload. Clear this site’s browser data before using a shared device.';

function validToken(token: unknown): token is string {
  return typeof token === 'string' && token.length <= 8192
    && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

function validUser(user: unknown): user is User {
  if (typeof user !== 'object' || user === null) return false;
  const value = user as Record<string, unknown>;
  return Number.isSafeInteger(value.id) && Number(value.id) > 0
    && typeof value.name === 'string' && typeof value.email === 'string'
    && (value.role === 'USER' || value.role === 'ADMIN');
}

function loadSavedSession() {
  try {
    const token = localStorage.getItem(tokenKey);
    if (token === null || validToken(token)) return { token, warning: null };
    return { token: null, warning: 'The saved sign-in is invalid and has not been used. Please sign in again.' };
  } catch {
    return { token: null, warning: 'Browser storage is unavailable. You can sign in for this tab only.' };
  }
}

function removeSavedToken(): boolean {
  try {
    localStorage.removeItem(tokenKey);
    return true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState(loadSavedSession);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(initial.token);
  const [loading, setLoading] = useState(Boolean(initial.token));
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(initial.warning);
  const generation = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== tokenKey && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== window.localStorage) return;
      } catch {
        // If access was revoked, ending this tab's session still fails closed.
      }
      ++generation.current;
      setApiToken(null);
      setToken(null);
      setUser(null);
      setLoading(false);
      setPersistenceWarning('Sign-in changed in another tab. Please sign in again.');
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      mounted.current = false;
      window.removeEventListener('storage', handleStorage);
      setApiToken(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestGeneration = generation.current;
    setApiToken(token);
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const loadMe = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (cancelled || generation.current !== requestGeneration) return;
        if (!validUser(data.user)) throw new Error('Invalid account response');
        setUser(data.user);
      } catch {
        if (cancelled || generation.current !== requestGeneration) return;
        setApiToken(null);
        setToken(null);
        setUser(null);
        setPersistenceWarning(removeSavedToken()
          ? 'Your saved sign-in could not be verified. Please sign in again.'
          : failedRemovalWarning);
      } finally {
        if (!cancelled && generation.current === requestGeneration) setLoading(false);
      }
    };
    void loadMe();
    return () => { cancelled = true; };
  }, [token]);

  const value = useMemo<AuthContextValue>(() => {
    const authenticate = async (path: string, credentials: Record<string, string>) => {
      const requestGeneration = ++generation.current;
      try {
        const { data } = await api.post(path, credentials);
        if (!mounted.current || generation.current !== requestGeneration) {
          throw new Error('Sign-in was cancelled. Please try again.');
        }
        if (!validToken(data.token) || !validUser(data.user)) {
          throw new Error('The server returned an invalid sign-in response.');
        }
        let warning: string | null = null;
        try {
          localStorage.setItem(tokenKey, data.token);
        } catch {
          warning = removeSavedToken()
            ? 'Signed in for this tab only. Your sign-in could not be saved and will be lost on reload.'
            : 'Signed in for this tab only. A previous saved sign-in could not be removed and may return after reload. Clear this site’s browser data before sharing this device.';
        }
        setApiToken(data.token);
        setToken(data.token);
        setUser(data.user);
        setPersistenceWarning(warning);
        setLoading(false);
      } catch (error) {
        if (mounted.current && generation.current === requestGeneration) {
          setApiToken(null);
          setToken(null);
          setUser(null);
          setLoading(false);
          setPersistenceWarning(removeSavedToken() ? null : failedRemovalWarning);
        }
        throw error;
      }
    };
    return {
      user, token, loading, persistenceWarning,
      login: (email, password) => authenticate('/auth/login', { email, password }),
      register: (name, email, password) => authenticate('/auth/register', { name, email, password }),
      logout() {
        ++generation.current;
        setApiToken(null);
        setToken(null);
        setUser(null);
        setLoading(false);
        setPersistenceWarning(removeSavedToken() ? null : failedRemovalWarning);
      },
    };
  }, [user, token, loading, persistenceWarning]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
