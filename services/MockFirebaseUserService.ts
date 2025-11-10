// Mock Firebase Service for testing without real Firebase setup
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserData {
  uid: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  isEmailVerified: boolean;
  onboardingCompleted: boolean;
}

export class MockFirebaseUserService {
  private static currentUser: UserData | null = null;
  private static users: UserData[] = [
    {
      uid: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
      isEmailVerified: true,
      onboardingCompleted: false
    }
  ];

  static async signUp(name: string, email: string, password: string): Promise<{ success: boolean; user?: UserData; error?: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if user already exists
    const existingUser = this.users.find(u => u.email === email);
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    // Create new user
    const newUser: UserData = {
      uid: `user-${Date.now()}`,
      name,
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEmailVerified: true,
      onboardingCompleted: false
    };

    this.users.push(newUser);
    this.currentUser = newUser;

    // Cache user data
    await AsyncStorage.setItem('userProfile', JSON.stringify(newUser));
    await AsyncStorage.setItem('isLoggedIn', 'true');

    return { success: true, user: newUser };
  }

  static async signIn(email: string, password: string): Promise<{ success: boolean; user?: UserData; error?: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find user by email
    const user = this.users.find(u => u.email === email);
    if (!user) {
      return { success: false, error: 'No account found with this email.' };
    }

    // For testing, accept any password
    this.currentUser = user;

    // Cache user data
    await AsyncStorage.setItem('userProfile', JSON.stringify(user));
    await AsyncStorage.setItem('isLoggedIn', 'true');

    return { success: true, user };
  }

  static async signOut(): Promise<{ success: boolean; error?: string }> {
    this.currentUser = null;
    await AsyncStorage.multiRemove(['userProfile', 'isLoggedIn']);
    return { success: true };
  }

  static async getUserProfile(uid: string): Promise<{ success: boolean; user?: UserData; error?: string }> {
    const user = this.users.find(u => u.uid === uid);
    if (user) {
      return { success: true, user };
    }
    return { success: false, error: 'User not found' };
  }

  static async updateUserProfile(uid: string, updates: Partial<UserData>): Promise<{ success: boolean; error?: string }> {
    const userIndex = this.users.findIndex(u => u.uid === uid);
    if (userIndex !== -1) {
      this.users[userIndex] = { ...this.users[userIndex], ...updates, updatedAt: new Date() };
      if (this.currentUser && this.currentUser.uid === uid) {
        this.currentUser = this.users[userIndex];
      }
      return { success: true };
    }
    return { success: false, error: 'User not found' };
  }

  static async sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    // Simulate sending email
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
  }

  static async sendEmailVerification(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  static async checkUserExists(email: string): Promise<boolean> {
    return this.users.some(u => u.email === email);
  }

  static async completeOnboarding(uid: string): Promise<{ success: boolean; error?: string }> {
    const userIndex = this.users.findIndex(u => u.uid === uid);
    if (userIndex !== -1) {
      this.users[userIndex].onboardingCompleted = true;
      if (this.currentUser && this.currentUser.uid === uid) {
        this.currentUser = this.users[userIndex];
      }
      
      // Update cache
      const cachedProfile = await AsyncStorage.getItem('userProfile');
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        const updatedProfile = { ...profile, onboardingCompleted: true };
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      }
      
      return { success: true };
    }
    return { success: false, error: 'User not found' };
  }

  static getCurrentUser() {
    return this.currentUser ? { uid: this.currentUser.uid, email: this.currentUser.email } : null;
  }

  static onAuthStateChanged(callback: (user: any) => void) {
    // Simulate auth state listener
    const checkAuth = async () => {
      const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
      const cachedUser = await AsyncStorage.getItem('userProfile');
      
      if (isLoggedIn === 'true' && cachedUser) {
        const user = JSON.parse(cachedUser);
        this.currentUser = user;
        callback({ uid: user.uid, email: user.email });
      } else {
        this.currentUser = null;
        callback(null);
      }
    };

    checkAuth();
    
    // Return unsubscribe function
    return () => {};
  }

  static isEmailVerified(): boolean {
    return this.currentUser?.isEmailVerified || false;
  }

  static getFirebaseErrorMessage(errorCode: string): string {
    return errorCode;
  }
}