import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL,
});

let sessionToken: string | null = null;

// The provider owns the session. A failed storage operation must not revive an
// old token on the next request, or break requests while signing in in memory.
export function setApiToken(token: string | null) {
  sessionToken = token;
}

api.interceptors.request.use((config) => {
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});
