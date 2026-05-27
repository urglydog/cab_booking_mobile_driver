import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, MapPin, Play, CheckCircle2, Navigation2, Check, X, Shield, Phone, MessageSquare } from 'lucide-react-native';
import DriverMap from '@/components/DriverMap';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useNavigation } from 'expo-router';
import { useSocket } from '@/hooks/useSocket';

const isRoomUpdateForRide = (payload: any, rideId?: string) => {
  if (!rideId) return true;
  const roomId = payload?.userId || payload?.bookingId || payload?.rideId || '';
  return roomId === rideId || roomId === `ROOM_${rideId}`;
};

const inferTripState = (payload: any) => {
  const rawStatus = String(payload?.status ?? payload?.rideStatus ?? payload?.type ?? payload?.eventType ?? '').toUpperCase();
  const title = String(payload?.title ?? '').toLowerCase();
  const message = String(payload?.message ?? '').toLowerCase();

  if (rawStatus === 'ASSIGNED' || title.includes('cuốc xe mới') || message.includes('nhận cuốc')) return 'PROPOSAL';
  if (rawStatus === 'ACCEPTED') return 'ACCEPTED';
  if (rawStatus === 'PICKUP' || rawStatus === 'ARRIVED' || rawStatus === 'EN_ROUTE_PICKUP' || title.includes('đến điểm đón') || message.includes('đã đến điểm đón')) return 'ARRIVED';
  if (rawStatus === 'IN_PROGRESS' || rawStatus === 'STARTED' || title.includes('bắt đầu') || message.includes('bắt đầu')) return 'IN_PROGRESS';
  if (rawStatus === 'COMPLETED' || rawStatus === 'FINISHED' || title.includes('hoàn thành') || message.includes('hoàn thành')) return 'COMPLETED_SUCCESS';
  if (rawStatus === 'CANCELLED') return 'IDLE';
  return undefined;
};

const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

// Pre-seeded high-fidelity route coordinates from Gò Vấp (IUH) to District 1 (Notre Dame Cathedral)
const routeCoordinates = [
  { latitude: 10.8220, longitude: 106.6870 }, // 1. 12 Nguyễn Văn Bảo (IUH Entrance)
  { latitude: 10.8210, longitude: 106.6830 }, // 2. Nguyễn Văn Bảo & Nguyễn Kiệm junction
  { latitude: 10.8140, longitude: 106.6780 }, // 3. Nguyễn Kiệm (Gia Định Park)
  { latitude: 10.8030, longitude: 106.6760 }, // 4. Phú Nhuận Intersection (Hoàng Văn Thụ)
  { latitude: 10.7930, longitude: 106.6810 }, // 5. Trần Huy Liệu & Nam Kỳ Khởi Nghĩa
  { latitude: 10.7900, longitude: 106.6840 }, // 6. Nam Kỳ Khởi Nghĩa (Cầu Công Lý bridge)
  { latitude: 10.7850, longitude: 106.6900 }, // 7. Nam Kỳ Khởi Nghĩa & Điện Biên Phủ
  { latitude: 10.7790, longitude: 106.6990 }  // 8. Nhà thờ Đức Bà, Quận 1 (Notre Dame Cathedral)
];

export default function DriverHomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { socket } = useSocket();
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [driverName, setDriverName] = useState('Tài xế');
  const [verificationStatus, setVerificationStatus] = useState<'PENDING' | 'APPROVED'>('PENDING');

  // Trip Simulation State Machine
  // States: 'IDLE' | 'PROPOSAL' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED_SUCCESS'
  const [tripState, setTripState] = useState<'IDLE' | 'PROPOSAL' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED_SUCCESS'>('IDLE');
  const [countdown, setCountdown] = useState(15);
  const [currentTrip, setCurrentTrip] = useState<any>(null);
  const [completingTrip, setCompletingTrip] = useState(false);

  useEffect(() => {
    const isActiveTrip = tripState === 'ACCEPTED' || tripState === 'ARRIVED' || tripState === 'IN_PROGRESS';
    try {
      if (isActiveTrip) {
        navigation.getParent()?.setOptions({
          tabBarStyle: { display: 'none' }
        });
      } else {
        navigation.getParent()?.setOptions({
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            height: 60,
            paddingBottom: 10,
            backgroundColor: '#FFF',
          }
        });
      }
    } catch (e) {
      console.log('Error modifying tab bar style:', e);
    }
  }, [tripState, navigation]);

  // Load Driver Name on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const name = await AsyncStorage.getItem('user_name');
        if (name) setDriverName(name);

        // Attempt to fetch profile from driver-service to check real profile
        const res = await api.get('/api/drivers/me/profile');
        if (res.data && res.data.result) {
          const profile = res.data.result;
          setDriverName(profile.fullName || name);
          if (profile.verificationStatus) {
            setVerificationStatus(profile.verificationStatus);
          }
        }
      } catch (err) {
        console.log('Driver profile load from API failed (using local fallback name)');
      }
    };
    loadProfile();
  }, []);


  // Real-time Ride Polling (Long Polling)
  useEffect(() => {
    let pollingInterval: any;

    const pollCurrentRide = async () => {
      if (!isOnline) return;
      try {
        const response = await api.get('/api/drivers/me/current-ride');
        if (response.data && response.data.result) {
          const ride = response.data.result;
          const activeRideId = String(ride.rideId ?? ride.bookingId ?? '').trim();

          if (!activeRideId) {
            if (tripState !== 'IDLE' && tripState !== 'COMPLETED_SUCCESS') {
              setTripState('IDLE');
              setCurrentTrip(null);
            }
            return;
          }

          // Map backend states to UI states
          // Backend states: PENDING_DRIVER | ASSIGNED | EN_ROUTE_PICKUP | IN_PROGRESS | COMPLETED / FINISHED
          const backendStatus = String(ride.rideStatus ?? '').toUpperCase();

          let distanceVal = 1.5;
          if (ride.pickupLocation?.lat && ride.pickupLocation?.lng && ride.destinationLocation?.lat && ride.destinationLocation?.lng) {
            const rawDist = calculateHaversineDistance(
              parseFloat(ride.pickupLocation.lat),
              parseFloat(ride.pickupLocation.lng),
              parseFloat(ride.destinationLocation.lat),
              parseFloat(ride.destinationLocation.lng)
            );
            distanceVal = rawDist * 1.25; // 25% adjustment for road curves
          }
          const durationVal = Math.max(3, Math.round(distanceVal * 2.5 + 1));

          let customerName = 'Khách hàng';
          let customerPhone = '0901234567';
          try {
            if (ride.customerId) {
              const uRes = await api.get(`/api/users/${ride.customerId}/profile`);
              if (uRes.data?.result) {
                customerName = uRes.data.result.fullName || customerName;
                customerPhone = uRes.data.result.phoneNumber || customerPhone;
              }
            }
          } catch (e) {
            console.log('Failed to fetch matched customer profile:', e);
          }

          const mappedTrip = {
            id: activeRideId,
            customerName: customerName,
            phone: customerPhone,
            pickupLocation: ride.pickupAddress || 'Điểm đón khách',
            dropoffLocation: ride.destinationAddress || 'Điểm trả khách',
            estimatedFare: ride.estimatedFare || ride.fareAmount || 35000,
            paymentMethod: ride.paymentMethod || 'CASH',
            vehicleType: ride.vehicleType || ride.vehicleTier || 'CAR4',
            distance: `${distanceVal.toFixed(1)} km`,
            time: `${durationVal} phút`,
          };

          setCurrentTrip(mappedTrip);

          if (backendStatus === 'ASSIGNED') {
            if (tripState !== 'PROPOSAL') {
              setCountdown(15);
              setTripState('PROPOSAL');
              router.replace('/(driver-tabs)');
            }
          } else if (backendStatus === 'ACCEPTED') {
            setTripState('ACCEPTED');
          } else if (backendStatus === 'EN_ROUTE_PICKUP' || backendStatus === 'ARRIVED_PICKUP' || backendStatus === 'PICKUP') {
            setTripState('ARRIVED');
          } else if (backendStatus === 'IN_PROGRESS') {
            setTripState('IN_PROGRESS');
          } else if (backendStatus === 'COMPLETED' || backendStatus === 'FINISHED') {
            setTripState('COMPLETED_SUCCESS');
          }
        } else {
          // No active ride, reset if we were in progress
          if (tripState !== 'IDLE' && tripState !== 'COMPLETED_SUCCESS') {
            setTripState('IDLE');
            setCurrentTrip(null);
          }
        }
      } catch (error) {
        console.log('Error polling current ride:', error);
      }
    };

    if (isOnline) {
      // Poll immediately and then every 3 seconds
      pollCurrentRide();
      pollingInterval = setInterval(pollCurrentRide, 3000);
    } else {
      setCurrentTrip(null);
      setTripState('IDLE');
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [isOnline, tripState]);

  useEffect(() => {
    if (!socket || !currentTrip?.id) return;

    const handleRoomUpdate = (data: any) => {
      if (!isRoomUpdateForRide(data, currentTrip.id)) return;

      const inferredState = inferTripState(data);
      if (!inferredState) return;

      if (inferredState === 'IDLE') {
        setTripState('IDLE');
        setCurrentTrip(null);
        return;
      }

      setTripState(inferredState as any);
    };

    socket.emit('join_room', currentTrip.id);
    socket.on('new_notification', handleRoomUpdate);

    return () => {
      socket.off('new_notification', handleRoomUpdate);
      socket.emit('leave_room', currentTrip.id);
    };
  }, [socket, currentTrip?.id]);

  // Proposal countdown timer
  useEffect(() => {
    let timer: any;
    if (tripState === 'PROPOSAL' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(c => c - 1);
      }, 1000);
    } else if (tripState === 'PROPOSAL' && countdown === 0) {
      // Auto reject when timer hits 0
      handleRejectTrip();
      Alert.alert('Bỏ lỡ chuyến xe', 'Bạn đã không nhận cuốc xe kịp thời.');
    }
    return () => clearInterval(timer);
  }, [tripState, countdown]);

  const toggleOnline = async (value: boolean) => {
    setLoading(true);
    try {
      let currentStatus = verificationStatus;

      if (value) {
        // Fetch the fresh profile from driver-service to check real status
        try {
          const res = await api.get('/api/drivers/me/profile');
          if (res.data && res.data.result) {
            const profile = res.data.result;
            if (profile.verificationStatus) {
              currentStatus = profile.verificationStatus;
              setVerificationStatus(profile.verificationStatus);
            }
          }
        } catch (profileErr) {
          console.log('Failed to fetch fresh profile status, falling back to state:', profileErr);
        }
      }

      if (value && currentStatus !== 'APPROVED') {
        Alert.alert(
          'Tài khoản chưa được duyệt',
          'Bạn cần vào tab Tài khoản và bấm Kích hoạt tài khoản để backend chuyển trạng thái sang APPROVED trước khi bật Online.'
        );
        setLoading(false);
        return;
      }

      // Sync availability with backend driver-service matching Spring DTO
      await api.patch('/api/drivers/me/availability', {
        availabilityStatus: value ? 'ONLINE' : 'OFFLINE',
        currentLatitude: 10.822, // Simulated IUH campus coordinates
        currentLongitude: 106.687
      });

      if (value) {
        // Sync coordinates with Redis GEO key (driver:locations) owned by ride-service
        const driverId = await AsyncStorage.getItem('user_id');
        if (driverId) {
          try {
            await api.post('/api/v1/rides/location', {
              driverId: driverId,
              lat: 10.822,
              lng: 106.687
            });
            console.log('Successfully synchronized GPS location with Redis GEO (ride-service)');
          } catch (geoError: any) {
            console.log('Failed to sync Redis GEO location:', geoError.message || geoError);
          }
        }
      }

      setIsOnline(value);
      if (!value) {
        setTripState('IDLE');
      }
    } catch (error: any) {
      console.log('Failed to sync availability with server:', error.message || error);
      let errorMsg = 'Không thể cập nhật trạng thái hoạt động với máy chủ.';
      if (error.response?.status === 403) {
        errorMsg = 'Backend từ chối bật Online. Hãy kiểm tra lại hồ sơ tài xế đã được APPROVED và đã chọn đúng loại xe CAR4.';
      }
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      Alert.alert('Lỗi kết nối', errorMsg);

      // Revert the toggle state
      setIsOnline(false);
      setTripState('IDLE');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTrip = async () => {
    try {
      await api.post('/api/drivers/me/rides/assignment', {
        rideId: currentTrip.id,
        action: 'ACCEPT'
      });
      setTripState('ACCEPTED');
    } catch (e: any) {
      console.log('Failed to accept trip on server:', e.message || e);
      // Local state fallback for stability
      setTripState('ACCEPTED');
    }
  };

  const handleRejectTrip = async () => {
    try {
      await api.post('/api/drivers/me/rides/assignment', {
        rideId: currentTrip.id,
        action: 'REJECT'
      });
    } catch (e: any) {
      console.log('Failed to reject trip on server:', e.message || e);
    }
    setTripState('IDLE');
    setCurrentTrip(null);
  };

  const handleArriveAtPickup = async () => {
    try {
      await api.post(`/api/v1/rides/${currentTrip.id}/arrive`);
      try {
        await api.patch('/api/drivers/me/rides/current', {
          rideStatus: 'ARRIVED_PICKUP'
        });
      } catch (err: any) {
        console.log('Failed to patch driver status to ARRIVED_PICKUP:', err.message || err);
      }
      setTripState('ARRIVED');
    } catch (e: any) {
      console.log('Failed to notify arrival on server:', e.message || e);
      setTripState('ARRIVED');
    }
  };

  const handleStartTrip = async () => {
    try {
      await api.post(`/api/v1/rides/${currentTrip.id}/start`);
      try {
        await api.patch('/api/drivers/me/rides/current', {
          rideStatus: 'IN_PROGRESS'
        });
      } catch (err: any) {
        console.log('Failed to patch driver status to IN_PROGRESS:', err.message || err);
      }
      setTripState('IN_PROGRESS');
    } catch (e: any) {
      console.log('Failed to start trip on server:', e.message || e);
      setTripState('IN_PROGRESS');
    }
  };

  const handleCompleteTrip = async () => {
    if (completingTrip || !currentTrip?.id) return;
    setCompletingTrip(true);
    try {
      await api.post(`/api/v1/rides/${currentTrip.id}/complete`, {
        finalFare: currentTrip.estimatedFare,
        paymentMethod: currentTrip.paymentMethod || 'CASH'
      });
      try {
        await api.post('/api/drivers/me/rides/current/complete');
      } catch (err: any) {
        console.log('Failed to post driver complete:', err.message || err);
      }
    } catch (e: any) {
      console.log('Failed to complete trip on server:', e.message || e);
    }

    // Save to local storage driver-jobs list so it populates jobs.tsx!
    try {
      const existingJobsJson = await AsyncStorage.getItem('driver_completed_jobs');
      const jobs = existingJobsJson ? JSON.parse(existingJobsJson) : [];
      const currentTripId = String(currentTrip.id);
      const newJob = {
        id: currentTripId,
        dropoffLocation: currentTrip.dropoffLocation,
        pickupLocation: currentTrip.pickupLocation,
        estimatedFare: currentTrip.estimatedFare,
        createdAt: new Date().toISOString(),
        customerName: currentTrip.customerName,
        status: 'COMPLETED',
        paymentMethod: currentTrip.paymentMethod || 'CASH',
        distance: currentTrip.distance
      };
      const jobsWithoutDuplicate = jobs.filter((job: any) => String(job?.id ?? '') !== currentTripId);
      await AsyncStorage.setItem('driver_completed_jobs', JSON.stringify([newJob, ...jobsWithoutDuplicate]));

      // Update local driver earnings (70% driver share, 30% platform fee)
      const existingEarnings = await AsyncStorage.getItem('driver_earnings');
      const currentEarnings = existingEarnings ? parseFloat(existingEarnings) : 0;
      const driverEarning = currentTrip.estimatedFare * 0.70;
      const alreadyStored = jobs.some((job: any) => String(job?.id ?? '') === currentTripId);
      if (!alreadyStored) {
        await AsyncStorage.setItem('driver_earnings', (currentEarnings + driverEarning).toString());
      }
    } catch (storageError) {
      console.log('Failed to save simulated earnings:', storageError);
    }

    setTripState('COMPLETED_SUCCESS');
    setCompletingTrip(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>TX</Text>
          </View>
          <View style={styles.driverMeta}>
            <Text style={styles.driverWelcome}>Xin chào,</Text>
            <Text style={styles.driverName}>{driverName}</Text>
          </View>
        </View>

        {/* Toggle Switch */}
        <View style={styles.onlineToggleWrapper}>
          <Text style={[styles.toggleText, isOnline ? styles.textOnline : styles.textOffline]}>
            {isOnline ? 'Đang Online' : 'Đang Offline'}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color="#6366F1" style={{ marginLeft: 8 }} />
          ) : (
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
              thumbColor={isOnline ? '#6366F1' : '#F3F4F6'}
            />
          )}
        </View>
      </View>

      <View style={styles.content}>
        {isOnline ? (
          <>
            <DriverMap
              currentTrip={currentTrip}
              tripState={tripState}
              routeCoordinates={routeCoordinates}
              isOnline={isOnline}
            />

            {/* Float Cards Over Map */}
            {tripState === 'IDLE' && (
              <View style={styles.floatingScanningCard}>
                <View style={styles.scanningHeader}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.scanningTitle}>Đang quét chuyến xe gần nhất...</Text>
                </View>
                <Text style={styles.scanningDesc}>
                  Radar định vị GPS đang hoạt động trong bán kính 5km. Vui lòng giữ ứng dụng mở để tự động nhận yêu cầu đặt xe.
                </Text>
              </View>
            )}

            {tripState === 'PROPOSAL' && currentTrip && (
              <View style={styles.floatingProposalCard}>
                <View style={styles.proposalHeader}>
                  <Text style={styles.proposalTitle}>CÓ CUỐC XE MỚI GẦN BẠN!</Text>
                  <View style={styles.timerBadge}>
                    <Text style={styles.timerText}>{countdown}s</Text>
                  </View>
                </View>

                <View style={styles.proposalDetails}>
                  <View style={styles.passengerRow}>
                    <Text style={styles.passengerLabel}>Dịch vụ:</Text>
                    <Text style={[styles.passengerValue, { color: '#6366F1', fontWeight: '800' }]}>
                      {currentTrip.vehicleType === 'BIKE' ? '🏍️ Xe máy (BIKE)' : currentTrip.vehicleType === 'CAR7' ? '🚐 Ô tô 7 chỗ (CAR7)' : '🚗 Ô tô 4 chỗ (CAR4)'}
                    </Text>
                  </View>

                  <View style={styles.passengerRow}>
                    <Text style={styles.passengerLabel}>Khách hàng:</Text>
                    <Text style={styles.passengerValue}>{currentTrip.customerName}</Text>
                  </View>

                  {/* Route Timeline in Proposal */}
                  <View style={styles.routeContainer}>
                    <View style={styles.iconCol}>
                      <View style={styles.pickupDot} />
                      <View style={styles.lineConnector} />
                      <MapPin size={18} color="#EF4444" />
                    </View>
                    <View style={styles.addressCol}>
                      <Text style={styles.addressTitle}>Điểm đón:</Text>
                      <Text style={styles.addressText} numberOfLines={1}>{currentTrip.pickupLocation}</Text>

                      <Text style={[styles.addressTitle, { marginTop: 10 }]}>Điểm trả:</Text>
                      <Text style={styles.addressText} numberOfLines={1}>{currentTrip.dropoffLocation}</Text>
                    </View>
                  </View>

                  {/* Stats Grid */}
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Cự ly</Text>
                      <Text style={styles.statValue}>{currentTrip.distance}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Thời gian</Text>
                      <Text style={styles.statValue}>{currentTrip.time}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Thanh toán</Text>
                      <Text style={styles.statValue}>
                        {currentTrip.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Thẻ'}
                      </Text>
                    </View>
                  </View>

                  {/* Price Tag */}
                  <View style={styles.priceTagRow}>
                    <Text style={styles.priceTagLabel}>Bạn sẽ nhận được:</Text>
                    <Text style={styles.priceTagValue}>{Math.round(currentTrip.estimatedFare * 0.70)?.toLocaleString()}đ</Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.proposalActions}>
                    <TouchableOpacity style={styles.rejectButton} onPress={handleRejectTrip}>
                      <X size={18} color="#EF4444" />
                      <Text style={styles.rejectButtonText}>Từ chối</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptTrip}>
                      <Check size={18} color="#FFF" />
                      <Text style={styles.acceptButtonText}>NHẬN CUỐC XE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {(tripState === 'ACCEPTED' || tripState === 'ARRIVED' || tripState === 'IN_PROGRESS') && currentTrip && (
              <View style={styles.floatingActiveCard}>
                <View style={[styles.activeStatusBadge, {
                  backgroundColor: tripState === 'ACCEPTED' ? '#F59E0B' : tripState === 'ARRIVED' ? '#6366F1' : '#10B981'
                }]}>
                  <Text style={styles.activeStatusText}>
                    {tripState === 'ACCEPTED' ? 'Đang di chuyển tới điểm đón' :
                      tripState === 'ARRIVED' ? 'Đã đến điểm đón - Chờ khách lên xe' :
                        'Đang chở khách đến điểm đến'}
                  </Text>
                </View>

                {/* Passenger contacts */}
                <View style={styles.passengerProfileRow}>
                  <View style={styles.passengerAvatar}>
                    <Text style={styles.passengerAvatarText}>KH</Text>
                  </View>
                  <View style={styles.passengerInfo}>
                    <Text style={styles.passengerNameText}>{currentTrip.customerName}</Text>
                    <Text style={styles.passengerPhoneText}>{currentTrip.phone}</Text>
                  </View>
                  <View style={styles.contactButtons}>
                    <TouchableOpacity style={styles.contactCircle} onPress={() => Alert.alert('Gọi điện', 'Đang kết nối cuộc gọi...')}>
                      <Phone size={16} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.contactCircle} onPress={() => {
                      if (!currentTrip?.id) return;
                      router.push({
                        pathname: '/(driver-tabs)/chat',
                        params: {
                          bookingId: currentTrip.id,
                          customerName: currentTrip.customerName ?? 'Khách hàng',
                        },
                      });
                    }}>
                      <MessageSquare size={16} color="#6366F1" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Location target description */}
                <View style={styles.activeRouteBox}>
                  <Text style={styles.activeRouteLabel}>
                    {tripState === 'IN_PROGRESS' ? 'Điểm trả khách:' : 'Điểm đón khách:'}
                  </Text>
                  <Text style={styles.activeRouteText} numberOfLines={1}>
                    {tripState === 'IN_PROGRESS' ? currentTrip.dropoffLocation : currentTrip.pickupLocation}
                  </Text>
                </View>

                {/* Fare Summary and button */}
                <View style={styles.activeFareRow}>
                  <Text style={styles.activeFareLabel}>Thu nhập thực nhận:</Text>
                  <Text style={styles.activeFareValue}>{Math.round(currentTrip.estimatedFare * 0.70)?.toLocaleString()}đ</Text>
                </View>

                <View style={styles.stepProgressContainer}>
                  {tripState === 'ACCEPTED' && (
                    <TouchableOpacity style={styles.progressButton} onPress={handleArriveAtPickup}>
                      <CheckCircle2 size={20} color="#FFF" />
                      <Text style={styles.progressButtonText}>XÁC NHẬN ĐÃ ĐẾN ĐIỂM ĐÓN</Text>
                    </TouchableOpacity>
                  )}

                  {tripState === 'ARRIVED' && (
                    <TouchableOpacity style={[styles.progressButton, { backgroundColor: '#10B981' }]} onPress={handleStartTrip}>
                      <Play size={20} color="#FFF" />
                      <Text style={styles.progressButtonText}>BẮT ĐẦU CHUYẾN XE</Text>
                    </TouchableOpacity>
                  )}

                  {tripState === 'IN_PROGRESS' && (
                    <TouchableOpacity
                      style={[styles.progressButton, { backgroundColor: '#6366F1', opacity: completingTrip ? 0.7 : 1 }]}
                      onPress={handleCompleteTrip}
                      disabled={completingTrip}
                    >
                      <CheckCircle2 size={20} color="#FFF" />
                      <Text style={styles.progressButtonText}>
                        {completingTrip ? 'ĐANG HOÀN THÀNH...' : 'HOÀN THÀNH CHUYẾN ĐI'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {tripState === 'COMPLETED_SUCCESS' && currentTrip && (
              <View style={styles.floatingSuccessCard}>
                <View style={styles.successCheckCircle}>
                  <Check size={36} color="#FFF" />
                </View>
                <Text style={styles.successTitle}>CHUYẾN ĐI HOÀN THÀNH!</Text>

                <View style={styles.successSummaryBox}>
                  <View style={styles.successSummaryRow}>
                    <Text style={styles.successSummaryLabel}>Tổng tiền khách trả:</Text>
                    <Text style={styles.successSummaryValue}>{currentTrip.estimatedFare?.toLocaleString()}đ</Text>
                  </View>
                  <View style={styles.successSummaryRow}>
                    <Text style={styles.successSummaryLabel}>Thu nhập của bạn (70%):</Text>
                    <Text style={styles.successSummaryFare}>+{(currentTrip.estimatedFare * 0.70)?.toLocaleString()}đ</Text>
                  </View>
                  <View style={styles.successSummaryRow}>
                    <Text style={styles.successSummaryLabel}>Khách hàng:</Text>
                    <Text style={styles.successSummaryValue}>{currentTrip.customerName}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.successReturnButton} onPress={() => {
                  if (currentTrip?.id && socket) {
                    socket.emit('leave_room', currentTrip.id);
                  }
                  setCurrentTrip(null);
                  setTripState('IDLE');
                }}>
                  <Text style={styles.successReturnButtonText}>TIẾP TỤC NHẬN CUỐC</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          /* Offline screen layout */
          <View style={styles.offlineBox}>
            <View style={styles.offlineCircle}>
              <Shield size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.offlineTitle}>Bạn đang Ngoại tuyến</Text>
            <Text style={styles.offlineDesc}>
              Bật công tắc Online phía trên góc phải để bắt đầu quét các yêu cầu di chuyển xung quanh và tăng thu nhập ngay!
            </Text>
            <TouchableOpacity style={styles.inlineOnlineButton} onPress={() => toggleOnline(true)}>
              <Text style={styles.inlineOnlineButtonText}>BẬT HOẠT ĐỘNG NGAY</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    zIndex: 10,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  driverMeta: {
    marginLeft: 10,
  },
  driverWelcome: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  onlineToggleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
  },
  textOnline: {
    color: '#10B981',
  },
  textOffline: {
    color: '#6B7280',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  offlineBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FFF',
  },
  offlineCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8,
  },
  offlineDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  inlineOnlineButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 25,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  inlineOnlineButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  floatingScanningCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  scanningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  scanningTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6366F1',
  },
  scanningDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  floatingProposalCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  proposalTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },
  timerBadge: {
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timerText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  proposalDetails: {
    padding: 16,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  passengerLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  passengerValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
    marginLeft: 6,
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  iconCol: {
    width: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  lineConnector: {
    width: 1.5,
    height: 38,
    backgroundColor: '#E5E7EB',
    marginVertical: 3,
  },
  addressCol: {
    flex: 1,
    marginLeft: 8,
  },
  addressTitle: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  addressText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '650',
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 1,
  },
  priceTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    marginBottom: 14,
  },
  priceTagLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  priceTagValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#6366F1',
  },
  proposalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  rejectButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#6366F1',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  floatingActiveCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  activeStatusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 15,
    marginBottom: 14,
  },
  activeStatusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  passengerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  passengerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerAvatarText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '800',
  },
  passengerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  passengerNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  passengerPhoneText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeRouteBox: {
    marginBottom: 14,
  },
  activeRouteLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  activeRouteText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginTop: 2,
  },
  activeFareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    marginBottom: 14,
  },
  activeFareLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  activeFareValue: {
    fontSize: 16,
    fontWeight: '850',
    color: '#6366F1',
  },
  stepProgressContainer: {
    width: '100%',
  },
  progressButton: {
    height: 50,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  progressButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  floatingSuccessCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  successCheckCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10B981',
    marginBottom: 12,
  },
  successSummaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  successSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  successSummaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  successSummaryFare: {
    fontSize: 16,
    fontWeight: '900',
    color: '#10B981',
  },
  successSummaryValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '700',
  },
  successReturnButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#10B981',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successReturnButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
