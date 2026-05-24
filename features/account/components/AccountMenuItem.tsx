import React from 'react';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

export default function AccountMenuItem({ icon, title, subtitle, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.left}>
        <View style={styles.iconBox}>{icon}</View>
        <View style={styles.textBox}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <ChevronRight size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBox: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});