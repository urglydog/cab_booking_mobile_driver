/**
 * useDriverLocation — Real GPS location management for driver availability.
 *
 * Manages three distinct GPS flows per backend contract:
 *
 * 1. AVAILABILITY (toggleOnline):
 *    PATCH /api/drivers/me/availability
 *    { availabilityStatus: "ONLINE"|"OFFLINE", currentLatitude, currentLongitude }
 *    → Backend saves to PG + Redis GEO (driver:available:locations)
 *
 * 2. HEARTBEAT (while ONLINE, no active ride):
 *    PATCH /api/drivers/me/location
 *    { lat, lng }
 *    → Backend updates Redis GEO only (no PG write)
 *    → Only works when status=AVAILABLE (no active ride)
 *
 * 3. RIDE GPS (during active ride):
 *    Handled by useDriverRideSocket hook (ride-service socket via API Gateway /ride/socket.io)
 *    emit("driver.location.update", { rideId, lat, lng, heading?, speed? })
 *    → This hook STOPS heartbeat when ride is active
 *
 * Safety:
 * - If permission denied: shows Alert, returns null location
 * - No mock/fallback coordinates in production
 * - __DEV__ && USE_MOCK_LOCATION only (no production mock)
 * - Proper cleanup on unmount
 * - No duplicate intervals, no infinite loops
 *
 * Stale-coord fix:
 * - latestCoordsRef is updated by watchPositionAsync callback on every GPS tick
 * - Heartbeat reads latestCoordsRef.current at SEND time (not capture time)
 * - heartbeatLifecycle effect does NOT depend on driverLocation state
 *   (previously caused interval reset on every GPS tick, starving the heartbeat)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import api from '@/services/api';

// Heartbeat interval: 15 seconds (matches backend expectation for Redis GEO TTL)
const HEARTBEAT_INTERVAL_MS = 15000;

// ── Dev-only mock toggle ──────────────────────────────
// Set USE_MOCK_LOCATION = true ONLY in __DEV__ for testing without GPS
const USE_MOCK_LOCATION = false;
const MOCK_COORDS = { latitude: 10.822, longitude: 106.687 };

interface DriverLocationState {
  latitude: number;
  longitude: number;
}

interface UseDriverLocationReturn {
  /** Current GPS coordinates, null if permission denied or not yet acquired */
  driverLocation: DriverLocationState | null;
  /** Whether the hook has finished the initial permission + location request */
  isReady: boolean;
  /** Convenience: get current position (one-shot). Returns null if denied. */
  getCurrentPosition: () => Promise<DriverLocationState | null>;
}

export function useDriverLocation(
  isOnline: boolean,
  hasActiveRide: boolean
): UseDriverLocationReturn {
  const [driverLocation, setDriverLocation] = useState<DriverLocationState | null>(null);
  const [isReady, setIsReady] = useState(false);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestCoordsRef = useRef<DriverLocationState | null>(null);
  const isOnlineRef = useRef(isOnline);
  const hasActiveRideRef = useRef(hasActiveRide);

  // Keep refs in sync with props
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { hasActiveRideRef.current = hasActiveRide; }, [hasActiveRide]);

  // ── One-shot getCurrentPosition ─────────────────────
  const getCurrentPosition = useCallback(async (): Promise<DriverLocationState | null> => {
    if (__DEV__ && USE_MOCK_LOCATION) {
      return MOCK_COORDS;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setDriverLocation(coords);
      latestCoordsRef.current = coords;
      return coords;
    } catch (err) {
      console.warn('[useDriverLocation] getCurrentPosition failed:', err);
      return null;
    }
  }, []);

  // ── Stop watcher + heartbeat ────────────────────────
  const cleanup = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // ── Start GPS watcher ───────────────────────────────
  const startWatcher = useCallback(async () => {
    if (__DEV__ && USE_MOCK_LOCATION) {
      setDriverLocation(MOCK_COORDS);
      latestCoordsRef.current = MOCK_COORDS;
      return true;
    }

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,       // Update at least every 3s
          distanceInterval: 2,      // Or every 2 meters (lowered for testing)
        },
        (location) => {
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          // Debug: log every watch update so we can verify the callback fires
          console.log('[GPS] watch update → lat:', coords.latitude, 'lng:', coords.longitude);
          setDriverLocation(coords);
          latestCoordsRef.current = coords;
        }
      );
      locationSubRef.current = subscription;
      return true;
    } catch (err) {
      console.warn('[useDriverLocation] watchPositionAsync failed:', err);
      return false;
    }
  }, []);

  // ── Start heartbeat ─────────────────────────────────
  const startHeartbeat = useCallback(() => {
    // Clear any existing heartbeat
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(async () => {
      // Only heartbeat when ONLINE and no active ride
      if (!isOnlineRef.current || hasActiveRideRef.current) return;
      if (!latestCoordsRef.current) return;

      const body = {
        lat: latestCoordsRef.current.latitude,
        lng: latestCoordsRef.current.longitude,
      };
      console.log('[useDriverLocation] heartbeat using latest GPS →', JSON.stringify(body));
      try {
        const response = await api.patch('/api/drivers/me/location', body);
        console.log('[DEBUG] heartbeat response status:', response.status);
      } catch (err: any) {
        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.message || err?.message;
        console.log('[DEBUG] heartbeat FAILED — status:', status, 'message:', serverMsg);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  // ── Main initialization effect ──────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // 1. Request foreground permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập vị trí bị từ chối',
          'Ứng dụng cần quyền truy cập vị trí để hoạt động chính xác. Vui lòng cấp quyền trong Cài đặt.',
          [{ text: 'OK' }]
        );
        setIsReady(true);
        return;
      }

      // 2. Get initial position (one-shot)
      await getCurrentPosition();
      if (cancelled) return;

      // 3. Start continuous GPS watcher
      await startWatcher();
      if (cancelled) return;

      setIsReady(true);
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []); // Run once on mount

  // ── Heartbeat lifecycle: start/stop based on online + ride state ──
  // NOTE: Does NOT depend on `driverLocation` — previously this caused the
  // interval to be reset on every GPS tick (every 3-5s), starving the 15s heartbeat.
  // Now the interval is stable; it reads latestCoordsRef.current at send time.
  useEffect(() => {
    if (isOnline && !hasActiveRide) {
      // Start heartbeat: driver is ONLINE and has no active ride
      startHeartbeat();
    } else {
      // Stop heartbeat: driver is OFFLINE or has active ride
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isOnline, hasActiveRide]);

  return {
    driverLocation,
    isReady,
    getCurrentPosition,
  };
}
