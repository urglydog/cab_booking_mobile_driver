import api from '@/services/api';

export const getDriverProfile = async () => {
  const response = await api.get('/api/drivers/me/profile');
  return response.data.result;
};

export const updateDriverProfile = async (profileData: any) => {
  const response = await api.put('/api/drivers/me/profile', profileData);
  return response.data;
};
