import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  bottleCapacity?: number;
  dailyGoal?: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export const [AuthProvider, useAuth] = createContextHook<AuthContextType>(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: { email: string; password: string; name?: string }) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sample credentials validation
      if (credentials.email === "sree@test.com" && credentials.password === "sree123") {
        console.log("✅ Sample credentials used successfully");
      }
      
      const newUser: User = {
        id: Date.now().toString(),
        email: credentials.email,
        name: credentials.name || credentials.email.split("@")[0],
        bottleCapacity: 1000, // Default 1L bottle
        dailyGoal: 2500, // Default 2.5L daily goal
      };

      await AsyncStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser: User = { ...user, ...updates };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error("Profile update error:", error);
      throw error;
    }
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateProfile,
  };
});