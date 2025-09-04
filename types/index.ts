export interface WaterIntake {
  id: string;
  amount: number;
  timestamp: Date;
  date: string; // YYYY-MM-DD format
}

export interface DayRecord {
  date: string;
  total: number;
  goal: number;
  intakes: WaterIntake[];
  achieved: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  dailyGoal: number;
  unit: 'ml' | 'oz';
  notifications: boolean;
  reminderInterval: number; // hours
}

export interface DeviceCalibration {
  emptyBaseline: number;
  fullBaseline: number;
  bottleCapacity: number; // in ml
  calibrationDate: string;
  isCalibrated: boolean;
}

export interface SensorData {
  distance: number;
  waterLevel: number; // calculated percentage
  timestamp: number;
  device: string;
  status: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  reward: string;
  icon: string;
}

export interface AppState {
  user: UserProfile | null;
  todayIntake: WaterIntake[];
  dailyGoal: number;
  currentStreak: number;
  isLoading: boolean;
}