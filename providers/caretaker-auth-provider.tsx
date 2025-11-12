import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { StorageService } from '../utils/storage';
import { Patient, CaretakerProfile } from '../types';

interface CaretakerAuthContextType {
  caretaker: CaretakerProfile | null;
  patients: Patient[];
  activePatient: Patient | null;
  isLoading: boolean;
  isCaretaker: boolean;
  signInAsCaretaker: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  addPatient: (patientData: Omit<Patient, 'id' | 'createdAt' | 'lastUpdated' | 'lastSync' | 'isConnected' | 'currentWaterLevel' | 'todayIntakes'>) => Promise<string>;
  updatePatient: (patientId: string, updates: Partial<Patient>) => Promise<void>;
  deletePatient: (patientId: string) => Promise<void>;
  setActivePatient: (patientId: string) => Promise<void>;
  updatePatientWaterLevel: (patientId: string, waterLevel: number) => Promise<void>;
  updatePatientDeviceStatus: (patientId: string, isConnected: boolean) => Promise<void>;
}

const CaretakerAuthContext = createContext<CaretakerAuthContextType | null>(null);

interface CaretakerAuthProviderProps {
  children: ReactNode;
}

export const CaretakerAuthProvider: React.FC<CaretakerAuthProviderProps> = ({ children }) => {
  const [caretaker, setCaretaker] = useState<CaretakerProfile | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatient, setActivePatientState] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load caretaker data on app start
  useEffect(() => {
    loadCaretakerData();
  }, []);

  // Load caretaker data from AsyncStorage
  const loadCaretakerData = async () => {
    try {
      setIsLoading(true);
      
      // Load caretaker profile
      const savedCaretaker = await StorageService.getCaretakerProfile();
      setCaretaker(savedCaretaker);
      
      if (savedCaretaker) {
        // Load patients
        const savedPatients = await StorageService.getPatients();
        setPatients(savedPatients);
        
        // Load active patient
        const savedActivePatient = await StorageService.getActivePatient();
        setActivePatientState(savedActivePatient);
      }
    } catch (error) {
      console.error('Error loading caretaker data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign in as caretaker (create/update profile)
  const signInAsCaretaker = async (email: string, password: string): Promise<void> => {
    try {
      console.log('🔐 Signing in caretaker:', email);
      
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Simple password validation for demo purposes
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      const caretakerProfile: CaretakerProfile = {
        id: Date.now().toString(),
        name: email.split('@')[0], // Use email prefix as name
        email: email.trim(),
        patients: [],
      };
      
      await StorageService.saveCaretakerProfile(caretakerProfile);
      setCaretaker(caretakerProfile);
      
      console.log('✅ Caretaker signed in successfully');
    } catch (error) {
      console.error('❌ Error signing in as caretaker:', error);
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      // Clear local state
      setCaretaker(null);
      setPatients([]);
      setActivePatientState(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Refresh data from storage
  const refreshData = async (): Promise<void> => {
    await loadCaretakerData();
  };

  // Clear all patient data
  const clearAllData = async (): Promise<void> => {
    try {
      console.log('🗑️ Clearing all patient data...');
      
      // Clear all patients
      await StorageService.savePatients([]);
      setPatients([]);
      setActivePatientState(null);
      
      // Update caretaker profile
      if (caretaker) {
        const updatedCaretaker = {
          ...caretaker,
          patients: [],
        };
        await StorageService.saveCaretakerProfile(updatedCaretaker);
        setCaretaker(updatedCaretaker);
      }
      
      console.log('✅ All patient data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing patient data:', error);
      throw error;
    }
  };

  // Add new patient
  const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt' | 'lastUpdated' | 'lastSync' | 'isConnected' | 'currentWaterLevel' | 'todayIntakes'>): Promise<string> => {
    try {
      const newPatient: Patient = {
        ...patientData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        isConnected: false,
        currentWaterLevel: 0,
        todayIntakes: [],
      };
      
      await StorageService.addPatient(newPatient);
      
      // Update local state
      const updatedPatients = await StorageService.getPatients();
      setPatients(updatedPatients);
      
      // Update caretaker profile with new patient reference
      if (caretaker) {
        const updatedCaretaker = {
          ...caretaker,
          patients: updatedPatients,
        };
        await StorageService.saveCaretakerProfile(updatedCaretaker);
        setCaretaker(updatedCaretaker);
      }
      
      console.log('✅ Patient added successfully:', newPatient.name);
      return newPatient.id;
    } catch (error) {
      console.error('Error adding patient:', error);
      throw error;
    }
  };

  // Update patient
  const updatePatient = async (patientId: string, updates: Partial<Patient>): Promise<void> => {
    try {
      await StorageService.updatePatient(patientId, updates);
      
      // Update local state
      const updatedPatients = await StorageService.getPatients();
      setPatients(updatedPatients);
      
      // Update active patient if it's the one being updated
      if (activePatient?.id === patientId) {
        const updatedActivePatient = await StorageService.getPatientById(patientId);
        setActivePatientState(updatedActivePatient);
      }
    } catch (error) {
      console.error('Error updating patient:', error);
    }
  };

  // Delete patient
  const deletePatient = async (patientId: string): Promise<void> => {
    try {
      await StorageService.deletePatient(patientId);
      
      // Update local state
      const updatedPatients = await StorageService.getPatients();
      setPatients(updatedPatients);
      
      // Clear active patient if it was deleted
      if (activePatient?.id === patientId) {
        setActivePatientState(null);
        await StorageService.setActivePatient('');
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
    }
  };

  // Set active patient
  const setActivePatient = async (patientId: string): Promise<void> => {
    try {
      await StorageService.setActivePatient(patientId);
      const patient = await StorageService.getPatientById(patientId);
      setActivePatientState(patient);
    } catch (error) {
      console.error('Error setting active patient:', error);
    }
  };

  // Update patient water level (real-time from device)
  const updatePatientWaterLevel = async (patientId: string, waterLevel: number): Promise<void> => {
    try {
      await StorageService.updatePatientWaterLevel(patientId, waterLevel);
      
      // Update local state
      const updatedPatients = await StorageService.getPatients();
      setPatients(updatedPatients);
      
      // Update active patient if needed
      if (activePatient?.id === patientId) {
        const updatedActivePatient = await StorageService.getPatientById(patientId);
        setActivePatientState(updatedActivePatient);
      }
    } catch (error) {
      console.error('Error updating patient water level:', error);
    }
  };

  // Update patient device connection status
  const updatePatientDeviceStatus = async (patientId: string, isConnected: boolean): Promise<void> => {
    try {
      await StorageService.updatePatientDeviceStatus(patientId, isConnected);
      
      // Update local state
      const updatedPatients = await StorageService.getPatients();
      setPatients(updatedPatients);
      
      // Update active patient if needed
      if (activePatient?.id === patientId) {
        const updatedActivePatient = await StorageService.getPatientById(patientId);
        setActivePatientState(updatedActivePatient);
      }
    } catch (error) {
      console.error('Error updating patient device status:', error);
    }
  };

  const value: CaretakerAuthContextType = {
    caretaker,
    patients,
    activePatient,
    isLoading,
    isCaretaker: !!caretaker,
    signInAsCaretaker,
    signOut,
    refreshData,
    clearAllData,
    addPatient,
    updatePatient,
    deletePatient,
    setActivePatient,
    updatePatientWaterLevel,
    updatePatientDeviceStatus,
  };

  return (
    <CaretakerAuthContext.Provider value={value}>
      {children}
    </CaretakerAuthContext.Provider>
  );
};

export const useCaretakerAuth = () => {
  const context = useContext(CaretakerAuthContext);
  if (!context) {
    throw new Error('useCaretakerAuth must be used within a CaretakerAuthProvider');
  }
  return context;
};