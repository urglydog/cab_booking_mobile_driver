import AsyncStorage from '@react-native-async-storage/async-storage';

import api, { GATEWAY_URL } from '@/services/api';

export const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token', 'user_id', 'user_name', 'user_role'];

export const clearAuthStorage = async () => {
  await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);
};

export const loginDriver = async (payload: any) => {
  const response = await api.post('/api/auth/login', {
    ...payload,
    deviceId: 'mobile-app',
    platform: 'ANDROID',
  }, { baseURL: GATEWAY_URL });
  return response.data.result;
};

export const changeDriverPassword = async (payload: { currentPassword: string; newPassword: string }) => {
  const response = await api.post('/api/auth/password/change', payload, { baseURL: GATEWAY_URL });
  return response.data.result;
};

export const logoutDriver = async (refreshToken?: string | null) => {
  if (refreshToken) {
    try {
      await api.post('/api/auth/logout', { refreshToken }, { baseURL: GATEWAY_URL });
    } catch (error) {
      console.warn('Logout request failed, clearing local session anyway.', error);
    }
  }

  await clearAuthStorage();
};
