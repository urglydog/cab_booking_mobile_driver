import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Calendar, CreditCard, Car, Bike, ShieldAlert, FileText, Route, Clock, User, Phone, Star } from 'lucide-react-native';
import api from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const maskPhoneNumber = (phone: string) => {
  if (!phone) return '—';
  const cleanPhone = String(phone).trim();
  if (cleanPhone.length < 4) return cleanPhone;
  const prefix = cleanPhone.slice(0, 3);
  const suffix = cleanPhone.slice(-2);
  const middleMask = 'x'.repeat(Math.max(1, cleanPhone.length - 5));
  return `${prefix}${middleMask}${suffix}`;
};

export default function DriverJobDetailScreen() {
  const { bookingId } = useLocalSearchParams();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<any>(null);

  const fetchBookingDetail = async () => {
    setLoading(true);
    try {
      // 1. Check if mock/seed booking
      if (bookingId && bookingId.toString().startsWith('booking-seed')) {
        const simulatedJobsJson = await AsyncStorage.getItem('driver_completed_jobs');
        const localJobs = simulatedJobsJson ? JSON.parse(simulatedJobsJson) : [];
        const found = localJobs.find((j: any) => j.id === bookingId);
        if (found) {
          setBooking({
            ...found,
            status: 'COMPLETED',
            vehicleType: 'CAR4',
            paymentMethod: 'CASH',
            distanceKm: found.id === 'booking-seed-001' ? 4.2 : 12.5,
            durationMinutes: found.id === 'booking-seed-001' ? 12 : 28,
            customerNote: 'Hãy đón tôi tại cổng chính.'
          });
          setLoading(false);
          return;
        }
      }

      // 2. Otherwise fetch from real booking service
      const response = await api.get(`/api/v1/bookings/${bookingId}`);
      if (response.data && response.data.code === 200 && response.data.result) {
        const b = response.data.result;
        setBooking({
          id: b.id,
          customerName: b.customerName || 'Khách hàng',
          phone: b.customerPhone || '0901234567',
          pickupLocation: b.pickupLocation,
          dropoffLocation: b.dropoffLocation,
          estimatedFare: b.estimatedFare,
          paymentMethod: b.paymentMethod || 'CASH',
          vehicleType: b.vehicleType || 'CAR4',
          status: b.status || 'COMPLETED',
          createdAt: b.createdAt,
          distanceKm: b.distanceKm || 0,
          durationMinutes: b.durationMinutes || 0,
          customerNote: b.customerNote
        });
      } else {
        // Fallback: Check localcompleted jobs for simulated matching
        const simulatedJobsJson = await AsyncStorage.getItem('driver_completed_jobs');
        const localJobs = simulatedJobsJson ? JSON.parse(simulatedJobsJson) : [];
        const found = localJobs.find((j: any) => j.id === bookingId);
        if (found) {
          setBooking({
            ...found,
            status: 'COMPLETED',
            vehicleType: 'CAR4',
            paymentMethod: 'CASH',
            distanceKm: 3.5,
            durationMinutes: 10
          });
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin chuyến đi.');
        }
      }
    } catch (error) {
      console.log('Failed to fetch booking detail:', error);
      Alert.alert('Lỗi', 'Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetail();
    }
  }, [bookingId]);

  useEffect(() => {
    const fetchReview = async () => {
      if (booking && booking.status === 'COMPLETED') {
        try {
          const response = await api.get(`/api/reviews/ride/${booking.id}`);
          if (response.data) {
            setReview(response.data);
          }
        } catch (err) {
          console.log('No review found for this booking detail.');
        }
      }
    };
    fetchReview();
  }, [booking?.id, booking?.status]);

  const getStatusInVietnamese = (status: string) => {
    switch (String(status).toUpperCase()) {
      case 'COMPLETED': return 'Đã hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      case 'MATCHING': return 'Đang tìm tài xế';
      case 'ACCEPTED':
      case 'ASSIGNED': return 'Đã chấp nhận';
      case 'STARTED':
      case 'IN_PROGRESS': return 'Đang di chuyển';
      default: return status || 'Không xác định';
    }
  };

  const getStatusColor = (status: string) => {
    switch (String(status).toUpperCase()) {
      case 'COMPLETED': return '#10B981';
      case 'CANCELLED': return '#EF4444';
      case 'MATCHING': return '#F59E0B';
      default: return '#6366F1';
    }
  };

  const formatVND = (amount: number) => {
    return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Đang tải chi tiết chuyến đi...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết chuyến đi</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <ShieldAlert size={64} color="#999" />
          <Text style={styles.emptyText}>Không tìm thấy chuyến đi này trong hệ thống.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết chuyến đi</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Trạng thái Card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Trạng thái</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '15' }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(booking.status) }]}>
                {getStatusInVietnamese(booking.status)}
              </Text>
            </View>
          </View>
          <View style={styles.fareContainer}>
            <Text style={styles.fareLabel}>Doanh thu nhận được (70%)</Text>
            <Text style={[styles.fareAmount, booking.status === 'CANCELLED' && { color: '#6B7280' }]}>
              {booking.status === 'CANCELLED' ? '0đ' : formatVND(booking.estimatedFare * 0.70)}
            </Text>
          </View>
        </View>

        {/* 2. Khách hàng Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin khách hàng</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <User size={20} color="#6366F1" />
            </View>
            <View style={styles.infoTextWrapper}>
              <Text style={styles.infoLabel}>Tên khách hàng</Text>
              <Text style={styles.infoValue}>
                {booking.status === 'COMPLETED' || booking.status === 'CANCELLED' ? 'Khách hàng' : booking.customerName}
              </Text>
            </View>
          </View>

          {booking.phone && (
            <View style={[styles.infoRow, { marginTop: 14 }]}>
              <View style={styles.infoIconWrapper}>
                <Phone size={20} color="#10B981" />
              </View>
              <View style={styles.infoTextWrapper}>
                <Text style={styles.infoLabel}>Số điện thoại liên hệ</Text>
                <Text style={styles.infoValue}>{maskPhoneNumber(booking.phone)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 3. Hành trình Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hành trình di chuyển</Text>

          <View style={styles.routeRow}>
            <View style={styles.iconCol}>
              <View style={styles.pickupDot} />
              <View style={styles.lineConnector} />
            </View>
            <View style={styles.addressCol}>
              <Text style={styles.addressTitle}>Điểm đón khách</Text>
              <Text style={styles.addressText}>{booking.pickupLocation}</Text>
            </View>
          </View>

          <View style={styles.routeRow}>
            <View style={styles.iconCol}>
              <MapPin size={20} color="#EF4444" />
            </View>
            <View style={styles.addressCol}>
              <Text style={styles.addressTitle}>Điểm trả khách</Text>
              <Text style={styles.addressText}>{booking.dropoffLocation}</Text>
            </View>
          </View>
        </View>

        {/* 4. Thông tin dịch vụ Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin dịch vụ</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              {booking.vehicleType === 'BIKE' ? <Bike size={20} color="#6366F1" /> : <Car size={20} color="#6366F1" />}
            </View>
            <View style={styles.infoTextWrapper}>
              <Text style={styles.infoLabel}>Loại phương tiện yêu cầu</Text>
              <Text style={styles.infoValue}>
                {booking.vehicleType === 'BIKE' ? 'Xe máy (CAB Bike)' : 'Xe ô tô (CAB Car)'}
              </Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: 14 }]}>
            <View style={styles.infoIconWrapper}>
              <CreditCard size={20} color="#10B981" />
            </View>
            <View style={styles.infoTextWrapper}>
              <Text style={styles.infoLabel}>Hình thức thanh toán</Text>
              <Text style={styles.infoValue}>
                {booking.paymentMethod === 'CASH' ? 'Tiền mặt (Nhận trực tiếp từ khách)' : 'Thẻ điện tử (Thanh toán qua app)'}
              </Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: 14 }]}>
            <View style={styles.infoIconWrapper}>
              <Calendar size={20} color="#F59E0B" />
            </View>
            <View style={styles.infoTextWrapper}>
              <Text style={styles.infoLabel}>
                {booking.status === 'CANCELLED' ? 'Thời gian hủy' : 'Thời gian hoàn thành'}
              </Text>
              <Text style={styles.infoValue}>
                {booking.createdAt ? new Date(booking.createdAt).toLocaleString('vi-VN') : '—'}
              </Text>
            </View>
          </View>

          {booking.customerNote && (
            <View style={[styles.infoRow, { marginTop: 14 }]}>
              <View style={styles.infoIconWrapper}>
                <FileText size={20} color="#6B7280" />
              </View>
              <View style={styles.infoTextWrapper}>
                <Text style={styles.infoLabel}>Ghi chú hành trình</Text>
                <Text style={styles.infoValue}>{booking.customerNote}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 5. Thống kê hành trình Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông số hành trình</Text>
          <View style={styles.routeInfoRow}>
            <View style={styles.routeInfoItem}>
              <Route size={16} color="#6366F1" />
              <Text style={styles.routeInfoText}>
                Quãng đường: {booking.distanceKm ? `${parseFloat(booking.distanceKm).toFixed(1)} km` : '—'}
              </Text>
            </View>
            <View style={styles.routeInfoItem}>
              <Clock size={16} color="#6366F1" />
              <Text style={styles.routeInfoText}>
                Thời gian ước tính: {booking.durationMinutes ? `~${booking.durationMinutes} phút` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* 5.5. Đánh giá từ khách hàng */}
        {booking.status === 'COMPLETED' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đánh giá từ khách hàng</Text>
            {review ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star 
                      key={s} 
                      size={20} 
                      color={s <= review.rating ? '#F59E0B' : '#E5E7EB'} 
                      fill={s <= review.rating ? '#F59E0B' : 'transparent'} 
                      style={{ marginHorizontal: 2 }}
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 13, color: '#4B5563', textAlign: 'center', fontWeight: '500', fontStyle: review.comment ? 'normal' : 'italic' }}>
                  {review.comment || 'Khách hàng không để lại nhận xét'}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', fontStyle: 'italic' }}>
                Chuyến đi chưa được khách hàng đánh giá
              </Text>
            )}
          </View>
        )}

        {/* 6. Metadata */}
        <View style={styles.metadataContainer}>
          <Text style={styles.metadataText}>Mã chuyến đi: {booking.id}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 15,
    color: '#4B5563',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4B5563',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    marginTop: 2,
  },
  routeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconCol: {
    width: 24,
    alignItems: 'center',
    marginTop: 4,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  lineConnector: {
    width: 2,
    height: 32,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  addressCol: {
    flex: 1,
    marginLeft: 12,
  },
  addressTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginTop: 2,
  },
  routeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeInfoText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  metadataContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  metadataText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
});
