import { useState, useEffect, useCallback } from 'react';
import { WaterIntake, UserProfile } from '../types';
import { StorageService } from '../utils/storage';
import { 
  createWaterIntake, 
  calculateTotalIntake, 
  getTodayDateString 
} from '../utils/waterUtils';

export const useWaterTracking = () => {
  const [todayIntakes, setTodayIntakes] = useState<WaterIntake[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [streakCount, setStreakCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        const [profile, intakes, streak] = await Promise.all([
          StorageService.getUserProfile(),
          StorageService.getTodayIntakes(),
          StorageService.getStreakCount(),
        ]);

        setUserProfile(profile || {
          name: 'User',
          email: '',
          dailyGoal: 3000,
          unit: 'ml',
          notifications: true,
          reminderInterval: 2,
        });
        
        setTodayIntakes(intakes);
        setStreakCount(streak);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Add water intake
  const addWaterIntake = useCallback(async (amount: number) => {
    try {
      const newIntake = createWaterIntake(amount);
      const updatedIntakes = [...todayIntakes, newIntake];
      
      setTodayIntakes(updatedIntakes);
      await StorageService.saveTodayIntakes(updatedIntakes);
      
      // Update daily record
      if (userProfile) {
        const total = calculateTotalIntake(updatedIntakes);
        const achieved = total >= userProfile.dailyGoal;
        
        const dayRecord = {
          date: getTodayDateString(),
          total,
          goal: userProfile.dailyGoal,
          intakes: updatedIntakes,
          achieved,
        };
        
        await StorageService.saveDayRecord(dayRecord);
      }
      
      return true;
    } catch (error) {
      console.error('Error adding water intake:', error);
      return false;
    }
  }, [todayIntakes, userProfile]);

  // Update user profile
  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!userProfile) return false;
    
    try {
      const updatedProfile = { ...userProfile, ...updates };
      setUserProfile(updatedProfile);
      await StorageService.saveUserProfile(updatedProfile);
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }, [userProfile]);

  // Calculate current stats
  const currentTotal = calculateTotalIntake(todayIntakes);
  const dailyGoal = userProfile?.dailyGoal || 3000;
  const remaining = Math.max(dailyGoal - currentTotal, 0);
  const progressPercentage = Math.min((currentTotal / dailyGoal) * 100, 100);
  const goalAchieved = currentTotal >= dailyGoal;

  return {
    // State
    todayIntakes,
    userProfile,
    streakCount,
    isLoading,
    
    // Computed values
    currentTotal,
    dailyGoal,
    remaining,
    progressPercentage,
    goalAchieved,
    
    // Actions
    addWaterIntake,
    updateUserProfile,
  };
};