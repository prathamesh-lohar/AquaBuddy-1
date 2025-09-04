import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../services/NotificationService';

interface NotifyButtonProps {
  onPress?: () => void;
}

export const NotifyButton: React.FC<NotifyButtonProps> = ({ onPress }) => {
  const handlePress = async () => {
    try {
      // Initialize notification service if needed
      const initialized = await notificationService.initialize();
      if (!initialized) {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings to receive hydration reminders.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Send immediate notification
      await notificationService.sendWaterReminderNotification();

      // Show success feedback
      Alert.alert(
        'Notification Sent! 💧',
        'Check your notification bar for the hydration reminder.',
        [{ text: 'OK' }]
      );

      // Call optional callback
      if (onPress) {
        onPress();
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert(
        'Notification Error',
        'Failed to send notification. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Ionicons name="notifications" size={20} color="#fff" />
      <Text style={styles.buttonText}>Notify Me</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
