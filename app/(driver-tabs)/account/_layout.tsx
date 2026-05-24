import React from 'react';
import { Stack } from 'expo-router';

export default function AccountStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="security" />
    </Stack>
  );
}