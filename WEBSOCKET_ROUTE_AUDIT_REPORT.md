# WebSocket + Route Display Audit Report

**Date:** 2026-05-25  
**Scope:** Driver app WebSocket connection, Customer app ride socket, Driver map route polyline

---

## 1. WebSocket Error Fix

### 1.1 Root Cause

The driver app's [`RIDE_SOCKET_URL`](cab_booking_mobile_driver/services/api.ts:18) was constructed as:

```
RIDE_SOCKET_URL = 'http://' + IP_ADDRESS + ':9095'
```

When `IP_ADDRESS` is an ngrok HTTPS URL (`https://mispublicized-zoophily-janey.ngrok-free.dev`), this produced a **malformed URL**:

```
http://https://mispublicized-zoophily-janey.ngrok-free.dev:9095
```

Socket.IO client cannot connect to this URL → `connect_error: websocket error`.

Additionally, the **API Gateway has NO WebSocket proxy route** to ride-service port 9095. The gateway's [`application.yaml`](Nhom13_KTTKPM_DHKTPM18A/cab_booking/cab-booking-config/api-gateway.yaml) only proxies HTTP REST routes. The ride-service Socket.IO server runs standalone on port 9095 via [`RideSocketConfig.java`](Nhom13_KTTKPM_DHKTPM18A/cab_booking/ride-service/src/main/java/com/cab/ride/config/RideSocketConfig.java).

### 1.2 Fix Applied

#### Driver App — [`cab_booking_mobile_driver/services/api.ts`](cab_booking_mobile_driver/services/api.ts)

Added tunnel-aware URL construction + `EXPO_PUBLIC_RIDE_SOCKET_URL` env override:

```typescript
export const RIDE_SOCKET_URL = process.env.EXPO_PUBLIC_RIDE_SOCKET_URL
  || (isTunnel
    ? (IP_ADDRESS.startsWith('https')
        ? IP_ADDRESS.trim().replace('https', 'wss')
        : IP_ADDRESS.startsWith('http')
          ? IP_ADDRESS.trim().replace('http', 'ws')
          : `wss://${IP_ADDRESS.trim()}`)
    : `http://${IP_ADDRESS}:9095`);
```

**LAN mode:** `http://192.168.x.x:9095` (direct connection)  
**Tunnel mode:** `wss://mispublicized-zoophily-janey.ngrok-free.dev` (requires separate ngrok tunnel for port 9095)

#### Customer App — [`cab_booking_mobile/services/api.ts`](cab_booking_mobile/services/api.ts)

Same `EXPO_PUBLIC_RIDE_SOCKET_URL` env override added. The customer app already had tunnel detection but was missing the env override path.

#### Debug Logs Added

- [`useDriverRideSocket.tsx`](cab_booking_mobile_driver/hooks/useDriverRideSocket.tsx) — `[DriverRideSocket] URL =` logged before socket connection
- [`useRideSocket.tsx`](cab_booking_mobile/hooks/useRideSocket.tsx) — `[RideSocket] URL =` logged before socket connection

### 1.3 Environment Configuration

Both `.env` files updated with documentation:

**Driver** — [`cab_booking_mobile_driver/.env`](cab_booking_mobile_driver/.env):
```
# Ride Socket URL — ride-service Socket.IO runs on standalone port 9095
# When using ngrok: you need a SEPARATE ngrok tunnel for port 9095
#   1. Run: ngrok http 9095
#   2. Set the tunnel URL below (use wss:// for HTTPS ngrok)
# EXPO_PUBLIC_RIDE_SOCKET_URL=wss://<your-ride-socket-ngrok-url>
```

**Customer** — [`cab_booking_mobile/.env`](cab_booking_mobile/.env): Same documentation added.

---

## 2. Route Display Fix

### 2.1 Root Cause

The driver app's [`index.tsx`](cab_booking_mobile_driver/app/(driver-tabs)/index.tsx) had a **static hardcoded polyline**:

```typescript
const routeCoordinates = [
  { latitude: 10.8505, longitude: 106.7717 }, // IUH
  { latitude: 10.8520, longitude: 106.7740 },
  // ... 8 points total → IUH to Notre Dame Cathedral
];
```

This was always rendered regardless of trip state — showing a fake route from IUH to Notre Dame Cathedral instead of the actual pickup→dropoff route.

### 2.2 Fix Applied

#### [`cab_booking_mobile_driver/app/(driver-tabs)/index.tsx`](cab_booking_mobile_driver/app/(driver-tabs)/index.tsx)

**A. Added `fetchRoute()` function** (lines 11-36) using Mapbox Directions API:

```typescript
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_API_KEY || '';
async function fetchRoute(from, to): Promise<Array<{latitude; longitude}>> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  // Returns decoded coordinate array from response
}
```

**B. Added `routeCoordinates` state** (line 49):

```typescript
const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
```

**C. Added route-fetching `useEffect`** (lines 183-228):

| Trip State | Route Source → Destination | Trigger |
|---|---|---|
| `ACCEPTED` / `ARRIVED` | `driverLocation` → `pickupCoords` | Driver heading to pickup |
| `IN_PROGRESS` | `pickupCoords` → `dropoffCoords` | Trip in progress |
| `IDLE` / `PROPOSAL` / `COMPLETED_SUCCESS` | `[]` (clear) | No active trip |

The effect depends on `[tripState, currentTrip, driverLocation]` and uses a `cancelled` flag for cleanup.

**D. JSX reference** at line 502 already passes `routeCoordinates={routeCoordinates}` to `<DriverMap>` — now resolves to the state variable.

### 2.3 Pickup/Dropoff Coordinates

Verified from backend [`DriverCurrentRideResponse`](Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/dto/response/DriverCurrentRideResponse.java):

- `pickupLocation.lat` / `pickupLocation.lng` → mapped to `currentTrip.pickupLatitude` / `pickupLongitude`
- `destinationLocation.lat` / `destinationLocation.lng` → mapped to `currentTrip.dropoffLatitude` / `dropoffLongitude`

The [`DriverMap.tsx`](cab_booking_mobile_driver/components/DriverMap.tsx) component already renders pickup/dropoff `<Marker>` components from `currentTrip` props (lines 51-66). The `<Polyline>` only renders when `routeCoordinates.length > 0` (line 70).

---

## 3. Files Modified

| # | File | Change |
|---|---|---|
| 1 | [`cab_booking_mobile_driver/hooks/useDriverLocation.tsx`](cab_booking_mobile_driver/hooks/useDriverLocation.tsx) | Stale GPS fix: useRef + dependency array cleanup |
| 2 | [`cab_booking_mobile_driver/services/api.ts`](cab_booking_mobile_driver/services/api.ts) | Tunnel-aware RIDE_SOCKET_URL + EXPO_PUBLIC_RIDE_SOCKET_URL |
| 3 | [`cab_booking_mobile_driver/hooks/useDriverRideSocket.tsx`](cab_booking_mobile_driver/hooks/useDriverRideSocket.tsx) | Added `[DriverRideSocket] URL =` debug log |
| 4 | [`cab_booking_mobile/hooks/useRideSocket.tsx`](cab_booking_mobile/hooks/useRideSocket.tsx) | Added `[RideSocket] URL =` debug log |
| 5 | [`cab_booking_mobile_driver/.env`](cab_booking_mobile_driver/.env) | EXPO_PUBLIC_RIDE_SOCKET_URL documentation |
| 6 | [`cab_booking_mobile/.env`](cab_booking_mobile/.env) | EXPO_PUBLIC_RIDE_SOCKET_URL documentation |
| 7 | [`cab_booking_mobile/services/api.ts`](cab_booking_mobile/services/api.ts) | EXPO_PUBLIC_RIDE_SOCKET_URL support |
| 8 | [`cab_booking_mobile_driver/app/(driver-tabs)/index.tsx`](cab_booking_mobile_driver/app/(driver-tabs)/index.tsx) | Mapbox Directions fetchRoute + route state + useEffect |

---

## 4. Test Checklist

### WebSocket
- [ ] Start ride-service on port 9095
- [ ] Driver app connects to ride socket (check `[DriverRideSocket] URL =` log)
- [ ] Customer app connects to ride socket (check `[RideSocket] URL =` log)
- [ ] No `connect_error: websocket error` in Metro logs
- [ ] Driver GPS updates received by customer during ride (check `driver.location.updated` events)
- [ ] If using ngrok: separate tunnel for port 9095, set `EXPO_PUBLIC_RIDE_SOCKET_URL` in both `.env` files

### Route Display
- [ ] Driver goes ONLINE → no polyline visible (IDLE state)
- [ ] Ride assigned (ACCEPTED) → polyline from driver location to pickup point
- [ ] Driver arrives, starts trip (IN_PROGRESS) → polyline from pickup to dropoff
- [ ] Trip completed → polyline cleared
- [ ] Check `[Route] fetched X points from Mapbox Directions` log for successful API calls
- [ ] Check `[Route] No MAPBOX_TOKEN` log if token missing (polyline will be empty)
- [ ] Pickup marker (green) and dropoff marker (red) render correctly on map

### GPS Heartbeat
- [ ] Driver moves → `[GPS] watch update` log shows new coordinates every 3s
- [ ] Heartbeat sends updated coordinates (check `[useDriverLocation] heartbeat using latest GPS` log)
- [ ] Coordinates change in heartbeat payload as driver moves

---

## 5. Environment Variables Required

| Variable | App | Required | Description |
|---|---|---|---|
| `EXPO_PUBLIC_IP_ADDRESS` | Both | Yes | API Gateway URL (LAN IP or ngrok URL) |
| `EXPO_PUBLIC_GATEWAY_PORT` | Both | Yes | Gateway port (8080) |
| `EXPO_PUBLIC_MAPBOX_API_KEY` | Driver | Yes | Mapbox API key for Directions + MapView |
| `EXPO_PUBLIC_RIDE_SOCKET_URL` | Both | Conditional | Required when using ngrok (separate tunnel for port 9095) |

**No backend files were modified.** All fixes are in the mobile apps.
