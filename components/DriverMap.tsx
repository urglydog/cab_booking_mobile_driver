import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

interface DriverMapProps {
  currentTrip: any;
  tripState: string;
  routeCoordinates: Array<{ latitude: number; longitude: number }>;
  driverLocation: { latitude: number; longitude: number } | null;
}

// Fallback center: Ho Chi Minh City center (used only when no GPS yet)
const DEFAULT_CENTER = { latitude: 10.8231, longitude: 106.6297 };
const DEFAULT_DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };

export default function DriverMap({ currentTrip, tripState, routeCoordinates, driverLocation }: DriverMapProps) {
  // Use real GPS for initialRegion; fallback to default when no GPS available
  const region = driverLocation
    ? { ...driverLocation, ...DEFAULT_DELTA }
    : { ...DEFAULT_CENTER, ...DEFAULT_DELTA };

  // Pickup coordinates from currentTrip (mapped from backend DriverCurrentRideResponse.pickupLocation)
  const pickupCoords = currentTrip?.pickupLatitude != null && currentTrip?.pickupLongitude != null
    ? { latitude: Number(currentTrip.pickupLatitude), longitude: Number(currentTrip.pickupLongitude) }
    : null;

  // Dropoff coordinates from currentTrip (mapped from backend DriverCurrentRideResponse.destinationLocation)
  const dropoffCoords = currentTrip?.dropoffLatitude != null && currentTrip?.dropoffLongitude != null
    ? { latitude: Number(currentTrip.dropoffLatitude), longitude: Number(currentTrip.dropoffLongitude) }
    : null;

  return (
    <MapView
      style={styles.map}
      initialRegion={region}
      showsUserLocation={false}
    >
      {/* Driver Real GPS Marker — only render when we have real coordinates */}
      {driverLocation && (
        <Marker
          coordinate={driverLocation}
          title="Vị trí của bạn"
          description="Bạn đang trực tuyến nhận khách"
          pinColor="#6366F1"
        />
      )}

      {/* Render Trip locations if proposed or in progress */}
      {currentTrip && tripState !== 'IDLE' && (
        <>
          {pickupCoords && (
            <Marker
              coordinate={pickupCoords}
              title="Điểm đón khách"
              description={currentTrip.pickupLocation}
              pinColor="#10B981"
            />
          )}
          {dropoffCoords && (
            <Marker
              coordinate={dropoffCoords}
              title="Điểm trả khách"
              description={currentTrip.dropoffLocation}
              pinColor="#EF4444"
            />
          )}

          {/* Real-time street route polyline for the driver */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#6366F1"
              strokeWidth={4}
            />
          )}
        </>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
});
