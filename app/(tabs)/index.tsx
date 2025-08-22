import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '../../providers/auth-provider';
import { WaterBottle } from '../../components/WaterBottle';
import { ProgressBar } from '../../components/ProgressBar';
import { StatCard } from '../../components/StatCard';
import { TipCard } from '../../components/TipCard';

import { Colors, Typography, Spacing } from '../../constants/theme';
import { getMotivationalTip, formatWaterAmount } from '../../utils/waterUtils';

// IoT Bottle sizes in ml
const BOTTLE_SIZES = [
  { label: '500ml', value: 500 },
  { label: '1L', value: 1000 },
  { label: '2L', value: 2000 },
  { label: '2.5L', value: 2500 },
];

export default function HomeScreen() {
  const { user } = useAuth();
  
  // IoT Bottle State - Use bottle capacity from user settings
  const selectedBottleSize = user?.bottleCapacity || 1000;
  const [currentWaterLevel, setCurrentWaterLevel] = useState(0.9); // Start at 90%
  const [lastWaterLevelChange, setLastWaterLevelChange] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(true); // IoT device connection status
  const [dailyWaterConsumed, setDailyWaterConsumed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTip, setCurrentTip] = useState(getMotivationalTip());

  // IoT Simulation - Decrease water level randomly to simulate drinking
  useEffect(() => {
    const simulateWaterConsumption = setInterval(() => {
      // Random chance of water consumption (20% every 30 seconds)
      if (Math.random() < 0.2 && currentWaterLevel > 0.05) {
        const consumptionAmount = 0.05 + Math.random() * 0.1; // 5-15% of bottle
        const newLevel = Math.max(0, currentWaterLevel - consumptionAmount);
        const mlConsumed = (currentWaterLevel - newLevel) * selectedBottleSize;
        
        setCurrentWaterLevel(newLevel);
        setDailyWaterConsumed(prev => prev + mlConsumed);
        setLastWaterLevelChange(Date.now());
        
        console.log(`IoT: User drank ${Math.round(mlConsumed)}ml`);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(simulateWaterConsumption);
  }, [currentWaterLevel, selectedBottleSize]);

  // Check for inactivity notifications
  useEffect(() => {
    const checkInactivity = setInterval(() => {
      const timeSinceLastChange = Date.now() - lastWaterLevelChange;
      const hoursSinceLastDrink = timeSinceLastChange / (1000 * 60 * 60);
      
      // Notify if no water consumed for 2+ hours
      if (hoursSinceLastDrink >= 2) {
        Alert.alert(
          "Hydration Reminder! 💧",
          "Your water bottle hasn't moved in 2 hours. Time to drink some water!",
          [{ text: "OK", style: "default" }]
        );
        setLastWaterLevelChange(Date.now()); // Reset timer to avoid spam
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInactivity);
  }, [lastWaterLevelChange]);

  // Reset bottle when empty
  useEffect(() => {
    if (currentWaterLevel <= 0.05) {
      Alert.alert(
        "Bottle Empty! 🚰",
        "Your bottle is almost empty. Please refill it to continue tracking.",
        [
          {
            text: "Refilled",
            onPress: () => {
              setCurrentWaterLevel(0.9); // Refill to 90%
              setLastWaterLevelChange(Date.now());
            }
          }
        ]
      );
    }
  }, [currentWaterLevel]);

  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentTip(getMotivationalTip());
    // Simulate IoT device reconnection
    setIsConnected(false);
    setTimeout(() => {
      setIsConnected(true);
      setRefreshing(false);
    }, 1000);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const currentWaterAmount = Math.round(currentWaterLevel * selectedBottleSize);
  const consumedToday = Math.round(dailyWaterConsumed);
  const dailyGoal = user?.dailyGoal || 2500; // Use user's daily goal
  const progressPercentage = Math.min((consumedToday / dailyGoal) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <LinearGradient
        colors={Colors.background.gradient}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.greeting}>
              {getGreeting()}, {user?.name || 'User'} 👋
            </Text>
            <Text style={styles.date}>{formatDate()}</Text>
            
            {/* IoT Connection Status */}
            <View style={styles.connectionStatus}>
              <View style={[
                styles.connectionDot, 
                { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }
              ]} />
              <Text style={styles.connectionText}>
                IoT Device {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>

         
          

          {/* Water Bottle Visualization */}
          <View style={styles.bottleContainer}>
            <WaterBottle progress={currentWaterLevel} capacity={selectedBottleSize} />
            <Text style={styles.bottleStatus}>
              {currentWaterAmount}ml / {selectedBottleSize}ml
            </Text>
            <Text style={styles.bottleSubtext}>
              Current Bottle Level: {Math.round(currentWaterLevel * 100)}%
            </Text>
          </View>

          {/* Daily Stats */}
          <View style={styles.statsContainer}>
            <StatCard
              label="Daily Goal"
              value={formatWaterAmount(dailyGoal, 'ml')}
              color={Colors.text.medium}
            />
            <StatCard
              label="Consumed"
              value={formatWaterAmount(consumedToday, 'ml')}
              color={Colors.primary}
            />
            <StatCard
              label="Remaining"
              value={formatWaterAmount(Math.max(0, dailyGoal - consumedToday), 'ml')}
              color={Colors.accent}
            />
          </View>

          {/* Daily Progress */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressTitle}>Daily Hydration Progress</Text>
            <ProgressBar progress={progressPercentage} />
            <Text style={styles.progressText}>
              {Math.round(progressPercentage)}% of daily goal achieved
            </Text>
          </View>

          {/* IoT Device Info */}
          <View style={styles.iotInfoContainer}>
            <Text style={styles.sectionTitle}>Smart Bottle Status</Text>
            <View style={styles.iotInfo}>
              <Text style={styles.iotInfoText}>
                📱 Device automatically detects water consumption
              </Text>
              <Text style={styles.iotInfoText}>
                ⏰ Last activity: {new Date(lastWaterLevelChange).toLocaleTimeString()}
              </Text>
              <Text style={styles.iotInfoText}>
                🔋 Battery: 85% (7 days remaining)
              </Text>
            </View>
          </View>

          {/* Hydration Tip */}
          <TipCard tip={currentTip} />

          {/* Motivation Quote */}
          <View style={styles.quoteContainer}>
            <Text style={styles.quote}>
              "Smart hydration for a healthier you! 🌊"
            </Text>
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.white,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? Spacing.md : Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  greeting: {
    ...Typography.header,
    color: Colors.text.dark,
    marginBottom: 4,
  },
  date: {
    ...Typography.body,
    color: Colors.text.medium,
    marginBottom: Spacing.sm,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    ...Typography.caption,
    color: Colors.text.medium,
  },
  bottleInfoHeader: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  bottleInfoText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  bottleInfoSubtext: {
    ...Typography.caption,
    color: Colors.text.medium,
    marginTop: 2,
  },
  bottleSizeContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  sizeButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  sizeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
    minWidth: 60,
    alignItems: 'center',
  },
  selectedSizeButton: {
    backgroundColor: Colors.primary,
  },
  sizeButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  selectedSizeButtonText: {
    color: Colors.background.white,
  },
  bottleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  bottleStatus: {
    ...Typography.title,
    color: Colors.primary,
    marginTop: Spacing.md,
    fontWeight: '700',
  },
  bottleSubtext: {
    ...Typography.body,
    color: Colors.text.medium,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  progressTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  progressText: {
    ...Typography.body,
    color: Colors.text.medium,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  iotInfoContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  iotInfo: {
    backgroundColor: 'rgba(0, 201, 255, 0.1)',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  iotInfoText: {
    ...Typography.body,
    color: Colors.text.dark,
    marginBottom: Spacing.xs,
  },
  quoteContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  quote: {
    ...Typography.body,
    color: Colors.primary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  bottomSpacing: {
    height: Spacing.xxl,
  },
});