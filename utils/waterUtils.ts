import { WaterIntake } from '../types';

export const generateId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

export const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const calculateTotalIntake = (intakes: WaterIntake[]): number => {
  return intakes.reduce((total, intake) => total + intake.amount, 0);
};

export const getProgressPercentage = (current: number, goal: number): number => {
  return Math.min((current / goal) * 100, 100);
};

export const formatWaterAmount = (amount: number, unit: 'ml' | 'oz' = 'ml'): string => {
  if (unit === 'oz') {
    const ozAmount = Math.round(amount * 0.033814);
    return `${ozAmount}oz`;
  }
  return `${amount}ml`;
};

export const getMotivationalTip = (): string => {
  const tips = [
    "Start your day with a glass of water! 🌅",
    "Your body is 70% water, keep it full! 💧",
    "Hydration helps improve focus and energy! ⚡",
    "Water is the best natural detox! 🌿",
    "Small sips throughout the day work best! ⏰",
    "Listen to your body's thirst signals! 👂",
    "Room temperature water is easiest to absorb! 🌡️",
    "Celebrate every glass - you're doing great! 🎉",
  ];
  
  return tips[Math.floor(Math.random() * tips.length)];
};

export const getWaterLevel = (current: number, goal: number): number => {
  return Math.min(current / goal, 1);
};

export const createWaterIntake = (amount: number): WaterIntake => {
  return {
    id: generateId(),
    amount,
    timestamp: new Date(),
    date: getTodayDateString(),
  };
};