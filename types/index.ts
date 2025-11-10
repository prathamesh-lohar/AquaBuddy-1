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

export interface OnboardingData {
  // Step 1: Personal Info
  name: string;
  birthDate: Date;
  sex: 'male' | 'female' | 'other';
  weight: number; // in kg
  height: number; // in cm
  
  // Step 2: Lifestyle
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  sleepSchedule: {
    bedTime: string; // HH:MM format
    wakeTime: string; // HH:MM format
  };
  healthConditions: string[];
  
  // Step 3: Preferences
  unit: 'ml' | 'oz';
  notifications: boolean;
  reminderInterval: number; // hours
  
  // Step 4: Role
  role: 'personal' | 'caretaker';
  
  // Calculated daily goal based on weight, activity, etc.
  dailyGoal: number;
}

export interface UserProfile extends OnboardingData {
  id: string;
  email: string;
  createdAt: Date;
  onboardingCompleted: boolean;
  lastUpdated: Date;
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