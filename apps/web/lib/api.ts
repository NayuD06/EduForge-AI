import { createApiClient } from '@eduforge/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'eduforge.token';

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

/** API client dùng chung (kiểu dữ liệu lấy từ @eduforge/shared). */
export const api = createApiClient({
  baseUrl: API_URL,
  getToken: tokenStore.get,
  onUnauthorized: () => tokenStore.clear(),
});
