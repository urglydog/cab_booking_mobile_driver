import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, Car, AlertTriangle } from 'lucide-react-native';

import DriverProfileEditor, { DriverProfileFormState } from '@/features/account/components/DriverProfileEditor';
import { getDriverProfile } from '@/features/account/services/accountApi';

export default function DriverProfileScreen() {
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | string>('PENDING');
  const [profilePreview, setProfilePreview] = useState<Partial<DriverProfileFormState>>({});

  useEffect(() => {
    (async () => {
      try {
        const profile = await getDriverProfile();
        setVerificationStatus(profile?.verificationStatus || 'PENDING');
        setProfilePreview({
          fullName: profile?.fullName,
          vehicleType: profile?.vehicleType,
          vehiclePlate: profile?.vehiclePlate,
          vehicleModel: profile?.vehicleModel,
        });
      } catch (error) {
        console.log('Load profile preview failed');
      }
    })();
  }, []);

  const vehicleLabel = profilePreview.vehicleType === 'BIKE' ? 'Xe máy' : 'Xe ô tô';
  const vehicleInfo = profilePreview.vehiclePlate
    ? `${vehicleLabel} • ${profilePreview.vehiclePlate} (${profilePreview.vehicleModel || 'Chưa cập nhật'})`
    : 'Chưa có thông tin xe';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#374151" />
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{profilePreview.fullName?.charAt(0)?.toUpperCase() || 'TX'}</Text>
          </View>
          <Text style={styles.title}>{profilePreview.fullName || 'Hồ sơ tài xế'}</Text>
          <Text style={styles.subtitle}>Cập nhật thông tin cá nhân, giấy phép và khu vực hoạt động. Thông tin xe là cố định.</Text>
        </View>

        <Text style={styles.sectionTitle}>Trạng thái xác thực</Text>
        {verificationStatus === 'APPROVED' ? (
          <View style={styles.approvedCard}>
            <View style={styles.statusHeader}>
              <CheckCircle2 size={20} color="#10B981" />
              <Text style={styles.approvedTitle}>TÀI KHOẢN ĐÃ KÍCH HOẠT</Text>
            </View>
            <Text style={styles.statusText}>Hồ sơ của bạn đã được phê duyệt. Bạn có thể bật Online để nhận chuyến.</Text>
          </View>
        ) : (
          <View style={styles.pendingCard}>
            <View style={styles.statusHeader}>
              <AlertTriangle size={20} color="#F59E0B" />
              <Text style={styles.pendingTitle}>CHƯA KÍCH HOẠT</Text>
            </View>
            <Text style={styles.statusText}>Hãy hoàn thiện hồ sơ và lưu lại để đồng bộ với backend.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Phương tiện cố định</Text>
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleIconCircle}>
            <Car size={20} color="#6366F1" />
          </View>
          <View style={styles.vehicleMeta}>
            <Text style={styles.vehicleLabel}>Thông tin xe chỉ đọc</Text>
            <Text style={styles.vehicleValue}>{vehicleInfo}</Text>
          </View>
        </View>

        <DriverProfileEditor onProfileLoaded={(profile) => setProfilePreview({
          fullName: profile?.fullName,
          vehicleType: profile?.vehicleType,
          vehiclePlate: profile?.vehiclePlate,
          vehicleModel: profile?.vehicleModel,
        })} onSaved={() => Alert.alert('Thành công', 'Đã lưu thông tin tài xế.')} />
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
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
  pendingCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    marginBottom: 16,
  },
  approvedCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  approvedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  statusText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 18,
  },
  vehicleCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
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
});
