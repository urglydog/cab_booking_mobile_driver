import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Phone, Send, Shield } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@/hooks/useSocket';
import { Colors } from '@/constants/Colors';

type ChatMessage = {
  id: string;
  sender: 'CUSTOMER' | 'DRIVER';
  message: string;
  timestamp: number;
};

export default function DriverChatScreen() {
  const router = useRouter();
  const { bookingId, customerName } = useLocalSearchParams();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!bookingId) return;

    setMessages([
      {
        id: 'welcome-driver',
        sender: 'CUSTOMER',
        message: 'Xin chào, tôi đang chờ bạn ở điểm đón.',
        timestamp: Date.now() - 60000,
      },
    ]);
    setLoading(false);

    if (!socket) return;

    socket.emit('join_room', bookingId);

    const handleReceiveMessage = (data: any) => {
      if (String(data?.bookingId ?? '') !== String(bookingId)) return;
      const sender = String(data?.sender ?? data?.senderRole ?? '').toUpperCase() === 'CUSTOMER' ? 'CUSTOMER' : 'DRIVER';
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        sender,
        message: String(data?.message ?? ''),
        timestamp: data?.timestamp || Date.now(),
      };
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.emit('leave_room', bookingId);
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, bookingId]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !socket || !bookingId) return;

    socket.emit('send_message', {
      bookingId,
      sender: 'DRIVER',
      message: inputText.trim(),
      timestamp: Date.now(),
    });
    setInputText('');
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{String(customerName || 'Khách hàng')}</Text>
          <View style={styles.statusIndicator}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Phòng chat chuyến xe</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.phoneButton} onPress={() => router.back()}>
          <Phone size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <View style={styles.safetyBanner}>
        <Shield size={14} color="#059669" />
        <Text style={styles.safetyText}>Tin nhắn được đồng bộ theo phòng chuyến xe</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isDriver = item.sender === 'DRIVER';
          return (
            <View style={[styles.messageRow, isDriver ? styles.driverRow : styles.customerRow]}>
              {!isDriver && (
                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarText}>KH</Text>
                </View>
              )}
              <View style={[styles.bubble, isDriver ? styles.driverBubble : styles.customerBubble]}>
                <Text style={[styles.messageText, isDriver ? styles.driverText : styles.customerText]}>{item.message}</Text>
                <Text style={[styles.timeText, isDriver ? styles.driverTime : styles.customerTime]}>
                  {new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Send size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 4 },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
  onlineText: { fontSize: 11, color: '#6B7280' },
  phoneButton: { padding: 8, backgroundColor: '#EFF6FF', borderRadius: 20 },
  safetyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', paddingVertical: 6, paddingHorizontal: 16, gap: 6 },
  safetyText: { fontSize: 11, color: '#047857', fontWeight: '500' },
  listContent: { padding: 16, paddingBottom: 24 },
  messageRow: { flexDirection: 'row', marginBottom: 16, maxWidth: '80%' },
  customerRow: { alignSelf: 'flex-start' },
  driverRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  chatAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  chatAvatarText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  customerBubble: { backgroundColor: '#FFF', borderTopLeftRadius: 2, borderWidth: 1, borderColor: '#E5E7EB' },
  driverBubble: { backgroundColor: '#2563EB', borderTopRightRadius: 2 },
  messageText: { fontSize: 14, lineHeight: 20 },
  customerText: { color: '#111827' },
  driverText: { color: '#FFF' },
  timeText: { fontSize: 9, marginTop: 4, textAlign: 'right' },
  customerTime: { color: '#9CA3AF' },
  driverTime: { color: '#93C5FD' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  textInput: { flex: 1, height: 44, backgroundColor: '#F9FAFB', borderRadius: 22, paddingHorizontal: 16, fontSize: 14, color: '#111827', marginRight: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#93C5FD' },
});
