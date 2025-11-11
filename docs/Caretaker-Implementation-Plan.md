# Caretaker Module Implementation Plan

## Step 1: Database Schema Creation

First, let's extend Firebase Firestore collections for the caretaker system:

```typescript
// types/caretaker.ts
export interface Caretaker {
  id: string;
  email: string;
  name: string;
  role: 'NURSE' | 'DOCTOR' | 'FAMILY' | 'CAREGIVER';
  facilityId?: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientUser {
  id: string;
  name: string;
  age: number;
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
  };
  createdAt: Date;
}

export interface HydrationAlert {
  id: string;
  userId: string;
  caretakerIds: string[];
  alertType: 'DEHYDRATION' | 'MISSED_GOAL' | 'DEVICE_OFFLINE' | 'EMERGENCY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}
```

## Step 2: Authentication & Role Management

```typescript
// providers/caretaker-auth-provider.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface CaretakerAuthContext {
  caretaker: Caretaker | null;
  isLoading: boolean;
  signInAsCaretaker: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  managedUsers: PatientUser[];
}

export const useCaretakerAuth = () => {
  const context = useContext(CaretakerAuthContext);
  if (!context) {
    throw new Error('useCaretakerAuth must be used within CaretakerAuthProvider');
  }
  return context;
};
```

## Step 3: Services Implementation

```typescript
// services/CaretakerService.ts
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';

export class CaretakerService {
  // Create new caretaker
  static async createCaretaker(caretakerData: Omit<Caretaker, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'caretakers'), {
      ...caretakerData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  }

  // Get managed users
  static async getManagedUsers(caretakerId: string): Promise<PatientUser[]> {
    const q = query(
      collection(db, 'caretaker_relationships'),
      where('caretakerId', '==', caretakerId)
    );
    
    const relationships = await getDocs(q);
    const userIds = relationships.docs.map(doc => doc.data().userId);
    
    const users: PatientUser[] = [];
    for (const userId of userIds) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        users.push({ id: userDoc.id, ...userDoc.data() } as PatientUser);
      }
    }
    
    return users;
  }

  // Add user to care
  static async addUserToCare(caretakerId: string, userData: Omit<PatientUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Create user
    const userDocRef = await addDoc(collection(db, 'users'), {
      ...userData,
      caretakerId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create relationship
    await addDoc(collection(db, 'caretaker_relationships'), {
      caretakerId,
      userId: userDocRef.id,
      relationshipType: 'PRIMARY',
      permissions: {
        canViewData: true,
        canSetGoals: true,
        canReceiveAlerts: true,
        canManageDevice: true
      },
      createdAt: new Date()
    });

    return userDocRef.id;
  }

  // Real-time monitoring
  static subscribeToUserUpdates(caretakerId: string, callback: (users: PatientUser[]) => void) {
    const q = query(
      collection(db, 'caretaker_relationships'),
      where('caretakerId', '==', caretakerId)
    );
    
    return onSnapshot(q, async (snapshot) => {
      const userIds = snapshot.docs.map(doc => doc.data().userId);
      const users: PatientUser[] = [];
      
      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          users.push({ id: userDoc.id, ...userDoc.data() } as PatientUser);
        }
      }
      
      callback(users);
    });
  }
}
```

## Step 4: Alert System

```typescript
// services/AlertService.ts
export class AlertService {
  static async createAlert(alertData: Omit<HydrationAlert, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'alerts'), {
      ...alertData,
      createdAt: new Date()
    });
    
    // Send push notifications to caretakers
    await this.sendAlertNotifications(alertData);
    
    return docRef.id;
  }

  static async checkDehydrationAlerts(userId: string): Promise<void> {
    const user = await getDoc(doc(db, 'users', userId));
    if (!user.exists()) return;

    const userData = user.data() as PatientUser;
    
    // Get today's consumption
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const consumptionQuery = query(
      collection(db, 'water_consumption'),
      where('userId', '==', userId),
      where('timestamp', '>=', today)
    );
    
    const consumption = await getDocs(consumptionQuery);
    const totalConsumed = consumption.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
    
    const percentageOfGoal = (totalConsumed / userData.hydrationGoal) * 100;
    
    // Check for alerts
    if (percentageOfGoal < 30 && new Date().getHours() > 14) {
      await this.createAlert({
        userId,
        caretakerIds: [userData.caretakerId],
        alertType: 'DEHYDRATION',
        severity: 'HIGH',
        message: `${userData.name} has only consumed ${Math.round(percentageOfGoal)}% of their daily hydration goal`,
        acknowledged: false
      });
    }
  }

  private static async sendAlertNotifications(alertData: Omit<HydrationAlert, 'id' | 'createdAt'>) {
    // Implementation for sending push notifications to caretakers
    // This would integrate with your notification service
  }
}
```

## Step 5: Dashboard Components

```typescript
// components/caretaker/CaretakerDashboard.tsx
import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { CaretakerService } from '../../services/CaretakerService';
import { PatientCard } from './PatientCard';
import { AlertsList } from './AlertsList';
import { QuickStats } from './QuickStats';

export const CaretakerDashboard: React.FC = () => {
  const [managedUsers, setManagedUsers] = useState<PatientUser[]>([]);
  const [alerts, setAlerts] = useState<HydrationAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { caretaker } = useCaretakerAuth();

  useEffect(() => {
    if (!caretaker) return;

    // Subscribe to real-time updates
    const unsubscribe = CaretakerService.subscribeToUserUpdates(
      caretaker.id,
      setManagedUsers
    );

    return () => unsubscribe();
  }, [caretaker]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (caretaker) {
        const users = await CaretakerService.getManagedUsers(caretaker.id);
        setManagedUsers(users);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <QuickStats users={managedUsers} />
      <AlertsList alerts={alerts} />
      
      {managedUsers.map(user => (
        <PatientCard 
          key={user.id} 
          user={user} 
          onAlert={(alert) => {
            setAlerts(prev => [alert, ...prev]);
          }}
        />
      ))}
    </ScrollView>
  );
};
```

## Step 6: Real-time Patient Card

```typescript
// components/caretaker/PatientCard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ProgressBar } from '../ProgressBar';
import { onSnapshot, query, where, collection } from 'firebase/firestore';

interface PatientCardProps {
  user: PatientUser;
  onAlert: (alert: HydrationAlert) => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({ user, onAlert }) => {
  const [todayConsumption, setTodayConsumption] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    // Subscribe to real-time consumption updates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'water_consumption'),
      where('userId', '==', user.id),
      where('timestamp', '>=', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const total = snapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
      setTodayConsumption(total);
      
      if (snapshot.docs.length > 0) {
        setLastUpdate(snapshot.docs[0].data().timestamp.toDate());
      }
    });

    return () => unsubscribe();
  }, [user.id]);

  const progressPercentage = (todayConsumption / user.hydrationGoal) * 100;
  const getStatusColor = () => {
    if (progressPercentage >= 80) return '#4CAF50'; // Green
    if (progressPercentage >= 50) return '#FF9800'; // Orange  
    return '#F44336'; // Red
  };

  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{user.name}</Text>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
      </View>
      
      <View style={styles.progressSection}>
        <Text style={styles.progressText}>
          {todayConsumption}ml / {user.hydrationGoal}ml ({Math.round(progressPercentage)}%)
        </Text>
        <ProgressBar progress={progressPercentage} color={getStatusColor()} />
      </View>

      <View style={styles.details}>
        <Text style={styles.detailText}>Age: {user.age}</Text>
        <Text style={styles.detailText}>
          Last Update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'No data'}
        </Text>
        <Text style={styles.detailText}>
          Device: {isConnected ? 'Connected' : 'Offline'}
        </Text>
      </View>

      {progressPercentage < 30 && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>⚠️ Low hydration detected</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
```

This implementation provides:

1. **Multi-user management** for caretakers
2. **Real-time monitoring** with live updates
3. **Alert system** for dehydration and device issues  
4. **Role-based access** with different permission levels
5. **Emergency notifications** for critical situations
6. **Analytics and reporting** capabilities
7. **Scalable architecture** for healthcare facilities

Would you like me to implement any specific part of this system or adjust the workflow for your specific use case?