# DEBUG REPORT: Driver Location Sync Before Ride

## Bug Summary

| Symptom | HTTP | Endpoint | Root Cause |
|---------|------|----------|------------|
| Cannot go ONLINE | **403** | `PATCH /api/drivers/me/availability` | `verificationStatus = PENDING` (default). Backend blocks ONLINE with `ACCOUNT_DISABLED`. |
| Heartbeat fails | **400** | `PATCH /api/drivers/me/location` | Frontend catch block sets `isOnline=true` locally on 403 rejection → heartbeat fires → backend rejects because `availabilityStatus ≠ ONLINE` in DB. |

---

## 1. Backend Contract (Verified from Source)

### `PATCH /api/drivers/me/availability`

**Controller**: [`DriverProfileController.java`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/controller/DriverProfileController.java:55)

**DTO**: [`UpdateDriverAvailabilityRequest.java`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/dto/request/UpdateDriverAvailabilityRequest.java)
```java
@NotNull String availabilityStatus;          // "ONLINE" | "OFFLINE"
@DecimalMin("-90") @DecimalMax("90") BigDecimal currentLatitude;
@DecimalMin("-180") @DecimalMax("180") BigDecimal currentLongitude;
```

**Service**: [`DriverProfileService.updateAvailability()`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/service/DriverProfileService.java:79)
```java
// Line 83-86: BLOCKS if not APPROVED
if (availabilityStatus == DriverAvailabilityStatus.ONLINE
        && profile.getVerificationStatus() != DriverVerificationStatus.APPROVED) {
    throw new AppException(ErrorCode.ACCOUNT_DISABLED);  // → 403
}
```

**Verification Status**: [`DriverVerificationStatus.java`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/entity/DriverVerificationStatus.java) — `PENDING` (default), `APPROVED`, `REJECTED`

### `PATCH /api/drivers/me/location`

**DTO**: [`UpdateDriverLocationRequest.java`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/dto/request/UpdateDriverLocationRequest.java)
```java
@NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal lat;
@NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal lng;
```

**Service**: [`DriverProfileService.updateLocation()`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/service/DriverProfileService.java:115)
```java
// Line 120-121: BLOCKS if driver not ONLINE in backend DB
if (profile.getAvailabilityStatus() != DriverAvailabilityStatus.ONLINE) {
    throw new AppException(ErrorCode.VALIDATION_ERROR);  // → 400
}
```

---

## 2. Root Cause Analysis

### Cause 1: 403 on Availability

```
Driver registers → profile auto-created with verificationStatus=PENDING
                → driver toggles ONLINE
                → backend checks verificationStatus != APPROVED
                → throws ACCOUNT_DISABLED (403)
```

**Default**: [`DriverProfile.java:64`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/entity/DriverProfile.java:64) — `DriverVerificationStatus.PENDING`

**Auto-creation**: [`getOrCreateProfileEntity()`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/driver-service/src/main/java/iuh/fit/driverservice/service/DriverProfileService.java:204) — creates with default PENDING

### Cause 2: 400 on Heartbeat (Cascading Bug)

```
toggleOnline(true) → PATCH /availability → 403
                  → catch block runs setIsOnline(true)  ← BUG
                  → useDriverLocation sees isOnline=true
                  → heartbeat interval starts
                  → PATCH /location → 400 (backend status still OFFLINE/PENDING)
```

**Bug location**: [`index.tsx:207`](cab_booking_mobile_driver/app/(driver-tabs)/index.tsx) — `setIsOnline(value)` in catch block

### Cause 3: Security Config (Not the issue)

[`SecurityConfig.java`](../Nhom13_KTTKPM_DHKTPM18A/cab_booking/common/src/main/java/iuh/fit/common/config/SecurityConfig.java) uses `anyRequest().authenticated()` — no ROLE_DRIVER check. The 403 comes from business logic (`ACCOUNT_DISABLED`), not Spring Security.

---

## 3. Exact Fixes Applied

### Fix 1: Verification guard before going ONLINE

**File**: [`index.tsx`](cab_booking_mobile_driver/app/(driver-tabs)/index.tsx)

Added check at top of `toggleOnline`:
```typescript
if (verificationStatus !== 'APPROVED') {
  Alert.alert('Tài khoản chưa được duyệt', ...);
  return;  // Do NOT call backend
}
```

Also added `verificationStatus` state + capture from profile API response.

### Fix 2: Remove `setIsOnline(value)` from catch block

**File**: [`index.tsx`](cab_booking_mobile_driver/app/(driver-tabs)/index.tsx)

**Before** (broken):
```typescript
catch (error: any) {
  console.log('Failed to sync...');
  setIsOnline(value);  // ← sets isOnline=true on 403!
}
```

**After** (fixed):
```typescript
catch (error: any) {
  if (status === 403) {
    Alert.alert('Không thể bật Online', `Server 403: ${serverMsg}`);
  } else if (value) {
    Alert.alert('Lỗi kết nối', ...);
  } else {
    // Going OFFLINE failed — still set local OFFLINE for safety
    setIsOnline(false);
    setTripState('IDLE');
  }
  // NO setIsOnline(true) on server rejection
}
```

### Fix 3: Debug logs added

**File**: [`index.tsx`](cab_booking_mobile_driver/app/(driver-tabs)/index.tsx) — `toggleOnline`
- `[DEBUG] PATCH /api/drivers/me/availability → {body}`
- `[DEBUG] availability response status: N data: {...}`
- `[DEBUG] availability FAILED — status: N message: ...`

**File**: [`useDriverLocation.tsx`](cab_booking_mobile_driver/hooks/useDriverLocation.tsx) — heartbeat
- `[DEBUG] PATCH /api/drivers/me/location → {lat, lng}`
- `[DEBUG] heartbeat response status: N`
- `[DEBUG] heartbeat FAILED — status: N message: ...`

---

## 4. Files Changed

| File | Changes |
|------|---------|
| [`index.tsx`](cab_booking_mobile_driver/app/(driver-tabs)/index.tsx) | Added `verificationStatus` state, capture from profile API, verification guard in `toggleOnline`, debug logs, fixed catch block |
| [`useDriverLocation.tsx`](cab_booking_mobile_driver/hooks/useDriverLocation.tsx) | Added debug logs to heartbeat (request body, response status, error details) |

---

## 5. Test Checklist

### Pre-condition: Driver with `verificationStatus = PENDING`

- [ ] **Test 1**: Toggle ONLINE → should show "Tài khoản chưa được duyệt" alert. **No API call made.** `isOnline` stays `false`. No heartbeat starts.
- [ ] **Test 2**: Console shows `[DEBUG] Driver verification status: PENDING` on app load.
- [ ] **Test 3**: No `[DEBUG] PATCH /api/drivers/me/location` logs appear when offline.

### Pre-condition: Driver with `verificationStatus = APPROVED`

- [ ] **Test 4**: Toggle ONLINE → `PATCH /availability` called with `{ONLINE, lat, lng}` → 200 → `isOnline=true` → heartbeat starts.
- [ ] **Test 5**: Console shows `[DEBUG] PATCH /api/drivers/me/availability → {...}` and `[DEBUG] availability response status: 200`.
- [ ] **Test 6**: Heartbeat fires every 30s → `[DEBUG] PATCH /api/drivers/me/location → {lat, lng}` → 200.
- [ ] **Test 7**: Toggle OFFLINE → `PATCH /availability` called with `{OFFLINE, ...}` → `isOnline=false` → heartbeat stops.

### Edge cases

- [ ] **Test 8**: GPS permission denied → alert shown, no API call, stays offline.
- [ ] **Test 9**: Network error during ONLINE toggle → alert shown, `isOnline` stays `false`, no heartbeat.
- [ ] **Test 10**: Backend returns 500 during ONLINE → alert shown, `isOnline` stays `false`.
- [ ] **Test 11**: Going OFFLINE when server is down → `isOnline` set to `false` locally (safe fallback).

---

## 6. How to Approve a Driver (Admin)

To make a driver able to go ONLINE, an admin must set `verificationStatus = APPROVED` in the database:

```sql
UPDATE driver_profiles SET verification_status = 'APPROVED' WHERE external_user_id = '<driver-auth-id>';
```

Or via admin API if one exists. The frontend now reads this status from `GET /api/drivers/me/profile` → `result.verificationStatus`.
