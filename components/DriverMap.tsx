import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

interface DriverMapProps {
  currentTrip: any;
  tripState: string;
  routeCoordinates: Array<{ latitude: number; longitude: number }>;
}

export default function DriverMap({ currentTrip, tripState, routeCoordinates }: DriverMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: 10.822,
        longitude: 106.687,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }}
    >
      {/* Driver Active GPS Marker */}
      <Marker
        coordinate={{ latitude: 10.8225, longitude: 106.6872 }}
        title="Vị trí của bạn"
        description="Bạn đang trực tuyến nhận khách"
        pinColor="#6366F1"
      />

      {/* Render Trip locations if proposed or in progress */}
      {currentTrip && tripState !== 'IDLE' && (
        <>
          <Marker
            coordinate={{ latitude: 10.822, longitude: 106.687 }}
            title="Điểm đón khách"
            description={currentTrip.pickupLocation}
            pinColor="#10B981"
          />
          <Marker
            coordinate={{ latitude: 10.779, longitude: 106.699 }}
            title="Điểm trả khách"
            description={currentTrip.dropoffLocation}
            pinColor="#EF4444"
          />
          
          {/* Real-time street route polyline for the driver */}
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#6366F1"
            strokeWidth={4}
          />
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
