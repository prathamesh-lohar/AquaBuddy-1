import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

interface HydrationData {
  date: string;
  intake: number;
}

interface WeeklyData {
  day: string;
  intake: number;
}

interface HydrationContextType {
  dailyIntake: number;
  dailyGoal: number;
  weeklyData: WeeklyData[];
  streak: number;
  averageIntake: number;
  addWater: (amount: number) => void;
  setDailyGoal: (goal: number) => void;
}

export const [HydrationProvider, useHydration] = createContextHook<HydrationContextType>(() => {
  const [dailyIntake, setDailyIntake] = useState(0);
  const [dailyGoal, setDailyGoalState] = useState(2000);
  const [hydrationHistory, setHydrationHistory] = useState<HydrationData[]>([]);

  useEffect(() => {
    loadHydrationData();
  }, []);

  const loadHydrationData = async () => {
    try {
      const historyData = await AsyncStorage.getItem("hydrationHistory");
      const goalData = await AsyncStorage.getItem("dailyGoal");
      
      if (historyData) {
        const history = JSON.parse(historyData);
        setHydrationHistory(history);
        
        const today = new Date().toDateString();
        const todayData = history.find((d: HydrationData) => d.date === today);
        if (todayData) {
          setDailyIntake(todayData.intake);
        }
      }
      
      if (goalData) {
        setDailyGoalState(parseInt(goalData));
      }
    } catch (error) {
      console.error("Error loading hydration data:", error);
    }
  };

  const saveHydrationData = async (newHistory: HydrationData[]) => {
    try {
      await AsyncStorage.setItem("hydrationHistory", JSON.stringify(newHistory));
    } catch (error) {
      console.error("Error saving hydration data:", error);
    }
  };

  const addWater = (amount: number) => {
    const today = new Date().toDateString();
    const newIntake = dailyIntake + amount;
    setDailyIntake(newIntake);

    const updatedHistory = [...hydrationHistory];
    const todayIndex = updatedHistory.findIndex(d => d.date === today);
    
    if (todayIndex >= 0) {
      updatedHistory[todayIndex].intake = newIntake;
    } else {
      updatedHistory.push({ date: today, intake: newIntake });
    }
    
    setHydrationHistory(updatedHistory);
    saveHydrationData(updatedHistory);
  };

  const setDailyGoal = async (goal: number) => {
    setDailyGoalState(goal);
    try {
      await AsyncStorage.setItem("dailyGoal", goal.toString());
    } catch (error) {
      console.error("Error saving daily goal:", error);
    }
  };

  const getWeeklyData = (): WeeklyData[] => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    const weekData: WeeklyData[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toDateString();
      const dayName = days[date.getDay()];
      
      const dayData = hydrationHistory.find(d => d.date === dateString);
      weekData.push({
        day: dayName,
        intake: dayData?.intake || 0,
      });
    }

    return weekData;
  };

  const calculateStreak = (): number => {
    const sortedHistory = [...hydrationHistory]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < sortedHistory.length; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toDateString();
      
      const dayData = sortedHistory.find(d => d.date === dateString);
      if (dayData && dayData.intake >= dailyGoal) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const calculateAverageIntake = (): number => {
    if (hydrationHistory.length === 0) return 0;
    const total = hydrationHistory.reduce((sum, day) => sum + day.intake, 0);
    return Math.round(total / hydrationHistory.length);
  };

  return {
    dailyIntake,
    dailyGoal,
    weeklyData: getWeeklyData(),
    streak: calculateStreak(),
    averageIntake: calculateAverageIntake(),
    addWater,
    setDailyGoal,
  };
});