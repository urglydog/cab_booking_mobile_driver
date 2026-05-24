import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { getDriverProfile, updateDriverProfile } from '@/features/account/services/accountApi';

export type DriverProfileFormState = {
  fullName: string;
  phoneNumber: string;
  avatarUrl: string;
  licenseNumber: string;
  vehicleType: string;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleColor: string;
  serviceArea: string;
};

const emptyState: DriverProfileFormState = {
  fullName: '',
  phoneNumber: '',
  avatarUrl: '',
  licenseNumber: '',
  vehicleType: 'CAR4',
  vehiclePlate: '',
  vehicleModel: '',
  vehicleColor: '',
  serviceArea: '',
};

type Props = {
  onProfileLoaded?: (profile: any) => void;
  onSaved?: () => void;
};

export default function DriverProfileEditor({ onProfileLoaded, onSaved }: Props) {
  const [profileForm, setProfileForm] = useState<DriverProfileFormState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const profile = await getDriverProfile();
      setProfileForm({
        fullName: profile?.fullName || '',
        phoneNumber: profile?.phoneNumber || '',
        avatarUrl: profile?.avatarUrl || '',
        licenseNumber: profile?.licenseNumber || '',
        vehicleType: profile?.vehicleType || 'CAR4',
        vehiclePlate: profile?.vehiclePlate || '',
        vehicleModel: profile?.vehicleModel || '',
        vehicleColor: profile?.vehicleColor || '',
        serviceArea: profile?.serviceArea || '',
      });
      onProfileLoaded?.(profile);
    } catch (error: any) {
      Alert.alert('Thất bại', error?.response?.data?.message || 'Không thể tải hồ sơ tài xế.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateDriverProfile(profileForm);
      Alert.alert('Thành công', 'Đã cập nhật thông tin tài xế.');
      await loadProfile();
      onSaved?.();
    } catch (error: any) {
      Alert.alert('Thất bại', error?.response?.data?.message || 'Không thể cập nhật hồ sơ tài xế.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Chỉnh sửa thông tin tài xế</Text>
      <Text style={styles.subtitle}>Bạn chỉ có thể chỉnh sửa thông tin cá nhân. Thông tin xe là cố định và được quản lý riêng.</Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#6366F1" />
        </View>
      ) : (
        <>
          <Field label="Họ và tên" value={profileForm.fullName} onChangeText={(text) => setProfileForm((current) => ({ ...current, fullName: text }))} />
          <Field label="Số điện thoại" value={profileForm.phoneNumber} onChangeText={(text) => setProfileForm((current) => ({ ...current, phoneNumber: text }))} keyboardType="phone-pad" />
          <Field label="Avatar URL" value={profileForm.avatarUrl} onChangeText={(text) => setProfileForm((current) => ({ ...current, avatarUrl: text }))} autoCapitalize="none" />
          <Field label="Số GPLX" value={profileForm.licenseNumber} onChangeText={(text) => setProfileForm((current) => ({ ...current, licenseNumber: text }))} />

          <Field label="Khu vực hoạt động" value={profileForm.serviceArea} onChangeText={(text) => setProfileForm((current) => ({ ...current, serviceArea: text }))} />

          <View style={styles.fixedNotice}>
            <Text style={styles.fixedNoticeTitle}>Thông tin xe cố định</Text>
            <Text style={styles.fixedNoticeText}>Loại xe, biển số, dòng xe và màu xe được đồng bộ từ hệ thống và không thể chỉnh sửa tại đây.</Text>
          </View>

          <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>LƯU THÔNG TIN TÀI XẾ</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...inputProps } = props;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor="#9CA3AF" {...inputProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  loadingBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  fixedNotice: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  fixedNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730A3',
    marginBottom: 4,
  },
  fixedNoticeText: {
    fontSize: 12,
    color: '#4F46E5',
    lineHeight: 18,
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});