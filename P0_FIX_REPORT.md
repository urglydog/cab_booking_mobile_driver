# P0 Fix Report — Driver App Synchronization

**Date:** 2026-05-25  
**Scope:** P0-01 (Driver Lifecycle Endpoints) + P0-02 (Driver GPS Streaming)  
**Status:** ✅ Implemented

---

## Files Changed

| # | File | Action | Lines Changed |
|---|------|--------|---------------|
| 1 | [`services/api.ts`](services/api.ts) | Modified | +1 line (added `RIDE_SOCKET_URL` export) |
| 2 | [`hooks/useDriverRideSocket.tsx`](hooks/useDriverRideSocket.tsx) | **Created** | ~200 lines (new driver-side ride socket + GPS streaming hook) |
| 3 | [`app/(driver-tabs)/index.tsx`](app/(driver-tabs)/index.tsx) | Modified | +58 lines net (lifecycle endpoint fixes + GPS hook integration) |
| 4 | `package.json` | Modified | +1 dependency (`expo-location`) |

---

## P0-01: Driver Lifecycle Endpoint Fix

### Problem
Driver app called **driver-service local endpoints** (`PATCH /api/drivers/me/rides/current`) for arrive/start/complete. These only update `DriverProfile` Redis state — they **never trigger Kafka events** (`ride.arrived`, `ride.started`, `ride.completed`), breaking the entire downstream flow (notification-service, booking-service, ride-service state machine).

### Fix
Replaced with **ride-service lifecycle endpoints** as PRIMARY action, keeping driver-service calls as SECONDARY for `DriverProfile` state consistency.

### Exact Diffs

#### [`handleArriveAtPickup`](app/(driver-tabs)/index.tsx:222) — line 222
```diff
- // BEFORE: Only driver-service local state
- await api.patch('/api/drivers/me/rides/current', {
-   rideStatus: 'EN_ROUTE_PICKUP',
-   currentLatitude: 10.822,
-   currentLongitude: 106.687
- });

+ // AFTER: PRIMARY — ride-service (triggers Kafka ride.arrived)
+ await api.post(`/api/v1/rides/${currentTrip.id}/arrive`);
+ // SECONDARY — driver-service local state (non-critical)
+ await api.patch('/api/drivers/me/rides/current', {
+   rideStatus: 'EN_ROUTE_PICKUP',
+   currentLatitude: 10.822,
+   currentLongitude: 106.687
+ });
```

#### [`handleStartTrip`](app/(driver-tabs)/index.tsx:252) — line 252
```diff
- // BEFORE: Only driver-service local state
- await api.patch('/api/drivers/me/rides/current', {
-   rideStatus: 'IN_PROGRESS',
-   currentLatitude: 10.822,
-   currentLongitude: 106.687
- });

+ // AFTER: PRIMARY — ride-service (triggers Kafka ride.started)
+ await api.post(`/api/v1/rides/${currentTrip.id}/start`);
+ // SECONDARY — driver-service local state (non-critical)
+ await api.patch('/api/drivers/me/rides/current', {
+   rideStatus: 'IN_PROGRESS',
+   currentLatitude: 10.822,
+   currentLongitude: 106.687
+ });
```

#### [`handleCompleteTrip`](app/(driver-tabs)/index.tsx:281) — line 281
```diff
- // BEFORE: Only driver-service local state
- await api.post('/api/drivers/me/rides/current/complete', {
-   fareAmount: currentTrip.estimatedFare,
-   distanceKm: distanceVal
- });

+ // AFTER: PRIMARY — ride-service (triggers Kafka ride.completed)
+ await api.post(`/api/v1/rides/${currentTrip.id}/complete`, {
+   finalFare: currentTrip.estimatedFare,
+   paymentMethod: currentTrip.paymentMethod || 'CASH',
+ });
+ // SECONDARY — driver-service local state (non-critical)
+ await api.post('/api/drivers/me/rides/current/complete', {
+   fareAmount: currentTrip.estimatedFare,
+   distanceKm: distanceVal
+ });
```

### Backend Endpoints Called
| Action | Endpoint | HTTP | Body | Response |
|--------|----------|------|------|----------|
| Arrive at pickup | `/api/v1/rides/{rideId}/arrive` | POST | None | `ApiResponse<RideResponse>` |
| Start ride | `/api/v1/rides/{rideId}/start` | POST | None | `ApiResponse<RideResponse>` |
| Complete ride | `/api/v1/rides/{rideId}/complete` | POST | `{ finalFare?, paymentMethod? }` | `ApiResponse<RideResponse>` |

**Source of truth:** [`RideLifecycleController.java`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/ride-service/src/main/java/com/cab/ride/core/controller/RideLifecycleController.java)

### Kafka Events Now Triggered
- `POST /arrive` → `ride.arrived` → notification-service sends push to customer
- `POST /start` → `ride.started` → notification-service sends push to customer
- `POST /complete` → `ride.completed` → notification-service + booking-service status sync

### CompleteRideRequest DTO
```java
// CompleteRideRequest.java
public class CompleteRideRequest {
    private BigDecimal finalFare;
    private String paymentMethod;
}
```

---

## P0-02: Driver GPS Streaming Fix

### Problem
Driver app had **no ride socket connection** and **no GPS streaming**. The customer app's `useRideSocket` hook listens for `driver.location.updated` events on port 9095, but the driver never emitted any GPS data, making real-time driver tracking completely non-functional.

### Fix
1. **Installed `expo-location`** — native GPS access for real coordinates
2. **Created [`useDriverRideSocket.tsx`](hooks/useDriverRideSocket.tsx)** — driver-side ride socket hook
3. **Integrated into [`index.tsx`](app/(driver-tabs)/index.tsx:33)** — activates GPS during active rides

### New File: [`hooks/useDriverRideSocket.tsx`](hooks/useDriverRideSocket.tsx)

**Architecture:**
```
Driver App                          Ride Service (port 9095)
    │                                      │
    ├─ io(RIDE_SOCKET_URL, auth: JWT) ────►│ authenticate(JWT)
    ├─ emit("join_ride", {rideId}) ───────►│ joinRoom("ride:{rideId}")
    │                                      │
    ├─ [expo-location watchPositionAsync]  │
    │   every 3s:                          │
    ├─ emit("driver.location.update") ────►│ validate(ride, driver)
    │   { rideId, lat, lng, heading, speed}│ → updateRedis()
    │                                      │ → publishKafka()
    │                                      │ → broadcastToRoom("driver.location.updated")
    │                                      │        │
    │                                      │        ▼
    │                                      │   Customer App receives
    │                                      │   "driver.location.updated"
    ├─ emit("leave_ride", {rideId}) ──────►│ leaveRoom()
    └─ disconnect ────────────────────────►│
```

**Socket Contract (from backend):**
- **URL:** `http://{IP}:9095` (separate from notification socket on 9093)
- **Auth:** `{ token: "Bearer <jwt>" }` — JWT extracted server-side, driverId from subject
- **Join:** `emit("join_ride", { rideId })` — server validates driver is assigned to ride
- **GPS emit:** `emit("driver.location.update", { rideId, lat, lng, heading?, speed? })`
- **Valid GPS statuses:** `ACCEPTED`, `PICKUP`, `IN_PROGRESS` (per [`RideLocationService`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/ride-service/src/main/java/com/cab/ride/core/service/RideLocationService.java:44))
- **Leave:** `emit("leave_ride", { rideId })`

**GPS Update Strategy:**
- Uses `Location.watchPositionAsync` with `Accuracy.High`
- Time interval: 2s, Distance interval: 5m
- Throttled socket emission: every 3s (avoids flooding backend)
- Payload: `{ rideId, lat, lng, heading?, speed? }` — matches [`RideLocationSocketRequest`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/ride-service/src/main/java/com/cab/ride/core/dto/socket/request/RideLocationSocketRequest.java)

### Integration in [`index.tsx`](app/(driver-tabs)/index.tsx:33)
```typescript
// P0-02: GPS streaming via ride socket (port 9095) during active rides
const isGpsActive = tripState === 'ACCEPTED' || tripState === 'ARRIVED' || tripState === 'IN_PROGRESS';
useDriverRideSocket({
  rideId: isGpsActive && currentTrip?.id ? currentTrip.id : null,
  isActive: isGpsActive && !!currentTrip?.id,
});
```

GPS streaming activates when:
- `tripState === 'ACCEPTED'` — driver accepted the ride
- `tripState === 'ARRIVED'` — driver arrived at pickup
- `tripState === 'IN_PROGRESS'` — ride is in progress

GPS streaming deactivates when:
- `tripState === 'IDLE'` — no active ride
- `tripState === 'COMPLETED_SUCCESS'` — ride completed
- `tripState === 'PROPOSAL'` — driver hasn't accepted yet

### New Dependency
```json
"expo-location": "~18.0.7"  // SDK 54 compatible
```

---

## Pre-existing TS Errors (NOT introduced by P0 fixes)

| File | Line | Error | Cause |
|------|------|-------|-------|
| `app/(driver-tabs)/index.tsx` | 820 | `fontWeight: '650'` | Invalid fontWeight value in styles (pre-existing) |
| `app/(driver-tabs)/index.tsx` | 1013 | `fontWeight: '850'` | Invalid fontWeight value in styles (pre-existing) |
| `app/(driver-tabs)/account.tsx` | 162 | Duplicate JSX attribute | Pre-existing |
| `app/(notification)/modal.tsx` | 65,76,91 | Type inference issues | Pre-existing |

**Zero new TS errors introduced by P0 fixes.**

---

## Manual Test Checklist

### Prerequisites
- Backend services running: api-gateway (8080), ride-service (8085/9095), driver-service (8084), notification-service (9093), booking-service
- Kafka + Redis running
- At least one driver account with ROLE_DRIVER
- At least one customer account

### P0-01: Lifecycle Endpoint Tests

#### Test 1: Arrive at Pickup
| Step | Action | Expected |
|------|--------|----------|
| 1 | Driver logs in, goes online | `PATCH /api/drivers/me/availability` → 200 |
| 2 | Customer books a ride | Backend matches driver, `ride.assigned` Kafka event |
| 3 | Driver sees PROPOSAL card with 15s countdown | Polling `GET /api/drivers/me/current-ride` returns ASSIGNED ride |
| 4 | Driver taps "NHẬN CUỐC XE" | `POST /api/drivers/me/rides/assignment` → 200 |
| 5 | Driver sees ACCEPTED card | Trip state → ACCEPTED |
| 6 | Driver taps "XÁC NHẬN ĐÃ ĐẾN ĐIỂM ĐÓN" | **`POST /api/v1/rides/{rideId}/arrive`** → 200 |
| 7 | **Verify Kafka:** `ride.arrived` event published | Check notification-service logs: customer receives "Driver arrived" push |
| 8 | **Verify ride-service:** Ride status → `PICKUP` | `GET /api/v1/rides/{rideId}` returns status=PICKUP |
| 9 | Driver sees ARRIVED card | Trip state → ARRIVED |

#### Test 2: Start Trip
| Step | Action | Expected |
|------|--------|----------|
| 1 | (From Test 1 step 9) Driver taps "BẮT ĐẦU CHUYẾN XE" | **`POST /api/v1/rides/{rideId}/start`** → 200 |
| 2 | **Verify Kafka:** `ride.started` event published | Check notification-service logs: customer receives "Ride started" push |
| 3 | **Verify ride-service:** Ride status → `IN_PROGRESS` | `GET /api/v1/rides/{rideId}` returns status=IN_PROGRESS |
| 4 | Driver sees IN_PROGRESS card | Trip state → IN_PROGRESS |

#### Test 3: Complete Trip
| Step | Action | Expected |
|------|--------|----------|
| 1 | (From Test 2 step 4) Driver taps "HOÀN THÀNH CHUYẾN ĐI" | **`POST /api/v1/rides/{rideId}/complete`** → 200 with `{ finalFare, paymentMethod }` |
| 2 | **Verify Kafka:** `ride.completed` event published | Check notification-service logs: customer receives "Ride completed" push |
| 3 | **Verify booking-service:** Booking status → `COMPLETED` | Customer app matching screen transitions to completed |
| 4 | **Verify ride-service:** Ride status → `COMPLETED` | `GET /api/v1/rides/{rideId}` returns status=COMPLETED |
| 5 | Driver sees COMPLETED_SUCCESS card | Trip state → COMPLETED_SUCCESS |

#### Test 4: Fallback Behavior
| Step | Action | Expected |
|------|--------|----------|
| 1 | Simulate ride-service down (stop ride-service) | Driver taps arrive/start/complete |
| 2 | Primary call fails | Console logs "Ride-service arrive/start/complete failed" |
| 3 | Fallback to driver-service | `PATCH /api/drivers/me/rides/current` still executes |
| 4 | UI state updates normally | `setTripState()` still called — app doesn't break |

### P0-02: GPS Streaming Tests

#### Test 5: GPS Socket Connection
| Step | Action | Expected |
|------|--------|----------|
| 1 | Driver accepts a ride (tripState → ACCEPTED) | `useDriverRideSocket` activates with `rideId` |
| 2 | Check console logs | `[DriverRideSocket] connected to ride socket` |
| 3 | Check console logs | `[DriverRideSocket] joined ride room {rideId}` |
| 4 | Check console logs | `[DriverRideSocket] GPS watcher started for ride {rideId}` |

#### Test 6: GPS Emission During Active Ride
| Step | Action | Expected |
|------|--------|----------|
| 1 | Driver is in ACCEPTED/ARRIVED/IN_PROGRESS state | GPS watcher running |
| 2 | Check ride-service logs | `driver.location.update` events received every ~3s |
| 3 | Check ride-service Redis | `ride:tracking:{rideId}` hash updated with lat/lng |
| 4 | Check ride-service logs | `driver.location.updated` broadcast to room `ride:{rideId}` |

#### Test 7: Customer Receives GPS Updates
| Step | Action | Expected |
|------|--------|----------|
| 1 | Customer is on matching screen with active ride | Customer's `useRideSocket` connected to port 9095 |
| 2 | Driver moves (GPS coordinates change) | Customer receives `driver.location.updated` events |
| 3 | Customer map updates | Driver marker moves on customer's map in real-time |

#### Test 8: GPS Stops After Ride Completes
| Step | Action | Expected |
|------|--------|----------|
| 1 | Driver completes ride (tripState → COMPLETED_SUCCESS) | `useDriverRideSocket` deactivates (`isActive: false`) |
| 2 | Check console logs | `[DriverRideSocket] disconnected` |
| 3 | GPS watcher stopped | No more `driver.location.update` emissions |
| 4 | Socket disconnected | No connection to port 9095 |

#### Test 9: Location Permission Denied
| Step | Action | Expected |
|------|--------|----------|
| 1 | Deny location permission on device | `useDriverRideSocket` logs warning |
| 2 | Socket still connects and joins room | `[DriverRideSocket] joined ride room` logged |
| 3 | No GPS emissions | No `driver.location.update` events sent |
| 4 | App continues working | No crash, ride lifecycle still works via P0-01 endpoints |

#### Test 10: Socket Reconnection
| Step | Action | Expected |
|------|--------|----------|
| 1 | Kill ride-service while driver has active ride | Socket disconnects |
| 2 | Restart ride-service within 60s | Socket reconnects automatically |
| 3 | Re-joins ride room | `[DriverRideSocket] joined ride room` logged again |
| 4 | GPS streaming resumes | `driver.location.update` events resume |

---

## What Was NOT Changed (Explicit Exclusions)

- ❌ UI redesign / layout changes
- ❌ Earnings screen changes
- ❌ Notification socket port fix (P1-01)
- ❌ Real-time assignment push (P1-02)
- ❌ Public driver profile endpoint (P1-03)
- ❌ Hardcoded GPS in `toggleOnline()` (P2-01)
- ❌ Countdown mismatch 15s vs 30s (P2-02)
- ❌ bookingId vs rideId naming (P2-03)
- ❌ Customer app changes
- ❌ Backend service changes

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Ride-service `POST /arrive` returns 401/403 | Medium | Fallback to driver-service local state keeps UI working |
| `expo-location` permission denied | Low | Socket still connects; GPS streaming disabled gracefully |
| Socket connection fails (port 9095 unreachable) | Medium | Max 5 reconnect attempts; app continues via polling |
| GPS battery drain | Low | 3s throttle interval is reasonable; stops when ride completes |
| Race condition: ride-service call succeeds but driver-service fails | Low | Driver-service is secondary; ride-service state is authoritative |
