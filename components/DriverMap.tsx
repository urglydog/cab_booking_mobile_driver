import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

interface DriverMapProps {
  currentTrip: any;
  tripState: string;
  routeCoordinates: { latitude: number; longitude: number }[];
  driverLocation: { latitude: number; longitude: number } | null;
  isOnline?: boolean;
}

const DEFAULT_CENTER = { latitude: 10.8231, longitude: 106.6297 };
const DEFAULT_DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };

export default function DriverMap({
  currentTrip,
  tripState,
  routeCoordinates,
  driverLocation,
  isOnline = false,
}: DriverMapProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isOnline || !driverLocation) {
      pulse.stopAnimation();
      sweep.stopAnimation();
      pulse.setValue(0);
      sweep.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      })
    );
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    pulseLoop.start();
    sweepLoop.start();

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
    };
  }, [driverLocation, isOnline, pulse, sweep]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.6] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const sweepRotation = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const region = driverLocation
    ? { ...driverLocation, ...DEFAULT_DELTA }
    : { ...DEFAULT_CENTER, ...DEFAULT_DELTA };

  const pickupCoords = currentTrip?.pickupLatitude != null && currentTrip?.pickupLongitude != null
    ? { latitude: Number(currentTrip.pickupLatitude), longitude: Number(currentTrip.pickupLongitude) }
    : null;

  const dropoffCoords = currentTrip?.dropoffLatitude != null && currentTrip?.dropoffLongitude != null
    ? { latitude: Number(currentTrip.dropoffLatitude), longitude: Number(currentTrip.dropoffLongitude) }
    : null;

  return (
    <MapView
      style={styles.map}
      initialRegion={region}
      showsUserLocation={false}
    >
      {driverLocation && (
        <Marker
          coordinate={driverLocation}
          title="Vị trí của bạn"
          description="Bạn đang trực tuyến nhận khách"
          tracksViewChanges={true}
        >
          <View style={styles.driverMarkerWrap}>
            {isOnline && (
              <>
                <Animated.View
                  style={[
                    styles.radarPulse,
                    { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                  ]}
                />
                <Animated.View style={[styles.radarSweep, { transform: [{ rotate: sweepRotation }] }]}>
                  <View style={styles.radarSweepArm} />
                </Animated.View>
              </>
            )}
            <View style={styles.driverDotOuter}>
              <View style={styles.driverDotInner} />
            </View>
          </View>
        </Marker>
      )}

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
  driverMarkerWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  radarPulse: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#6366F1',
  },
  radarSweep: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
  },
  radarSweepArm: {
    width: 2,
    height: 32,
    backgroundColor: 'rgba(99,102,241,0.55)',
    borderRadius: 1,
  },
  driverDotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#6366F1',
  },
  driverDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366F1',
  },
});
