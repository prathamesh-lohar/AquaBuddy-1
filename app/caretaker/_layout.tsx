import { Stack } from 'expo-router';

export default function CaretakerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="users" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="analytics" />
    </Stack>
  );
}