import { createApiClient } from '@eduforge/shared';
import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';
const TOKEN_KEY = 'eduforge.token';

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

/** API client dùng chung với web/admin (kiểu dữ liệu từ @eduforge/shared). */
export const api = createApiClient({
  baseUrl: API_URL,
  getToken: tokenStore.get,
  onUnauthorized: () => void tokenStore.clear(),
});
