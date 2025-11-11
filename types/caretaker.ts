// Caretaker Types
export interface Caretaker {
  id: string;
  email: string;
  name: string;
  role: 'NURSE' | 'DOCTOR' | 'FAMILY' | 'CAREGIVER';
  facilityId?: string;
  facilityName?: string;
  permissions: string[];
  profileImage?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientUser {
  id: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  medicalConditions: string[];
  caretakerId: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  hydrationGoal: number; // ml per day
  deviceIds: string[];
  isActive: boolean;
  profileImage?: string;
  roomNumber?: string;
  bedNumber?: string;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaretakerUserRelationship {
  id: string;
  caretakerId: string;
  userId: string;
  relationshipType: 'PRIMARY' | 'SECONDARY' | 'EMERGENCY';
  permissions: {
    canViewData: boolean;
    canSetGoals: boolean;
    canReceiveAlerts: boolean;
    canManageDevice: boolean;
    canEditProfile: boolean;
  };
  createdAt: Date;
}

export interface HydrationAlert {
  id: string;
  userId: string;
  userName: string;
  caretakerIds: string[];
  alertType: 'DEHYDRATION' | 'MISSED_GOAL' | 'DEVICE_OFFLINE' | 'EMERGENCY' | 'LOW_BATTERY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export interface DailyConsumption {
  userId: string;
  date: string; // YYYY-MM-DD format
  totalConsumed: number; // ml
  goal: number; // ml
  percentage: number;
  logs: ConsumptionLog[];
}

export interface ConsumptionLog {
  id: string;
  userId: string;
  deviceId: string;
  amount: number; // ml
  timestamp: Date;
  batteryLevel?: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export interface CaretakerDashboardData {
  totalPatients: number;
  activePatients: number;
  criticalAlerts: number;
  averageHydration: number;
  todaysConsumption: DailyConsumption[];
  recentAlerts: HydrationAlert[];
  offlineDevices: number;
}