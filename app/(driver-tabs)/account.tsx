import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, LogOut, Shield, PhoneCall, CreditCard, ChevronRight, Car, Bike, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '@/services/api';

export default function DriverAccountScreen() {
  const router = useRouter();
  const [driverName, setDriverName] = useState('Tài xế');
  const [driverPhone, setDriverPhone] = useState('090 123 4567');
  const [vehicleInfo, setVehicleInfo] = useState('Xe ô tô • 51H-12345 (Toyota Vios)');
  const [verificationStatus, setVerificationStatus] = useState<'PENDING' | 'APPROVED'>('PENDING');
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [stats, setStats] = useState({ acceptRate: 100, cancelRate: 0, totalRides: 0 });

  const fetchStats = async () => {
    try {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;
      
      const response = await api.get(`/api/v1/bookings/driver/${userId}?page=0&size=100`);
      if (response.data && response.data.result && response.data.result.content) {
        const bookings = response.data.result.content;
        const completed = bookings.filter((b: any) => b.status === 'COMPLETED').length;
        const cancelled = bookings.filter((b: any) => b.status === 'CANCELLED').length;
        const total = completed + cancelled;
        
        if (total > 0) {
          const acceptRate = Math.round((completed / total) * 100);
          const cancelRate = Math.round((cancelled / total) * 100);
          setStats({ acceptRate, cancelRate, totalRides: total });
        } else {
          // If no database rides yet, try local completed jobs count as fallback
          const localStored = await AsyncStorage.getItem('driver_completed_jobs');
          if (localStored) {
            const jobs = JSON.parse(localStored);
            const comp = jobs.filter((j: any) => j.status !== 'CANCELLED').length;
            const canc = jobs.filter((j: any) => j.status === 'CANCELLED').length;
            const tot = comp + canc;
            if (tot > 0) {
              setStats({
                acceptRate: Math.round((comp / tot) * 100),
                cancelRate: Math.round((canc / tot) * 100),
                totalRides: tot
              });
              return;
            }
          }
          setStats({ acceptRate: 100, cancelRate: 0, totalRides: 0 });
        }
      }
    } catch (err) {
      console.log('Failed to fetch driver stats:', err);
    }
  };

  const handleVerifyKYC = async (vehicleType: 'BIKE' | 'CAR4' | 'CAR7') => {
    setLoadingVerify(true);
    try {
      let vehiclePlate = '51H-12345';
      let vehicleModel = 'Toyota Vios';
      let vehicleColor = 'Black';
      if (vehicleType === 'BIKE') {
        vehiclePlate = '59A-12345';
        vehicleModel = 'Honda SH';
        vehicleColor = 'Red';
      } else if (vehicleType === 'CAR7') {
        vehiclePlate = '51A-77777';
        vehicleModel = 'Mitsubishi Xpander';
        vehicleColor = 'Silver';
      }

      const freshName = await AsyncStorage.getItem('user_name') || driverName;
      const freshPhone = await AsyncStorage.getItem('user_phone') || driverPhone;
      const freshEmail = await AsyncStorage.getItem('user_email') || undefined;

      // Call PUT /api/drivers/me/profile to auto-approve the driver profile on backend dev environment
      const res = await api.put('/api/drivers/me/profile', {
        fullName: freshName,
        email: freshEmail,
        phoneNumber: freshPhone,
        avatarUrl: 'https://example.com/avatar/default.png',
        licenseNumber: 'GPLX-999999',
        vehicleType: vehicleType,
        vehiclePlate: vehiclePlate,
        vehicleModel: vehicleModel,
        vehicleColor: vehicleColor,
        serviceArea: 'Ho Chi Minh City'
      });

      if (res.status === 200 || res.status === 201) {
        Alert.alert(
          'Thành công 🎉',
          `Xác thực và kích hoạt xe ${vehicleType === 'BIKE' ? 'Xe máy (BIKE)' : vehicleType === 'CAR4' ? 'Xe 4 chỗ (CAR4)' : 'Xe 7 chỗ (CAR7)'} thành công! Trạng thái của bạn đã chuyển sang APPROVED.\n\nBây giờ bạn có thể quay lại trang chủ và gạt nút ONLINE!`
        );
        // Refresh local UI state
        if (res.data && res.data.result) {
          const profile = res.data.result;
          setDriverName(profile.fullName || freshName);
          if (profile.phoneNumber) setDriverPhone(profile.phoneNumber);
          if (profile.verificationStatus) {
            setVerificationStatus(profile.verificationStatus);
          }
          if (profile.vehiclePlate) {
            let typeLabel = 'Xe 4 chỗ';
            if (profile.vehicleType === 'BIKE') typeLabel = 'Xe máy';
            else if (profile.vehicleType === 'CAR7') typeLabel = 'Xe 7 chỗ';
            setVehicleInfo(`${typeLabel} • ${profile.vehiclePlate} (${profile.vehicleModel})`);
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      const msg = e.response?.data?.message || 'Không thể kết nối đến máy chủ xác thực.';
      Alert.alert('Thất bại', msg);
    } finally {
      setLoadingVerify(false);
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
          if (profile.verificationStatus) {
            setVerificationStatus(profile.verificationStatus);
          }
          if (profile.vehiclePlate) {
            let typeLabel = 'Xe 4 chỗ';
            if (profile.vehicleType === 'BIKE') typeLabel = 'Xe máy';
            else if (profile.vehicleType === 'CAR7') typeLabel = 'Xe 7 chỗ';
            setVehicleInfo(`${typeLabel} • ${profile.vehiclePlate} (${profile.vehicleModel})`);
          }
        }
      } catch (profileErr) {
        console.log('Profile get request failed (likely not created yet on server):', profileErr);
      }

      if (!profileFetched) {
        // Auto-check for pending registration vehicle type
        const pendingType = await AsyncStorage.getItem('@pending_registration_vehicle_type');
        if (pendingType) {
          // Auto-trigger KYC verification!
          await handleVerifyKYC(pendingType as any);
        }
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

  const handleVerifyPrompt = async () => {
    try {
      const pendingType = await AsyncStorage.getItem('@pending_registration_vehicle_type');
      if (pendingType === 'BIKE' || pendingType === 'CAR4' || pendingType === 'CAR7') {
        const vehicleLabel = pendingType === 'BIKE' ? 'Xe máy (BIKE)' : pendingType === 'CAR4' ? 'Xe 4 chỗ (CAR4)' : 'Xe 7 chỗ (CAR7)';
        Alert.alert(
          'Kích hoạt phương tiện',
          `Kích hoạt phương tiện ${vehicleLabel} bạn đã đăng ký hoạt động với CAB?`,
          [
            {
              text: 'Hủy bỏ',
              style: 'cancel'
            },
            {
              text: 'XÁC NHẬN KÍCH HOẠT',
              onPress: () => handleVerifyKYC(pendingType as any)
            }
          ]
        );
      } else {
        // Fallback if not registered through standard flow
        Alert.alert(
          'Đăng ký / Kích hoạt xe',
          'Vui lòng chọn loại xe bạn đăng ký hoạt động với CAB:',
          [
            {
              text: '🏍️ Xe máy (BIKE)',
              onPress: () => handleVerifyKYC('BIKE')
            },
            {
              text: '🚗 Ô tô 4 chỗ (CAR4)',
              onPress: () => handleVerifyKYC('CAR4')
            },
            {
              text: '🚐 Ô tô 7 chỗ (CAR7)',
              onPress: () => handleVerifyKYC('CAR7')
            },
            {
              text: 'Hủy bỏ',
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      console.log('Failed to prompt activation:', error);
    }
  };

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
              // Flush storage
              await AsyncStorage.removeItem('access_token');
              await AsyncStorage.removeItem('refresh_token');
              await AsyncStorage.removeItem('user_id');
              await AsyncStorage.removeItem('user_name');
              await AsyncStorage.removeItem('user_role');
              
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
              Hồ sơ của bạn hiện đang ở trạng thái PENDING. Bạn cần hoàn thành xác thực xe và GPLX để được cấp quyền bật Online nhận chuyến.
            </Text>
            <TouchableOpacity 
              style={[styles.verifyKycButton, loadingVerify && { opacity: 0.7 }]} 
              onPress={handleVerifyPrompt}
              disabled={loadingVerify}
            >
              {loadingVerify ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.verifyKycButtonText}>KÍCH HOẠT TÀI KHOẢN NGAY</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.approvedKycCard}>
            <View style={styles.kycHeader}>
              <CheckCircle2 size={20} color="#10B981" />
              <Text style={styles.approvedKycTitle}>TÀI KHOẢN ĐÃ KÍCH HOẠT</Text>
            </View>
            <Text style={styles.approvedKycDesc}>
              Hồ sơ của bạn đã được kiểm duyệt và phê duyệt thành công (verificationStatus = APPROVED). Bạn đã đủ điều kiện gạt nút ONLINE để đón khách.
            </Text>
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#A7F3D0' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', letterSpacing: 0.5 }}>
                🟢 DỊCH VỤ HOẠT ĐỘNG: {vehicleInfo.split(' • ')[0]?.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Vehicle Information */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Phương tiện đăng ký</Text>
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIconCircle}>
            {vehicleInfo.includes('Xe máy') ? (
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
  verifyKycButton: {
    height: 44,
    backgroundColor: '#D97706',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  verifyKycButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  approvedKycCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
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
});
