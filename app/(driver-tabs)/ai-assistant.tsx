import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bot, Send, ShieldCheck, TrendingUp } from 'lucide-react-native';
import api from '@/services/api';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'driver';
  content: string;
};

const QUICK_ACTIONS = [
  'Kiểm tra thu nhập hôm nay',
  'Vì sao số cuốc tăng mà tiền chưa lên?',
  'Khu vực nào đang nhiều khách?',
  'Nhắc an toàn khi nhận cuốc',
];

export default function DriverAIAssistantScreen() {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Tôi là trợ lý vận hành cho tài xế.\n• Kiểm tra thu nhập\n• Gợi ý khu vực đông khách\n• Nhắc an toàn khi chạy xe',
    },
  ]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const driverMessage: ChatMessage = {
      id: `${Date.now()}_driver`,
      role: 'driver',
      content,
    };
    setMessages(prev => [...prev, driverMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/v1/ai-agent/chat', { message: content });
      const reply = response.data?.reply || 'Tôi chưa xử lý được yêu cầu này.';
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}_assistant`,
          role: 'assistant',
          content: reply,
        },
      ]);
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}_error`,
          role: 'assistant',
          content: status === 403
            ? 'Bạn không có quyền dùng chức năng quản trị.'
            : detail || 'Không kết nối được AI Agent. Thử lại sau.',
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isDriver = item.role === 'driver';
    return (
      <View style={[styles.messageRow, isDriver && styles.driverRow]}>
        {!isDriver && (
          <View style={styles.avatar}>
            <Bot size={18} color="#FFF" />
          </View>
        )}
        <View style={[styles.bubble, isDriver ? styles.driverBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isDriver && styles.driverText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <ShieldCheck size={24} color="#FFF" />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Trợ lý tài xế</Text>
          <Text style={styles.subtitle}>Trả lời ngắn, ưu tiên an toàn</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map(action => (
          <TouchableOpacity
            key={action}
            style={styles.quickChip}
            onPress={() => sendMessage(action)}
            disabled={loading}
          >
            <TrendingUp size={14} color="#4F46E5" />
            <Text style={styles.quickText}>{action}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={styles.loadingText}>Đang kiểm tra...</Text>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            style={styles.input}
            placeholder="Hỏi nhanh về thu nhập, hotspot..."
            placeholderTextColor="#9CA3AF"
            multiline
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Send size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { marginLeft: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  messageList: { padding: 16, paddingBottom: 10 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  driverRow: { justifyContent: 'flex-end' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 5 },
  driverBubble: { backgroundColor: '#4F46E5', borderBottomRightRadius: 5 },
  messageText: { fontSize: 14, lineHeight: 20, color: '#1F2937', fontWeight: '600' },
  driverText: { color: '#FFF' },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
  },
  quickText: { fontSize: 12, color: '#4F46E5', fontWeight: '700' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  loadingText: { fontSize: 12, color: '#4F46E5', fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    backgroundColor: '#FFF',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  sendButtonDisabled: { backgroundColor: '#C7D2FE' },
});
