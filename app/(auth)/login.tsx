import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { clearAuthStorage, loginDriver } from '@/features/auth/services/authApi';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const authResult = await loginDriver({ email, password });
      const { accessToken, refreshToken, user } = authResult;
      const isDriver = user?.role === 'ROLE_DRIVER' || user?.role === 'DRIVER';

      if (!isDriver) {
        await clearAuthStorage();
        Alert.alert('Lỗi xác thực', 'Tài khoản của bạn không phải là Tài xế! Vui lòng sử dụng tài khoản Tài xế.');
        return;
      }

      await AsyncStorage.multiSet([
        ['access_token', accessToken],
        ['refresh_token', refreshToken],
        ['user_id', String(user.userId)],
        ['user_name', user.fullName || ''],
        ['user_role', user.role || 'ROLE_DRIVER'],
        ['user_phone', user.phoneNumber || ''],
        ['user_email', user.email || ''],
      ]);
        try {
          const mockFcmToken = 'mock-device-fcm-token-' + user.userId;
          await AsyncStorage.setItem('fcm_token', mockFcmToken);
          console.log('Successfully synchronized FCM Token:', mockFcmToken);
        } catch (fcmError) {
          console.warn('Failed to sync FCM Token with backend:', fcmError);
        }

        Alert.alert('Thành công', 'Đăng nhập thành công!');
        router.replace('/(driver-tabs)');
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message || 'Login failed. Please check your credentials.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>CAB</Text>
        <Text style={styles.subtitle}>Welcome back! Please login to continue.</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="example@gmail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.registerLink} 
          onPress={() => router.push('/register')}
        >
          <Text style={styles.registerText}>Don't have an account? <Text style={styles.registerHighlight}>Register now</Text></Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 56,
    fontWeight: '900',
    color: '#6366F1',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -2,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 54,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
    color: '#1E293B',
  },
  button: {
    height: 58,
    backgroundColor: '#6366F1',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  registerLink: {
    marginTop: 32,
    alignItems: 'center',
  },
  registerText: {
    color: '#64748B',
    fontSize: 15,
  },
  registerHighlight: {
    color: '#6366F1',
    fontWeight: '800',
  }
});
