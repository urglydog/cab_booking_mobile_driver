import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, LogOut, Shield, PhoneCall, CreditCard, ChevronRight, Car, Bike, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '@/services/api';

export default function DriverAccountScreen() {
  const router = useRouter();
  const [driverName, setDriverName] = useState('Tài xế');
  const [driverPhone, setDriverPhone] = useState('090 123 4567');
  const [vehicleInfo, setVehicleInfo] = useState('Chưa kích hoạt');
  const [verificationStatus, setVerificationStatus] = useState<'PENDING' | 'APPROVED'>('PENDING');
  const [accountStatus, setAccountStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION' | 'DELETED'>('ACTIVE');
  const [stats, setStats] = useState({ acceptRate: 100, cancelRate: 0, totalRides: 0 });

  const fetchStats = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;

      const response = await api.get(`/api/v1/bookings/driver/${userId}?page=0&size=100`);
      if (response.data?.result?.content) {
        const bookings = response.data.result.content || [];
        const completed = bookings.filter((b: any) => b.status === 'COMPLETED').length;
        const cancelled = bookings.filter((b: any) => b.status === 'CANCELLED').length;
        
        const totalRelevant = completed + cancelled;
        const acceptRate = totalRelevant > 0 ? Math.round((completed / totalRelevant) * 100) : 100;
        const cancelRate = totalRelevant > 0 ? Math.round((cancelled / totalRelevant) * 100) : 0;

        setStats({
          acceptRate: Math.max(0, acceptRate),
          cancelRate: Math.max(0, cancelRate),
          totalRides: completed,
        });
      } else {
        setStats({ acceptRate: 100, cancelRate: 0, totalRides: 0 });
      }
    } catch (err) {
      console.log('Failed to fetch driver stats dynamically:', err);
    }
  };

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        console.log('No access token found, skipping profile load.');
        return;
      }

      const name = await AsyncStorage.getItem('user_name');
      if (name) setDriverName(name);

      const phone = await AsyncStorage.getItem('user_phone');
      if (phone) setDriverPhone(phone);

      // Attempt to fetch profile details from driver-service
      let profileFetched = false;
      try {
        const res = await api.get('/api/drivers/me/profile');
        if (res.data && res.data.result) {
          profileFetched = true;
          const profile = res.data.result;
          setDriverName(profile.fullName || name);
          if (profile.phoneNumber) setDriverPhone(profile.phoneNumber);
          if (profile.accountStatus) setAccountStatus(profile.accountStatus);
          if (profile.verificationStatus) {
            setVerificationStatus(profile.verificationStatus);
          }
          if (profile.accountStatus === 'SUSPENDED') {
            setVehicleInfo('Tài khoản đã bị chặn');
          } else if (profile.verificationStatus === 'APPROVED' && profile.vehiclePlate) {
            let typeLabel = 'Xe 4 chỗ';
            if (profile.vehicleType === 'BIKE') typeLabel = 'Xe máy';
            else if (profile.vehicleType === 'CAR7') typeLabel = 'Xe 7 chỗ';
            setVehicleInfo(`${typeLabel} • ${profile.vehiclePlate} (${profile.vehicleModel})`);
          } else {
            setVehicleInfo('Chưa kích hoạt');
          }
        }
      } catch (profileErr) {
        console.log('Profile get request failed (likely not created yet on server):', profileErr);
      }

    } catch (err) {
      console.log('Driver profile load failed, using fallback.');
    }
  };

  useEffect(() => {
    loadProfile();
    fetchStats();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      fetchStats();
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Tài xế này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'ĐĂNG XUẤT',
          onPress: async () => {
            try {
              // CRITICAL: Set driver OFFLINE on backend BEFORE clearing local storage.
              // This triggers DriverStatusService.clearAllDriverRedisKeys() which purges:
              //   - driver:status:{driverId}
              //   - driver:vehicleType:{driverId}
              //   - driver:profile:{driverId}
              //   - driver:lock:{driverId}
              //   - driver:available:locations (GEO entry)
              // Prevents stale GEO data from matching with wrong vehicle type after re-login.
              try {
                await api.patch('/api/drivers/me/availability', {
                  availabilityStatus: 'OFFLINE',
                  currentLatitude: null,
                  currentLongitude: null,
                });
                console.log('✅ Driver set OFFLINE on backend — Redis keys purged.');
              } catch (offlineErr) {
                console.warn('⚠️ Failed to set OFFLINE on backend (continuing logout):', offlineErr);
              }

              // Call auth-service logout to invalidate session
              try {
                const refreshToken = await AsyncStorage.getItem('refresh_token');
                if (refreshToken) {
                  await api.post('/api/auth/logout', { refreshToken });
                }
              } catch (authErr) {
                console.warn('Auth logout failed, clearing local session anyway:', authErr);
              }

              // Flush storage
              await AsyncStorage.removeItem('access_token');
              await AsyncStorage.removeItem('refresh_token');
              await AsyncStorage.removeItem('user_id');
              await AsyncStorage.removeItem('user_name');
              await AsyncStorage.removeItem('user_role');
              await AsyncStorage.removeItem('user_phone');
              await AsyncStorage.removeItem('user_email');
              await AsyncStorage.removeItem('fcm_token');
              
              // Flush simulated earnings & jobs
              await AsyncStorage.removeItem('driver_completed_jobs');
              await AsyncStorage.removeItem('driver_earnings');

              Alert.alert('Thành công', 'Đăng xuất thành công!');
              router.replace('/(auth)/login');
            } catch (error) {
              console.log('Failed to log out:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>TX</Text>
          </View>
          <Text style={styles.driverNameText}>{driverName}</Text>
          
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>TÀI XẾ ĐỐI TÁC</Text>
          </View>

          <Text style={styles.driverPhoneText}>{driverPhone}</Text>

          {/* Statistics Grid */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.acceptRate}%</Text>
              <Text style={styles.statLabel}>Tỉ lệ nhận</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.cancelRate}%</Text>
              <Text style={styles.statLabel}>Tỉ lệ hủy</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalRides}</Text>
              <Text style={styles.statLabel}>Tổng chuyến</Text>
            </View>
          </View>
        </View>

        {/* Verification / KYC Banner */}
        <Text style={styles.sectionTitle}>Trạng thái hoạt động</Text>
        {verificationStatus !== 'APPROVED' ? (
          <View style={styles.pendingKycCard}>
            <View style={styles.kycHeader}>
              <AlertTriangle size={20} color="#F59E0B" />
              <Text style={styles.pendingKycTitle}>TÀI KHOẢN CHƯA KÍCH HOẠT</Text>
            </View>
            <Text style={styles.pendingKycDesc}>
              Hồ sơ của bạn hiện đang chờ xử lý. Bạn cần hoàn thành xác thực xe và GPLX để được cấp quyền bật trực tuyến nhận chuyến.
            </Text>
            <Text style={styles.pendingKycHint}>Vui lòng liên hệ admin để kích hoạt hồ sơ tài xế.</Text>
          </View>
        ) : (
          <View style={styles.approvedKycCard}>
            <View style={styles.kycHeader}>
              <CheckCircle2 size={20} color="#10B981" />
              <Text style={styles.approvedKycTitle}>TÀI KHOẢN ĐÃ KÍCH HOẠT</Text>
            </View>
            <Text style={styles.approvedKycDesc}>
              Hồ sơ của bạn đã được kiểm duyệt và xác thực thành công. Bạn đã có thể bắt đầu bật trực tuyến để nhận cuốc ngay!
            </Text>
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#A7F3D0' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', letterSpacing: 0.5 }}>
                🟢 DỊCH VỤ HOẠT ĐỘNG: {vehicleInfo.split(' • ')[0]?.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {accountStatus === 'SUSPENDED' && (
          <View style={styles.blockedCard}>
            <View style={styles.kycHeader}>
              <Shield size={20} color="#DC2626" />
              <Text style={styles.blockedTitle}>TÀI KHOẢN ĐÃ BỊ CHẶN</Text>
            </View>
            <Text style={styles.blockedDesc}>
              Admin đã chặn tài khoản này. Bạn không thể bật Online hoặc nhận chuyến cho đến khi được mở chặn.
            </Text>
          </View>
        )}

        {/* Vehicle Information */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Phương tiện đăng ký</Text>
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIconCircle}>
            {verificationStatus !== 'APPROVED' ? (
              <AlertTriangle size={20} color="#F59E0B" />
            ) : vehicleInfo.includes('Xe máy') ? (
              <Bike size={20} color="#6366F1" />
            ) : (
              <Car size={20} color="#6366F1" />
            )}
          </View>
          <View style={styles.vehicleMeta}>
            <Text style={styles.vehicleLabel}>Thông tin xe</Text>
            <Text style={styles.vehicleValue} numberOfLines={2}>{vehicleInfo}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <Text style={styles.sectionTitle}>Cài đặt tài khoản</Text>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Thông báo', 'Tính năng Hồ sơ cá nhân & Xác thực đang được phát triển.')}>
            <View style={styles.menuItemLeft}>
              <User size={18} color="#4B5563" />
              <Text style={styles.menuItemText}>Hồ sơ cá nhân & Xác thực</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Ngân hàng', 'Cài đặt liên kết ngân hàng nhận tiền...')}>
            <View style={styles.menuItemLeft}>
              <CreditCard size={18} color="#4B5563" />
              <Text style={styles.menuItemText}>Tài khoản ngân hàng</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Bảo mật', 'Cài đặt mật khẩu & quyền riêng tư...')}>
            <View style={styles.menuItemLeft}>
              <Shield size={18} color="#4B5563" />
              <Text style={styles.menuItemText}>Quyền riêng tư & Bảo mật</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Tổng đài hỗ trợ', 'Đang quay số kết nối tổng đài hỗ trợ Tài xế 24/7 (1900 xxxx)...')}>
            <View style={styles.menuItemLeft}>
              <PhoneCall size={18} color="#4B5563" />
              <Text style={styles.menuItemText}>Tổng đài hỗ trợ đối tác</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Log out Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>

        {/* App Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>CAB Partner Version 1.0.0 (Beta)</Text>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 24,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
  },
  avatarTextLarge: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
  driverNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 0.5,
  },
  driverPhoneText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    paddingLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehicleCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  vehicleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleMeta: {
    marginLeft: 12,
    flex: 1,
  },
  vehicleLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  vehicleValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    marginTop: 2,
  },
  menuContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    height: 54,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    marginBottom: 24,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  pendingKycCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    marginBottom: 16,
  },
  kycHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pendingKycTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  pendingKycDesc: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 12,
  },
  pendingKycHint: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 18,
  },
  approvedKycCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
    marginBottom: 16,
  },
  blockedCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    marginBottom: 16,
  },
  approvedKycTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  approvedKycDesc: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '500',
    lineHeight: 18,
  },
  blockedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
    letterSpacing: 0.5,
  },
  blockedDesc: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '500',
    lineHeight: 18,
  },
});
