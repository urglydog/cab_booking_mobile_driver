import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface DriverMapProps {
  currentTrip: any;
  tripState: string;
  routeCoordinates: { latitude: number; longitude: number }[];
  driverLocation: { latitude: number; longitude: number } | null;
  isOnline?: boolean;
}

export default function DriverMap({ currentTrip, tripState, driverLocation, isOnline = false }: DriverMapProps) {
  return (
    <View style={styles.webMapContainer}>
      <svg style={styles.svgBackground} viewBox="0 0 800 600" width="100%" height="100%">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#F1F5F9" />
        <rect width="100%" height="100%" fill="url(#grid)" />

        <path d="M100 100 L 700 100" stroke="#E2E8F0" strokeWidth="20" strokeLinecap="round" />
        <path d="M100 100 L 100 500" stroke="#E2E8F0" strokeWidth="20" strokeLinecap="round" />
        <path d="M100 500 L 700 500" stroke="#E2E8F0" strokeWidth="20" strokeLinecap="round" />
        <path d="M400 100 L 400 500" stroke="#E2E8F0" strokeWidth="16" strokeLinecap="round" />

        <text x="120" y="90" fill="#94A3B8" fontSize="12" fontWeight="700">DUONG NGUYEN KIEM</text>
        <text x="420" y="300" fill="#94A3B8" fontSize="12" fontWeight="700">DAI LO NAM KY KHOI NGHIA</text>

        {currentTrip && tripState !== 'IDLE' && (
          <path
            d="M 250 150 C 350 150, 350 450, 550 450"
            fill="none"
            stroke="#6366F1"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="10 6"
          />
        )}

        {isOnline && (
          <g>
            <circle cx="280" cy="180" r="10" fill="#6366F1" opacity="0.4">
              <animate attributeName="r" values="10;90" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="280" cy="180" r="10" fill="#6366F1" opacity="0.4">
              <animate attributeName="r" values="10;90" dur="2.5s" begin="1.25s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0" dur="2.5s" begin="1.25s" repeatCount="indefinite" />
            </circle>
            <circle cx="280" cy="180" r="90" fill="none" stroke="#6366F1" strokeWidth="1.5" opacity="0.2" strokeDasharray="4 4" />
            <circle cx="280" cy="180" r="60" fill="none" stroke="#6366F1" strokeWidth="1" opacity="0.15" />
            <circle cx="280" cy="180" r="30" fill="none" stroke="#6366F1" strokeWidth="1" opacity="0.1" />
            <g transform="translate(280, 180)">
              <line x1="0" y1="0" x2="0" y2="-90" stroke="#6366F1" strokeWidth="2.5" opacity="0.75" />
              <polygon points="0,0 -20,-87 0,-90" fill="#6366F1" opacity="0.15" />
              <polygon points="0,0 -40,-80 -20,-87" fill="#6366F1" opacity="0.08" />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="3s"
                repeatCount="indefinite"
              />
            </g>
          </g>
        )}

        <circle cx="280" cy="180" r="12" fill="#6366F1" opacity="0.4" />
        <circle cx="280" cy="180" r="6" fill="#6366F1" />
      </svg>

      <View style={styles.floatingWebPanel}>
        <Text style={styles.webMapBadgeTitle}>CAB MAP ENGINE (WEB SIMULATOR)</Text>
        <Text style={styles.webMapBadgeDesc}>Ban do mo phong tu dong dong bo hoa tren Web</Text>
        {driverLocation && (
          <Text style={styles.webMapCoords}>
            GPS: {driverLocation.latitude.toFixed(5)}, {driverLocation.longitude.toFixed(5)}
          </Text>
        )}
      </View>

      {currentTrip && tripState !== 'IDLE' && (
        <View style={styles.locationsPanel}>
          <View style={styles.locationBadgeRow}>
            <View style={[styles.dotMarker, { backgroundColor: '#10B981' }]} />
            <Text style={styles.locationBadgeText} numberOfLines={1}>
              <Text style={{ fontWeight: '800' }}>DON: </Text>{currentTrip.pickupLocation}
            </Text>
          </View>
          <View style={[styles.locationBadgeRow, { marginTop: 8 }]}>
            <View style={[styles.dotMarker, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.locationBadgeText} numberOfLines={1}>
              <Text style={{ fontWeight: '800' }}>DEN: </Text>{currentTrip.dropoffLocation}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webMapContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
  },
  svgBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingWebPanel: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#FFFFFFEA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  webMapBadgeTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.5,
  },
  webMapBadgeDesc: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  webMapCoords: {
    fontSize: 9,
    color: '#6366F1',
    fontWeight: '700',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  locationsPanel: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFFEA',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  locationBadgeText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
});
