import api, { GATEWAY_URL } from '@/services/api';

export const loginDriver = async (payload: any) => {
  const response = await api.post('/api/auth/login', {
    ...payload,
    deviceId: 'mobile-app',
    platform: 'ANDROID',
  }, { baseURL: GATEWAY_URL });
  return response.data.result;
};
