import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const IP_ADDRESS = process.env.EXPO_PUBLIC_IP_ADDRESS || '192.168.1.57';
export const GATEWAY_PORT = process.env.EXPO_PUBLIC_GATEWAY_PORT || '8080';
export const SOCKET_IO_PORT = process.env.EXPO_PUBLIC_SOCKET_PORT || '9093';

// Kiểm tra xem IP_ADDRESS có phải là domain tunnel công khai hay không (ví dụ: ngrok, localtunnel, cloudflare)
const isTunnel = IP_ADDRESS.startsWith('http') || (IP_ADDRESS.includes('.') && !/^\d+(\.\d+){3}$/.test(IP_ADDRESS));

export const GATEWAY_URL = isTunnel
  ? (IP_ADDRESS.startsWith('http') ? IP_ADDRESS : `https://${IP_ADDRESS}`)
  : `http://${IP_ADDRESS}:${GATEWAY_PORT}`;

export const BOOKING_SERVICE_URL = GATEWAY_URL;
export const AUTH_SERVICE_URL = GATEWAY_URL;
export const NOTIFICATION_SERVICE_URL = GATEWAY_URL;

// SocketIO connects directly to notification-service (port 9093), NOT through API Gateway.
// The API Gateway does not proxy the Java netty-socketio WebSocket protocol.
export const SOCKET_URL = isTunnel
  ? (IP_ADDRESS.startsWith('https')
      ? IP_ADDRESS.replace('https', 'wss')
      : IP_ADDRESS.startsWith('http')
        ? IP_ADDRESS.replace('http', 'ws')
        : `wss://${IP_ADDRESS}`)
  : `http://${IP_ADDRESS}:${SOCKET_IO_PORT}`;

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
