/**
 * useDriverRideSocket — P0-02: Driver GPS Streaming
 *
 * Driver-side ride socket hook that connects to the ride-service Socket.IO server
 * through the API Gateway at /ride/socket.io and streams real-time GPS coordinates
 * during active rides.
 *
 * Contract (from backend RideSocketEventHandler.java):
 *   - Auth:  { token: "Bearer <jwt>" }
 *   - Path:  /ride/socket.io (rewritten by gateway to ride-service:9095/socket.io)
 *   - Join:  emit("join_ride", { rideId })
 *   - Leave: emit("leave_ride", { rideId })
 *   - Emit:  emit("driver.location.update", { rideId, lat, lng, heading?, speed? })
 *   - Valid GPS statuses: ACCEPTED, PICKUP, IN_PROGRESS
 *   - Broadcast: "driver.location.updated" to room ride:{rideId}
 *
 * Completely independent from the notification socket (hooks/useSocket.tsx).
 */
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RIDE_SOCKET_URL, RIDE_SOCKET_PATH } from '@/services/api';

// GPS update throttle interval in ms (backend ping interval is 25s, 3s is reasonable)
const GPS_EMIT_INTERVAL_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseDriverRideSocketOptions {
  /** The current ride/booking ID. Null/undefined = no active ride. */
  rideId: string | null | undefined;
  /** Whether GPS streaming should be active (ride is in ACCEPTED/PICKUP/IN_PROGRESS). */
  isActive: boolean;
}

interface UseDriverRideSocketReturn {
  /** Whether the ride socket is connected. */
  isConnected: boolean;
}

/**
 * Driver-side hook that:
 * 1. Connects to ride-service Socket.IO via API Gateway (/ride/socket.io) with JWT auth
 * 2. Joins the ride room for the current ride
 * 3. Streams GPS coordinates via expo-location every 3 seconds
 * 4. Cleans up socket and location watcher on unmount or ride change
 */
export function useDriverRideSocket({
  rideId,
  isActive,
}: UseDriverRideSocketOptions): UseDriverRideSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const emitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number; heading: number | null; speed: number | null } | null>(null);
  const isConnectedRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  // ── Stop GPS watcher ─────────────────────────────────
  const stopGpsWatcher = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    if (emitIntervalRef.current) {
      clearInterval(emitIntervalRef.current);
      emitIntervalRef.current = null;
    }
    latestCoordsRef.current = null;
  }, []);

  // ── Start GPS watcher ────────────────────────────────
  const startGpsWatcher = useCallback(async (socket: Socket, activeRideId: string) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[DriverRideSocket] Location permission denied — GPS streaming disabled');
        return;
      }

      // Start watching position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,       // Update at least every 2s
          distanceInterval: 5,      // Or every 5 meters
        },
        (location) => {
          latestCoordsRef.current = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            heading: location.coords.heading ?? null,
            speed: location.coords.speed ?? null,
          };
        }
      );

      locationSubRef.current = subscription;
      console.log('[DriverRideSocket] GPS watcher started for ride', activeRideId);

      // Throttled emit loop — send latest coords every GPS_EMIT_INTERVAL_MS
      emitIntervalRef.current = setInterval(() => {
        if (!socket.connected || !latestCoordsRef.current) return;

        const { lat, lng, heading, speed } = latestCoordsRef.current;
        socket.emit('driver.location.update', {
          rideId: activeRideId,
          lat,
          lng,
          heading: heading ?? undefined,
          speed: speed ?? undefined,
        });
      }, GPS_EMIT_INTERVAL_MS);
    } catch (err) {
      console.warn('[DriverRideSocket] Failed to start GPS watcher:', err);
    }
  }, []);

  // ── Connect / disconnect lifecycle ───────────────────
  useEffect(() => {
    if (!rideId || !isActive) {
      // No active ride — clean up everything
      stopGpsWatcher();
      const socket = socketRef.current;
      if (socket) {
        if (hasJoinedRef.current) {
          socket.emit('leave_ride', { rideId });
          hasJoinedRef.current = false;
        }
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
        isConnectedRef.current = false;
      }
      return;
    }

    let cancelled = false;

    const connectSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (cancelled) return;

        if (!token) {
          console.warn('[DriverRideSocket] No access_token — skipping ride socket connection');
          return;
        }

        console.log('[DriverRideSocket] URL =', RIDE_SOCKET_URL, '| path:', RIDE_SOCKET_PATH, '| rideId:', rideId);
        const socket = io(RIDE_SOCKET_URL, {
          path: RIDE_SOCKET_PATH,
          auth: { token: `Bearer ${token}` },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 10000,
        });

        socketRef.current = socket;

        // ── Connection events ─────────────────────────
        socket.on('connect', () => {
          if (cancelled) { socket.disconnect(); return; }
          console.log('[DriverRideSocket] connected to ride socket');
          isConnectedRef.current = true;
          reconnectAttemptRef.current = 0;

          // Join ride room on connect
          if (rideId && !hasJoinedRef.current) {
            socket.emit('join_ride', { rideId });
            hasJoinedRef.current = true;
            console.log('[DriverRideSocket] joined ride room', rideId);
          }

          // Start GPS streaming
          if (rideId) {
            startGpsWatcher(socket, rideId);
          }
        });

        socket.on('disconnect', (reason) => {
          console.log('[DriverRideSocket] disconnected:', reason);
          isConnectedRef.current = false;
          hasJoinedRef.current = false;
          stopGpsWatcher();
        });

        socket.on('connect_error', (err) => {
          reconnectAttemptRef.current += 1;
          console.warn('[DriverRideSocket] connect_error:', err.message);
          if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[DriverRideSocket] Max reconnect attempts — giving up');
            socket.disconnect();
          }
        });

        // ── Server confirmations ──────────────────────
        socket.on('joined_ride', (data: any) => {
          console.log('[DriverRideSocket] joined_ride confirmed:', JSON.stringify(data));
        });

        socket.on('left_ride', (data: any) => {
          console.log('[DriverRideSocket] left_ride confirmed:', JSON.stringify(data));
        });

        socket.on('socket_error', (data: any) => {
          console.warn('[DriverRideSocket] socket_error:', JSON.stringify(data));
        });

      } catch (err) {
        console.warn('[DriverRideSocket] Failed to initialize:', err);
      }
    };

    connectSocket();

    // ── Cleanup ───────────────────────────────────────
    return () => {
      cancelled = true;
      stopGpsWatcher();
      const socket = socketRef.current;
      if (socket) {
        if (hasJoinedRef.current && rideId) {
          socket.emit('leave_ride', { rideId });
        }
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
        hasJoinedRef.current = false;
        isConnectedRef.current = false;
      }
    };
  }, [rideId, isActive]);

  return {
    isConnected: isConnectedRef.current,
  };
}
