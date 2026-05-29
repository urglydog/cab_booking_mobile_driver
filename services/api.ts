import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const IP_ADDRESS = process.env.EXPO_PUBLIC_IP_ADDRESS || '192.168.1.57';
export const GATEWAY_PORT = process.env.EXPO_PUBLIC_GATEWAY_PORT || '8080';
export const SOCKET_IO_PORT = process.env.EXPO_PUBLIC_SOCKET_PORT || '9093';

// Detect if IP_ADDRESS is a tunnel URL (ngrok, cloudflare, etc.) and avoid appending a port.
const isTunnel = IP_ADDRESS.startsWith('http://') || IP_ADDRESS.startsWith('https://')
  || (IP_ADDRESS.includes('.') && !/^\d+(\.\d+){3}$/.test(IP_ADDRESS));

export const GATEWAY_URL = process.env.EXPO_PUBLIC_GATEWAY_URL
  || (isTunnel
    ? (IP_ADDRESS.startsWith('http') ? IP_ADDRESS.trim() : `https://${IP_ADDRESS.trim()}`)
    : `http://${IP_ADDRESS}:${GATEWAY_PORT}`);

export const BOOKING_SERVICE_URL = GATEWAY_URL;
export const AUTH_SERVICE_URL = GATEWAY_URL;
export const NOTIFICATION_SERVICE_URL = GATEWAY_URL;

// SocketIO for notification-service still connects directly.
export const SOCKET_URL = isTunnel
  ? (IP_ADDRESS.startsWith('https')
      ? IP_ADDRESS.replace('https', 'wss')
      : IP_ADDRESS.startsWith('http')
        ? IP_ADDRESS.replace('http', 'ws')
        : `wss://${IP_ADDRESS}`)
  : `http://${IP_ADDRESS}:${SOCKET_IO_PORT}`;

// Ride Socket is proxied through API Gateway at /ride/socket.io.
export const RIDE_SOCKET_URL = GATEWAY_URL;
export const RIDE_SOCKET_PATH = '/ride/socket.io';

const api = axios.create({
  baseURL: GATEWAY_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    const isPublicEndpoint = config.url?.includes('/auth/');

    if (token && !isPublicEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
