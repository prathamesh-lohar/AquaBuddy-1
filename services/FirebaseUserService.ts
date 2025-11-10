// User Service for Firebase operations with Email/Password Authentication
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingData } from '../types';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  isEmailVerified: boolean;
  onboardingCompleted: boolean;
  // Onboarding data
  birthDate?: Date;
  sex?: 'male' | 'female' | 'other';
  weight?: number; // in kg
  height?: number; // in cm
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  sleepSchedule?: {
    bedTime: string; // HH:MM format
    wakeTime: string; // HH:MM format
  };
  healthConditions?: string[];
  unit?: 'ml' | 'oz';
  notifications?: boolean;
  reminderInterval?: number; // hours
  role?: 'personal' | 'caretaker';
  dailyGoal?: number;
}

export class FirebaseUserService {
  
  // Sign up with email and password (with optional onboarding data)
  static async signUp(
    name: string, 
    email: string, 
    password: string, 
    onboardingData?: Partial<OnboardingData>
  ): Promise<{ success: boolean; user?: UserData; error?: string }> {
    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update Firebase Auth profile with display name
      await updateProfile(user, { displayName: name });
      
      // Send email verification
      await sendEmailVerification(user);
      
      // Calculate daily goal if weight and activity level are provided
      const dailyGoal = onboardingData?.weight && onboardingData?.activityLevel 
        ? Math.round(onboardingData.weight * 35 * this.getActivityMultiplier(onboardingData.activityLevel))
        : undefined;
      
      // Create user document in Firestore with optional onboarding data
      const userData: UserData = {
        uid: user.uid,
        name: name,
        email: user.email!,
        createdAt: new Date(),
        updatedAt: new Date(),
        isEmailVerified: user.emailVerified,
        onboardingCompleted: !!onboardingData, // true if onboarding data provided
        // Include onboarding data if provided
        ...onboardingData,
        ...(dailyGoal && { dailyGoal })
      };
      
      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Cache user data locally
      await AsyncStorage.setItem('userProfile', JSON.stringify(userData));
      
      return { success: true, user: userData };
    } catch (error: any) {
      console.error('Error signing up:', error);
      return { success: false, error: this.getFirebaseErrorMessage(error.code) };
    }
  }
  
  // Sign in with email and password
  static async signIn(email: string, password: string): Promise<{ success: boolean; user?: UserData; error?: string }> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user data from Firestore
      const userData = await this.getUserProfile(user.uid);
      
      if (userData.success && userData.user) {
        // Cache user data locally
        await AsyncStorage.setItem('userProfile', JSON.stringify(userData.user));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        
        return { success: true, user: userData.user };
      } else {
        return { success: false, error: 'User profile not found' };
      }
    } catch (error: any) {
      console.error('Error signing in:', error);
      return { success: false, error: this.getFirebaseErrorMessage(error.code) };
    }
  }
  
  // Sign out
  static async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      await signOut(auth);
      await AsyncStorage.multiRemove(['userProfile', 'isLoggedIn']);
      return { success: true };
    } catch (error: any) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Get user profile by UID
  static async getUserProfile(uid: string): Promise<{ success: boolean; user?: UserData; error?: string }> {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        const userData: UserData = {
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as UserData;
        
        return { success: true, user: userData };
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error: any) {
      console.error('Error getting user profile:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Update user profile
  static async updateUserProfile(uid: string, updates: Partial<UserData>): Promise<{ success: boolean; error?: string }> {
    try {
      const userRef = doc(db, 'users', uid);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local cache
      const cachedProfile = await AsyncStorage.getItem('userProfile');
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        const updatedProfile = { ...profile, ...updates, updatedAt: new Date() };
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Send password reset email
  static async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: this.getFirebaseErrorMessage(error.code) };
    }
  }
  
  // Send email verification
  static async sendEmailVerification(): Promise<{ success: boolean; error?: string }> {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        return { success: true };
      } else {
        return { success: false, error: 'No user is currently signed in' };
      }
    } catch (error: any) {
      console.error('Error sending email verification:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Check if user exists by email
  static async checkUserExists(email: string): Promise<boolean> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }
  
  // Save onboarding data
  static async saveOnboardingData(uid: string, onboardingData: Partial<OnboardingData>): Promise<{ success: boolean; error?: string }> {
    try {
      const userRef = doc(db, 'users', uid);
      
      // Calculate daily goal based on weight, activity, etc.
      const dailyGoal = onboardingData.weight && onboardingData.activityLevel 
        ? Math.round(onboardingData.weight * 35 * this.getActivityMultiplier(onboardingData.activityLevel))
        : 2500;
      
      const updateData = {
        ...onboardingData,
        dailyGoal,
        onboardingCompleted: true,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local cache
      const cachedProfile = await AsyncStorage.getItem('userProfile');
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        const updatedProfile = { 
          ...profile, 
          ...onboardingData, 
          dailyGoal,
          onboardingCompleted: true, 
          updatedAt: new Date() 
        };
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error saving onboarding data:', error);
      return { success: false, error: error.message };
    }
  }

  // Calculate activity multiplier for daily goal
  static getActivityMultiplier(activityLevel: string): number {
    const multipliers = {
      sedentary: 1.0,
      light: 1.1,
      moderate: 1.2,
      active: 1.3,
      very_active: 1.4
    };
    return multipliers[activityLevel as keyof typeof multipliers] || 1.2;
  }
  
  // Complete onboarding (updated to accept onboarding data)
  static async completeOnboarding(uid: string, onboardingData?: Partial<OnboardingData>): Promise<{ success: boolean; error?: string }> {
    try {
      if (onboardingData) {
        // Save complete onboarding data
        return await this.saveOnboardingData(uid, onboardingData);
      } else {
        // Simple completion without additional data
        const userRef = doc(db, 'users', uid);
        const updateData = {
          onboardingCompleted: true,
          updatedAt: serverTimestamp()
        };
        
        await updateDoc(userRef, updateData);
        
        // Update local cache
        const cachedProfile = await AsyncStorage.getItem('userProfile');
        if (cachedProfile) {
          const profile = JSON.parse(cachedProfile);
          const updatedProfile = { ...profile, onboardingCompleted: true, updatedAt: new Date() };
          await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        }
        
        return { success: true };
      }
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user
  static getCurrentUser(): User | null {
    return auth.currentUser;
  }
  
  // Listen to auth state changes
  static onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }
  
  // Check if email is verified
  static isEmailVerified(): boolean {
    return auth.currentUser?.emailVerified || false;
  }
  
  // Convert Firebase error codes to user-friendly messages
  static getFirebaseErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/operation-not-allowed':
        return 'Email/password authentication is not enabled.';
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
}

// Simplified legacy functions for backward compatibility
export const createUser = async (userData: Omit<UserData, 'uid' | 'createdAt' | 'updatedAt' | 'isEmailVerified' | 'onboardingCompleted'>) => {
  // This function is now deprecated, use FirebaseUserService.signUp instead
  console.warn('createUser is deprecated, use FirebaseUserService.signUp instead');
  return { success: false, error: 'This function is deprecated' };
};

export const updateUser = async (uid: string, updates: Partial<UserData>) => {
  try {
    const result = await FirebaseUserService.updateUserProfile(uid, updates);
    return result;
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const checkUserExists = async (email: string) => {
  return await FirebaseUserService.checkUserExists(email);
};

