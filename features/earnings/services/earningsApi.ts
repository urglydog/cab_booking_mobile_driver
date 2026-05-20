import api from '@/services/api';

export const getEarningsSummary = async (period = 'weekly') => {
  const response = await api.get('/api/drivers/me/earnings/summary', {
    params: { period }
  });
  return response.data;
};
