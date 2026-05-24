import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Car, CreditCard, PhoneCall, Shield, User } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AccountMenuItem from '@/features/account/components/AccountMenuItem';
import { logoutDriver } from '@/features/auth/services/authApi';
import api from '@/services/api';

export default function DriverAccountHomeScreen() {
  const router = useRouter();

  const handleVerifyKYC = async (vehicleType: 'BIKE' | 'CAR4' | 'CAR7') => {
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

      const freshName = await AsyncStorage.getItem('user_name') || 'Tài xế CAB';
      const freshPhone = await AsyncStorage.getItem('user_phone') || '0901234567';
      const freshEmail = await AsyncStorage.getItem('user_email') || undefined;

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
          `Xác thực và kích hoạt xe ${vehicleType === 'BIKE' ? 'Xe máy (BIKE)' : vehicleType === 'CAR4' ? 'Xe 4 chỗ (CAR4)' : 'Xe 7 chỗ (CAR7)'} thành công!\n\nBây giờ bạn có thể quay lại trang chủ và gạt nút ONLINE!`
        );
      }
    } catch (e: any) {
      console.error(e);
      const msg = e.response?.data?.message || 'Không thể kết nối đến máy chủ xác thực.';
      Alert.alert('Thất bại', msg);
    }
  };

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      let profileFetched = false;
      try {
        const res = await api.get('/api/drivers/me/profile');
        if (res.data && res.data.result) {
          profileFetched = true;
        }
      } catch (profileErr) {
        console.log('Profile get request failed:', profileErr);
      }

      if (!profileFetched) {
        const pendingType = await AsyncStorage.getItem('@pending_registration_vehicle_type');
        if (pendingType) {
          await AsyncStorage.removeItem('@pending_registration_vehicle_type');
          await handleVerifyKYC(pendingType as any);
        }
      }
    } catch (err) {
      console.log('Driver profile load failed');
    }
  };

  React.useEffect(() => {
    loadProfile();
  }, []);

  const handleLogout = async () => {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    await logoutDriver(refreshToken);
    await AsyncStorage.removeItem('driver_completed_jobs');
    await AsyncStorage.removeItem('driver_earnings');
    await AsyncStorage.removeItem('fcm_token');
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>TX</Text>
          </View>
          <Text style={styles.title}>Tài khoản tài xế</Text>
          <Text style={styles.subtitle}>Quản lý hồ sơ cá nhân, xác thực, bảo mật và các thiết lập khác.</Text>
        </View>

        <Text style={styles.sectionTitle}>Mục nhanh</Text>
        <View style={styles.menuContainer}>
          <AccountMenuItem
            icon={<User size={18} color="#4B5563" />}
            title="Hồ sơ cá nhân & Xác thực"
            subtitle="Chỉnh sửa thông tin tài xế và hồ sơ xe"
            onPress={() => router.push('/account/profile')}
          />
          <AccountMenuItem
            icon={<Shield size={18} color="#4B5563" />}
            title="Quyền riêng tư & Bảo mật"
            subtitle="Đổi mật khẩu và bảo vệ tài khoản"
            onPress={() => router.push('/account/security')}
          />
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Ngân hàng', 'Cài đặt liên kết ngân hàng nhận tiền...')}>
            <View style={styles.menuItemLeft}>
              <CreditCard size={18} color="#4B5563" />
              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>Tài khoản ngân hàng</Text>
                <Text style={styles.menuSubtitle}>Cập nhật tài khoản nhận tiền</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Tổng đài hỗ trợ', 'Đang kết nối tổng đài hỗ trợ Tài xế 24/7...')}>
            <View style={styles.menuItemLeft}>
              <PhoneCall size={18} color="#4B5563" />
              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>Tổng đài hỗ trợ đối tác</Text>
                <Text style={styles.menuSubtitle}>Liên hệ khi cần hỗ trợ nhanh</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Phương tiện</Text>
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIconCircle}>
            <Car size={20} color="#6366F1" />
          </View>
          <View style={styles.vehicleMeta}>
            <Text style={styles.vehicleLabel}>Quản lý phương tiện</Text>
            <Text style={styles.vehicleValue}>Vào mục Hồ sơ cá nhân & Xác thực để cập nhật thông tin xe</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>
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
  heroCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarTextLarge: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
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
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  menuTextBox: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
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
    lineHeight: 20,
  },
  logoutButton: {
    height: 54,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
});
