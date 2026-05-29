import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const IP_ADDRESS = process.env.EXPO_PUBLIC_IP_ADDRESS || '192.168.1.57';
const GATEWAY_PORT = process.env.EXPO_PUBLIC_GATEWAY_PORT || '8080';

// Detect if IP_ADDRESS is a tunnel URL (ngrok, cloudflare, etc.) — don't append port
const isTunnel = IP_ADDRESS.startsWith('http://') || IP_ADDRESS.startsWith('https://')
  || (IP_ADDRESS.includes('.') && !/^\d+(\.\d+){3}$/.test(IP_ADDRESS));

export const GATEWAY_URL = process.env.EXPO_PUBLIC_GATEWAY_URL
  || (isTunnel
    ? (IP_ADDRESS.startsWith('http') ? IP_ADDRESS.trim() : `https://${IP_ADDRESS.trim()}`)
    : `http://${IP_ADDRESS}:${GATEWAY_PORT}`);
export const BOOKING_SERVICE_URL = process.env.EXPO_PUBLIC_BOOKING_SERVICE_URL || `http://${IP_ADDRESS}:8084`;
export const AUTH_SERVICE_URL = process.env.EXPO_PUBLIC_AUTH_SERVICE_URL || `http://${IP_ADDRESS}:8081`;
export const NOTIFICATION_SERVICE_URL = process.env.EXPO_PUBLIC_NOTIFICATION_SERVICE_URL || `http://${IP_ADDRESS}:8092`;

// Ride Socket — now proxied through API Gateway at /ride/socket.io
// No more separate ngrok tunnel or direct port 9095 needed.
// The gateway rewrites /ride/socket.io/** → ride-service:9095/socket.io/**
export const RIDE_SOCKET_URL = GATEWAY_URL;
export const RIDE_SOCKET_PATH = '/ride/socket.io';

const api = axios.create({
  baseURL: GATEWAY_URL, // Default to Gateway
  timeout: 30000, // Increased to 30s for stability during startup
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add JWT token to every request
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    // Skip adding token for public endpoints to avoid 401 on expired tokens
    const isPublicEndpoint = config.url?.includes('/auth/');

    if (token && !isPublicEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
