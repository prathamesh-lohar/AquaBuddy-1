import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  bottleCapacity: number; // in ml
  dailyGoal: number; // in ml
  unit: 'ml' | 'oz';
  notifications: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
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
        const parsedUser = JSON.parse(userData);
        // Ensure all required fields are present with defaults
        const fullUser: User = {
          id: parsedUser.id,
          email: parsedUser.email,
          name: parsedUser.name,
          bottleCapacity: parsedUser.bottleCapacity || 1000,
          dailyGoal: parsedUser.dailyGoal || 2500,
          unit: parsedUser.unit || 'ml',
          notifications: parsedUser.notifications !== undefined ? parsedUser.notifications : true,
        };
        setUser(fullUser);
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
        bottleCapacity: 1000, // Default 1L
        dailyGoal: 2500, // Default 2.5L daily goal
        unit: 'ml',
        notifications: true,
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

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser = { ...user, ...updates };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
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

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
  };
});