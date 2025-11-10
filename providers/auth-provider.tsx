import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
// Using real Firebase service now that configuration is set up
import { FirebaseUserService, UserData } from '../services/FirebaseUserService';
import { User } from 'firebase/auth';
import { OnboardingData } from '../types';

interface AuthContextType {
  user: UserData | null;
  firebaseUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (name: string, email: string, password: string, onboardingData?: Partial<OnboardingData>) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  sendEmailVerification: () => Promise<{ success: boolean; error?: string }>;
  completeOnboarding: (onboardingData?: Partial<OnboardingData>) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<UserData>) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!firebaseUser;

  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      try {
        // Check for cached user data
        const cachedUser = await AsyncStorage.getItem('userProfile');
        const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
        
        if (cachedUser && isLoggedIn === 'true') {
          setUser(JSON.parse(cachedUser));
        }
      } catch (error) {
        console.error('Error loading cached user:', error);
      }
    };

    // Listen to Firebase auth state changes
    const unsubscribe = FirebaseUserService.onAuthStateChanged(async (firebaseUser) => {
      if (!isMounted) return;
      
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        // User is signed in, get their profile data
        const result = await FirebaseUserService.getUserProfile(firebaseUser.uid);
        if (result.success && result.user) {
          setUser(result.user);
          await AsyncStorage.setItem('userProfile', JSON.stringify(result.user));
          await AsyncStorage.setItem('isLoggedIn', 'true');
        } else {
          // Clear invalid cache
          setUser(null);
          await AsyncStorage.multiRemove(['userProfile', 'isLoggedIn']);
        }
      } else {
        // User is signed out
        setUser(null);
        await AsyncStorage.multiRemove(['userProfile', 'isLoggedIn']);
      }
      
      setIsLoading(false);
    });

    initializeAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signUp = async (name: string, email: string, password: string, onboardingData?: Partial<OnboardingData>) => {
    try {
      setIsLoading(true);
      const result = await FirebaseUserService.signUp(name, email, password, onboardingData);
      
      if (result.success && result.user) {
        setUser(result.user);
        
        // Always go to main app after successful signup
        router.replace('/(tabs)');
        
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to create account' };
      }
    } catch (error: any) {
      console.error('Auth Provider - SignUp error:', error);
      return { success: false, error: error.message || 'An unexpected error occurred during signup' };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await FirebaseUserService.signIn(email, password);
      
      if (result.success && result.user) {
        setUser(result.user);
        
        // Always go to main app after successful signin
        router.replace('/(tabs)');
        
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to sign in' };
      }
    } catch (error: any) {
      console.error('Auth Provider - SignIn error:', error);
      return { success: false, error: error.message || 'An unexpected error occurred during signin' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const result = await FirebaseUserService.signOut();
      
      if (result.success) {
        setUser(null);
        setFirebaseUser(null);
        router.replace('/auth');
      }
    } catch (error: any) {
      console.error('Auth Provider - SignOut error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      return await FirebaseUserService.sendPasswordReset(email);
    } catch (error: any) {
      console.error('Auth Provider - Password Reset error:', error);
      return { success: false, error: error.message || 'Failed to send password reset email' };
    }
  };

  const sendEmailVerification = async () => {
    try {
      return await FirebaseUserService.sendEmailVerification();
    } catch (error: any) {
      console.error('Auth Provider - Email Verification error:', error);
      return { success: false, error: error.message || 'Failed to send verification email' };
    }
  };

  const completeOnboarding = async (onboardingData?: Partial<OnboardingData>) => {
    try {
      if (!user) {
        return { success: false, error: 'No user found' };
      }
      
      const result = await FirebaseUserService.completeOnboarding(user.uid, onboardingData);
      
      if (result.success) {
        // Refresh user data from Firebase to get the updated profile
        await refreshUser();
        
        // Always navigate to main app
        router.replace('/(tabs)');
      }
      
      return result;
    } catch (error: any) {
      console.error('Auth Provider - Complete Onboarding error:', error);
      return { success: false, error: error.message || 'Failed to complete onboarding' };
    }
  };

  const updateProfile = async (updates: Partial<UserData>) => {
    try {
      if (!user) {
        return { success: false, error: 'No user found' };
      }
      
      const result = await FirebaseUserService.updateUserProfile(user.uid, updates);
      
      if (result.success) {
        // Update local user state
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedUser));
      }
      
      return result;
    } catch (error: any) {
      console.error('Auth Provider - Update Profile error:', error);
      return { success: false, error: error.message || 'Failed to update profile' };
    }
  };

  const refreshUser = async () => {
    try {
      if (!firebaseUser) return;
      
      const result = await FirebaseUserService.getUserProfile(firebaseUser.uid);
      if (result.success && result.user) {
        setUser(result.user);
        await AsyncStorage.setItem('userProfile', JSON.stringify(result.user));
      }
    } catch (error: any) {
      console.error('Auth Provider - Refresh User error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    sendEmailVerification,
    completeOnboarding,
    updateProfile,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
