import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private isInitialized = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) return true;

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions not granted');
        return false;
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('hydration-reminders', {
          name: 'Hydration Reminders',
          description: 'Reminders to drink water and stay hydrated',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          lightColor: '#4A90E2',
        });
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  async sendWaterReminderNotification(): Promise<void> {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) return;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💧 Time to Hydrate!',
          body: '⏰ Time to drink water and stay hydrated!',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          categoryIdentifier: 'hydration',
        },
        trigger: null, // Show immediately
      });

      console.log('Water reminder notification sent:', notificationId);
    } catch (error) {
      console.error('Error sending water reminder notification:', error);
    }
  }

  async scheduleHourlyReminders(intervalHours: number = 2): Promise<void> {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) return;
      }

      // Cancel existing scheduled notifications
      await this.cancelScheduledReminders();

      // Schedule notifications for the next 12 hours (during waking hours)
      const wakingHours = 12; // 8 AM to 8 PM
      const notifications = [];

      for (let i = 1; i <= Math.floor(wakingHours / intervalHours); i++) {
        const trigger: Notifications.TimeIntervalTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: intervalHours * 60 * 60 * i,
          repeats: false,
        };

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: '💧 Hydration Reminder',
            body: 'Don\'t forget to drink water! Stay healthy and hydrated.',
            sound: 'default',
            data: { type: 'scheduled_reminder' },
          },
          trigger,
        });

        notifications.push(notificationId);
      }

      console.log(`Scheduled ${notifications.length} hydration reminders`);
    } catch (error) {
      console.error('Error scheduling hourly reminders:', error);
    }
  }

  async cancelScheduledReminders(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('Cancelled all scheduled notifications');
    } catch (error) {
      console.error('Error cancelling scheduled notifications:', error);
    }
  }

  async sendGoalAchievedNotification(totalIntake: number, goal: number): Promise<void> {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 Goal Achieved!',
          body: `Congratulations! You've reached your daily hydration goal of ${goal}ml!`,
          sound: 'default',
          data: { type: 'goal_achieved', totalIntake, goal },
        },
        trigger: null,
      });

      console.log('Goal achieved notification sent');
    } catch (error) {
      console.error('Error sending goal achieved notification:', error);
    }
  }

  async sendCalibrationReminderNotification(): Promise<void> {
    try {
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔧 Device Setup Required',
          body: 'Please calibrate your smart water bottle to start tracking accurately',
          sound: 'default',
          data: { type: 'calibration_reminder' },
        },
        trigger: null,
      });

      console.log('Calibration reminder notification sent');
    } catch (error) {
      console.error('Error sending calibration reminder notification:', error);
    }
  }

  async getPermissionStatus(): Promise<string> {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }
}

export const notificationService = NotificationService.getInstance();
