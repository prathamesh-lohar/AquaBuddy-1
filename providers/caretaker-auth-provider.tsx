import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '../config/firebase';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { Caretaker, PatientUser, HydrationAlert } from '../types/caretaker';

interface CaretakerAuthContextType {
  caretaker: Caretaker | null;
  managedUsers: PatientUser[];
  alerts: HydrationAlert[];
  isLoading: boolean;
  isCaretaker: boolean;
  signInAsCaretaker: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshData: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  addPatient: (patientData: Omit<PatientUser, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
}

const CaretakerAuthContext = createContext<CaretakerAuthContextType | null>(null);

interface CaretakerAuthProviderProps {
  children: ReactNode;
}

export const CaretakerAuthProvider: React.FC<CaretakerAuthProviderProps> = ({ children }) => {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [managedUsers, setManagedUsers] = useState<PatientUser[]>([]);
  const [alerts, setAlerts] = useState<HydrationAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Listen to authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadCaretakerData(firebaseUser.uid);
      } else {
        setCaretaker(null);
        setManagedUsers([]);
        setAlerts([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load caretaker data from Firestore
  const loadCaretakerData = async (uid: string) => {
    try {
      // Check if user is a caretaker
      const caretakerDoc = await getDoc(doc(db, 'caretakers', uid));
      
      if (caretakerDoc.exists()) {
        const caretakerData = {
          id: caretakerDoc.id,
          ...caretakerDoc.data(),
          createdAt: caretakerDoc.data().createdAt?.toDate() || new Date(),
          updatedAt: caretakerDoc.data().updatedAt?.toDate() || new Date(),
        } as Caretaker;
        
        setCaretaker(caretakerData);
        
        // Load managed users and alerts
        await loadManagedUsers(caretakerData.id);
        await loadAlerts(caretakerData.id);
      } else {
        // User is not a caretaker, clear caretaker data
        setCaretaker(null);
        setManagedUsers([]);
        setAlerts([]);
      }
    } catch (error) {
      console.error('Error loading caretaker data:', error);
      setCaretaker(null);
    }
  };

  // Load managed users
  const loadManagedUsers = async (caretakerId: string) => {
    try {
      // In development mode, don't reload from Firestore - preserve local state
      if (__DEV__) {
        console.log('🔄 loadManagedUsers in dev mode - skipping to preserve local state');
        return;
      }

      // Get caretaker-user relationships
      const relationshipsQuery = query(
        collection(db, 'caretaker_relationships'),
        where('caretakerId', '==', caretakerId)
      );
      
      const relationshipsSnapshot = await getDocs(relationshipsQuery);
      const userIds = relationshipsSnapshot.docs.map(doc => doc.data().userId);
      
      if (userIds.length === 0) {
        setManagedUsers([]);
        return;
      }

      // Get user details
      const users: PatientUser[] = [];
      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, 'patient_users', userId));
        if (userDoc.exists()) {
          users.push({
            id: userDoc.id,
            ...userDoc.data(),
            createdAt: userDoc.data().createdAt?.toDate() || new Date(),
            updatedAt: userDoc.data().updatedAt?.toDate() || new Date(),
            lastSeen: userDoc.data().lastSeen?.toDate(),
          } as PatientUser);
        }
      }
      
      setManagedUsers(users);

      // Set up real-time listener for managed users
      setupManagedUsersListener(userIds);
    } catch (error) {
      console.error('Error loading managed users:', error);
      setManagedUsers([]);
    }
  };

  // Set up real-time listener for managed users
  const setupManagedUsersListener = (userIds: string[]) => {
    if (userIds.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    userIds.forEach(userId => {
      const unsubscribe = onSnapshot(doc(db, 'patient_users', userId), (doc) => {
        if (doc.exists()) {
          const updatedUser = {
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
            lastSeen: doc.data().lastSeen?.toDate(),
          } as PatientUser;

          setManagedUsers(prev => 
            prev.map(user => user.id === userId ? updatedUser : user)
          );
        }
      });
      unsubscribes.push(unsubscribe);
    });

    // Cleanup function will be handled by the component unmount
    return () => unsubscribes.forEach(unsub => unsub());
  };

  // Load alerts
  const loadAlerts = async (caretakerId: string) => {
    try {
      const alertsQuery = query(
        collection(db, 'alerts'),
        where('caretakerIds', 'array-contains', caretakerId),
        where('acknowledged', '==', false)
      );
      
      const alertsSnapshot = await getDocs(alertsQuery);
      const alertsData = alertsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        acknowledgedAt: doc.data().acknowledgedAt?.toDate(),
      })) as HydrationAlert[];
      
      setAlerts(alertsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));

      // Set up real-time listener for alerts
      setupAlertsListener(caretakerId);
    } catch (error) {
      console.error('Error loading alerts:', error);
      setAlerts([]);
    }
  };

  // Set up real-time listener for alerts
  const setupAlertsListener = (caretakerId: string) => {
    const alertsQuery = query(
      collection(db, 'alerts'),
      where('caretakerIds', 'array-contains', caretakerId)
    );
    
    return onSnapshot(alertsQuery, (snapshot) => {
      const alertsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        acknowledgedAt: doc.data().acknowledgedAt?.toDate(),
      })) as HydrationAlert[];
      
      setAlerts(alertsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });
  };

  // Sign in as caretaker
  const signInAsCaretaker = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Development mode - mock credentials
      if (__DEV__ && email === 'doctor@healthcare.com' && password === 'healthcare123') {
        // Create a mock caretaker for development
        const mockCaretaker: Caretaker = {
          id: 'dev_caretaker_1',
          email: 'doctor@healthcare.com',
          name: 'Dr. Sarah Johnson',
          role: 'DOCTOR',
          facilityName: 'Sunrise Care Center',
          permissions: ['VIEW_PATIENTS', 'EDIT_PATIENTS', 'RECEIVE_ALERTS', 'MANAGE_DEVICES'],
          phone: '+1 (555) 123-4567',
          createdAt: new Date('2023-01-15'),
          updatedAt: new Date()
        };

        // Start with empty patient list for testing patient addition
        const mockManagedUsers: PatientUser[] = [];
        
        // Create empty alerts array
        const mockAlerts: HydrationAlert[] = [];

        // Set mock data
        setCaretaker(mockCaretaker);
        setManagedUsers(mockManagedUsers);
        setAlerts(mockAlerts);
        setIsLoading(false);
        
        console.log('✅ Mock caretaker signed in:', mockCaretaker.name);
        console.log('👥 Initial managed users:', mockManagedUsers.length);
        return;
      }

      // Production Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if the user is a caretaker
      const caretakerDoc = await getDoc(doc(db, 'caretakers', userCredential.user.uid));
      
      if (!caretakerDoc.exists()) {
        await firebaseSignOut(auth);
        throw new Error('This account is not registered as a caretaker account');
      }
      
      // Data will be loaded automatically by the auth state listener
    } catch (error: any) {
      setIsLoading(false);
      throw new Error(error.message || 'Failed to sign in');
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setCaretaker(null);
      setManagedUsers([]);
      setAlerts([]);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Refresh data
  const refreshData = async () => {
    if (caretaker) {
      // In development mode, don't reload managed users to preserve locally added patients
      if (__DEV__) {
        console.log('🔄 Refresh in dev mode - preserving locally added patients');
        await loadAlerts(caretaker.id);
        return;
      }
      
      // In production, reload from Firestore
      await loadManagedUsers(caretaker.id);
      await loadAlerts(caretaker.id);
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    try {
      if (!caretaker) return;
      
      // Update alert in Firestore
      await updateDoc(doc(db, 'alerts', alertId), {
        acknowledged: true,
        acknowledgedBy: caretaker.id,
        acknowledgedAt: new Date()
      });
      
      // Update local state
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true, acknowledgedBy: caretaker.id, acknowledgedAt: new Date() }
            : alert
        )
      );
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  };

  // Add new patient
  const addPatient = async (patientData: Omit<PatientUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      if (!caretaker) {
        throw new Error('No caretaker logged in');
      }

      console.log('🏥 Adding new patient:', patientData.name);

      // In development mode, add to local state
      if (__DEV__) {
        const newPatient: PatientUser = {
          ...patientData,
          id: `patient_${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        console.log('📝 Created patient record:', newPatient);
        
        setManagedUsers(prev => {
          const updated = [...prev, newPatient];
          console.log('👥 Updated managed users list. Total patients:', updated.length);
          return updated;
        });
        
        console.log('✅ Patient added to local state successfully');
        return newPatient.id;
      }

      // In production, add to Firestore
      // This would be implemented with actual Firebase integration
      throw new Error('Production patient addition not yet implemented');
    } catch (error) {
      console.error('❌ Error adding patient:', error);
      throw error;
    }
  };

  const value: CaretakerAuthContextType = {
    caretaker,
    managedUsers,
    alerts,
    isLoading,
    isCaretaker: !!caretaker,
    signInAsCaretaker,
    signOut,
    refreshData,
    acknowledgeAlert,
    addPatient
  };

  return (
    <CaretakerAuthContext.Provider value={value}>
      {children}
    </CaretakerAuthContext.Provider>
  );
};

export const useCaretakerAuth = (): CaretakerAuthContextType => {
  const context = useContext(CaretakerAuthContext);
  if (!context) {
    throw new Error('useCaretakerAuth must be used within a CaretakerAuthProvider');
  }
  return context;
};