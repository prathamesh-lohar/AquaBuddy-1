import AsyncStorage from '@react-native-async-storage/async-storage';
import { WaterIntake, DayRecord, UserProfile, DeviceCalibration, Patient, CaretakerProfile } from '../types';

const KEYS = {
  USER_PROFILE: 'user_profile',
  WATER_INTAKES: 'water_intakes',
  DAILY_RECORDS: 'daily_records',
  STREAK_COUNT: 'streak_count',
  DEVICE_CALIBRATION: 'device_calibration',
  CARETAKER_PROFILE: 'caretaker_profile',
  PATIENTS: 'patients',
  ACTIVE_PATIENT: 'active_patient',
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

  // Caretaker Profile Management
  async saveCaretakerProfile(profile: CaretakerProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.CARETAKER_PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error('Error saving caretaker profile:', error);
    }
  },

  async getCaretakerProfile(): Promise<CaretakerProfile | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.CARETAKER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting caretaker profile:', error);
      return null;
    }
  },

  // Patient Management
  async savePatients(patients: Patient[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PATIENTS, JSON.stringify(patients));
    } catch (error) {
      console.error('Error saving patients:', error);
    }
  },

  async getPatients(): Promise<Patient[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PATIENTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting patients:', error);
      return [];
    }
  },

  async addPatient(patient: Patient): Promise<void> {
    try {
      const patients = await this.getPatients();
      const newPatient = {
        ...patient,
        id: patient.id || Date.now().toString(),
        createdAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        isConnected: false,
        currentWaterLevel: 0,
        todayIntakes: [],
      };
      patients.push(newPatient);
      await this.savePatients(patients);
    } catch (error) {
      console.error('Error adding patient:', error);
    }
  },

  async updatePatient(patientId: string, updates: Partial<Patient>): Promise<void> {
    try {
      const patients = await this.getPatients();
      const index = patients.findIndex(p => p.id === patientId);
      if (index !== -1) {
        patients[index] = {
          ...patients[index],
          ...updates,
          lastUpdated: new Date().toISOString(),
        };
        await this.savePatients(patients);
      }
    } catch (error) {
      console.error('Error updating patient:', error);
    }
  },

  async deletePatient(patientId: string): Promise<void> {
    try {
      const patients = await this.getPatients();
      const filtered = patients.filter(p => p.id !== patientId);
      await this.savePatients(filtered);
    } catch (error) {
      console.error('Error deleting patient:', error);
    }
  },

  async getPatientById(patientId: string): Promise<Patient | null> {
    try {
      const patients = await this.getPatients();
      return patients.find(p => p.id === patientId) || null;
    } catch (error) {
      console.error('Error getting patient by id:', error);
      return null;
    }
  },

  // Active Patient Management
  async setActivePatient(patientId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.ACTIVE_PATIENT, patientId);
    } catch (error) {
      console.error('Error setting active patient:', error);
    }
  },

  async getActivePatient(): Promise<Patient | null> {
    try {
      const patientId = await AsyncStorage.getItem(KEYS.ACTIVE_PATIENT);
      if (patientId) {
        return await this.getPatientById(patientId);
      }
      return null;
    } catch (error) {
      console.error('Error getting active patient:', error);
      return null;
    }
  },

  // Patient Real-time Data Updates
  async updatePatientWaterLevel(patientId: string, waterLevel: number, sensorData?: any): Promise<void> {
    try {
      const updates: Partial<Patient> = {
        currentWaterLevel: waterLevel,
        lastSync: new Date().toISOString(),
        isConnected: true,
      };

      // If water level changed significantly, add it as an intake
      const patient = await this.getPatientById(patientId);
      if (patient && patient.currentWaterLevel > waterLevel) {
        const intakeAmount = patient.currentWaterLevel - waterLevel;
        if (intakeAmount > 50) { // Only record significant changes
          const newIntake: WaterIntake = {
            id: Date.now().toString(),
            amount: Math.round(intakeAmount),
            timestamp: new Date(),
            date: new Date().toISOString().split('T')[0],
          };
          
          const todayIntakes = [...(patient.todayIntakes || []), newIntake];
          updates.todayIntakes = todayIntakes;
        }
      }

      await this.updatePatient(patientId, updates);
    } catch (error) {
      console.error('Error updating patient water level:', error);
    }
  },

  async updatePatientDeviceStatus(patientId: string, isConnected: boolean): Promise<void> {
    try {
      await this.updatePatient(patientId, { isConnected });
    } catch (error) {
      console.error('Error updating patient device status:', error);
    }
  },

  // Calibration Management per Patient
  async savePatientCalibration(patientId: string, calibration: DeviceCalibration): Promise<void> {
    try {
      await this.updatePatient(patientId, { deviceCalibration: calibration });
    } catch (error) {
      console.error('Error saving patient calibration:', error);
    }
  },

  async getPatientCalibration(patientId: string): Promise<DeviceCalibration | null> {
    try {
      const patient = await this.getPatientById(patientId);
      return patient?.deviceCalibration || null;
    } catch (error) {
      console.error('Error getting patient calibration:', error);
      return null;
    }
  },
};