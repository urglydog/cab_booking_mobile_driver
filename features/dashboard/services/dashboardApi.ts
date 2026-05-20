import api from '@/services/api';

export const updateAvailability = async (isOnline: boolean, latitude: number, longitude: number) => {
  const response = await api.patch('/api/drivers/me/availability', {
    availabilityStatus: isOnline ? 'ONLINE' : 'OFFLINE',
    currentLatitude: latitude,
    currentLongitude: longitude
  });
  return response.data;
};
