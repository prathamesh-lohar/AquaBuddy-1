import AsyncStorage from '@react-native-async-storage/async-storage';
import { WaterIntake, DayRecord, UserProfile, DeviceCalibration } from '../types';

const KEYS = {
  USER_PROFILE: 'user_profile',
  WATER_INTAKES: 'water_intakes',
  DAILY_RECORDS: 'daily_records',
  STREAK_COUNT: 'streak_count',
  DEVICE_CALIBRATION: 'device_calibration',
};

export const StorageService = {
  // User Profile
  async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  },

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  },

  // Water Intakes
  async saveTodayIntakes(intakes: WaterIntake[]): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingData = await AsyncStorage.getItem(KEYS.WATER_INTAKES);
      const allIntakes = existingData ? JSON.parse(existingData) : {};
      
      allIntakes[today] = intakes;
      await AsyncStorage.setItem(KEYS.WATER_INTAKES, JSON.stringify(allIntakes));
    } catch (error) {
      console.error('Error saving today intakes:', error);
    }
  },

  async getTodayIntakes(): Promise<WaterIntake[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await AsyncStorage.getItem(KEYS.WATER_INTAKES);
      const allIntakes = data ? JSON.parse(data) : {};
      
      return allIntakes[today] || [];
    } catch (error) {
      console.error('Error getting today intakes:', error);
      return [];
    }
  },

  // Daily Records
  async saveDayRecord(record: DayRecord): Promise<void> {
    try {
      const existingData = await AsyncStorage.getItem(KEYS.DAILY_RECORDS);
      const records = existingData ? JSON.parse(existingData) : {};
      
      records[record.date] = record;
      await AsyncStorage.setItem(KEYS.DAILY_RECORDS, JSON.stringify(records));
    } catch (error) {
      console.error('Error saving day record:', error);
    }
  },

  async getDayRecord(date: string): Promise<DayRecord | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.DAILY_RECORDS);
      const records = data ? JSON.parse(data) : {};
      
      return records[date] || null;
    } catch (error) {
      console.error('Error getting day record:', error);
      return null;
    }
  },

  async getWeekRecords(startDate: Date): Promise<DayRecord[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.DAILY_RECORDS);
      const records = data ? JSON.parse(data) : {};
      
      const weekRecords: DayRecord[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        weekRecords.push(records[dateString] || {
          date: dateString,
          total: 0,
          goal: 3000,
          intakes: [],
          achieved: false,
        });
      }
      
      return weekRecords;
    } catch (error) {
      console.error('Error getting week records:', error);
      return [];
    }
  },

  // Streak Count
  async saveStreakCount(count: number): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.STREAK_COUNT, count.toString());
    } catch (error) {
      console.error('Error saving streak count:', error);
    }
  },

  async getStreakCount(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(KEYS.STREAK_COUNT);
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      console.error('Error getting streak count:', error);
      return 0;
    }
  },

  // Device Calibration
  async saveDeviceCalibration(calibration: DeviceCalibration): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.DEVICE_CALIBRATION, JSON.stringify(calibration));
    } catch (error) {
      console.error('Error saving device calibration:', error);
    }
  },

  async getDeviceCalibration(): Promise<DeviceCalibration | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.DEVICE_CALIBRATION);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting device calibration:', error);
      return null;
    }
  },

  async clearDeviceCalibration(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEYS.DEVICE_CALIBRATION);
    } catch (error) {
      console.error('Error clearing device calibration:', error);
    }
  },
};