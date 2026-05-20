import api from '@/services/api';

export const getCompletedJobs = async (page = 0, size = 10) => {
  const response = await api.get('/api/drivers/me/rides/history', {
    params: { page, size }
  });
  return response.data;
};
