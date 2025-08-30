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
import { useBluetoothWater } from '../../hooks/useBluetoothWater';
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
  
  // Bluetooth IoT Integration with fallback
  const {
    isConnected,
    isConnecting,
    connectionError,
    currentWaterLevel: bluetoothWaterLevel,
    currentDistance,
    lastUpdateTime,
    isDataFresh,
    connectToDevice,
    disconnectDevice,
  } = useBluetoothWater();
  
  // Fallback simulation when Bluetooth is not connected
  const [simulatedWaterLevel, setSimulatedWaterLevel] = useState(0.9);
  
  // Use Bluetooth data if available, otherwise use simulation
  const currentWaterLevel = isConnected ? bluetoothWaterLevel : simulatedWaterLevel;
  
  // App State
  const selectedBottleSize = user?.bottleCapacity || 1000;
  const [dailyWaterConsumed, setDailyWaterConsumed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTip, setCurrentTip] = useState(getMotivationalTip());
  const [previousWaterLevel, setPreviousWaterLevel] = useState(currentWaterLevel);

  // Fallback simulation when not connected to Bluetooth
  useEffect(() => {
    if (isConnected) return; // Skip simulation if Bluetooth is connected

    const simulateWaterConsumption = setInterval(() => {
      if (Math.random() < 0.15 && simulatedWaterLevel > 0.05) { // 15% chance every 45 seconds
        const consumptionAmount = 0.03 + Math.random() * 0.07; // 3-10% of bottle
        const newLevel = Math.max(0, simulatedWaterLevel - consumptionAmount);
        setSimulatedWaterLevel(newLevel);
        console.log(`Simulation: Water level decreased to ${(newLevel * 100).toFixed(1)}%`);
      }
    }, 45000); // Check every 45 seconds

    return () => clearInterval(simulateWaterConsumption);
  }, [isConnected, simulatedWaterLevel]);

  // Track water consumption when level decreases
  useEffect(() => {
    if (currentWaterLevel < previousWaterLevel && previousWaterLevel > 0) {
      const consumption = (previousWaterLevel - currentWaterLevel) * selectedBottleSize;
      setDailyWaterConsumed(prev => prev + consumption);
      console.log(`Real IoT: User consumed ${Math.round(consumption)}ml`);
    }
    setPreviousWaterLevel(currentWaterLevel);
  }, [currentWaterLevel, selectedBottleSize, previousWaterLevel]);

  // Check for inactivity notifications (only when connected)
  useEffect(() => {
    if (!isConnected || !isDataFresh) return;

    const checkInactivity = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      const hoursSinceLastUpdate = timeSinceLastUpdate / (1000 * 60 * 60);
      
      // Notify if no data received for 2+ hours
      if (hoursSinceLastUpdate >= 2) {
        Alert.alert(
          "Hydration Reminder! 💧",
          "No water level changes detected in 2 hours. Time to stay hydrated!",
          [{ text: "OK", style: "default" }]
        );
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInactivity);
  }, [isConnected, lastUpdateTime, isDataFresh]);

  // Alert for empty bottle (when connected)
  useEffect(() => {
    if (isConnected && currentWaterLevel <= 0.05) {
      Alert.alert(
        "Bottle Empty! 🚰",
        "Your smart bottle is almost empty. Please refill it to continue tracking.",
        [
          {
            text: "OK",
            style: "default"
          }
        ]
      );
    }
  }, [currentWaterLevel, isConnected]);

  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentTip(getMotivationalTip());
    
    // Try to reconnect Bluetooth if not connected
    if (!isConnected && !isConnecting) {
      await connectToDevice();
    }
    
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleBluetoothConnect = async () => {
    if (isConnecting) {
      console.log('Already connecting, ignoring button press');
      return;
    }
    
    try {
      console.log('User clicked connect button');
      
      // Show loading state immediately
      const success = await connectToDevice();
      
      if (success) {
        Alert.alert(
          'Success!',
          'Connected to Smart Water Bottle successfully!',
          [{ text: 'OK' }]
        );
      } else {
        // Error message is handled by the hook
        console.log('Connection failed - error shown by hook');
      }
    } catch (error) {
      console.error('Error in handleBluetoothConnect:', error);
      Alert.alert(
        'Connection Error',
        'Something went wrong while connecting. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleBluetoothDisconnect = async () => {
    try {
      console.log('User clicked disconnect button');
      await disconnectDevice();
      Alert.alert(
        'Disconnected',
        'Disconnected from Smart Water Bottle',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error in handleBluetoothDisconnect:', error);
      // Continue anyway, just log the error
    }
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

          {/* IoT Device Info & Controls */}
          <View style={styles.iotInfoContainer}>
            <Text style={styles.sectionTitle}>Smart Bottle Status</Text>
            <View style={[styles.iotInfo, { borderLeftColor: isConnected ? '#4CAF50' : '#F44336' }]}>
              <Text style={styles.iotInfoText}>
                📱 Status: {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
              {isConnected && (
                <>
                  <Text style={styles.iotInfoText}>
                    📏 Distance: {currentDistance}mm
                  </Text>
                  <Text style={styles.iotInfoText}>
                    ⏰ Last update: {lastUpdateTime ? new Date(lastUpdateTime).toLocaleTimeString() : 'No data'}
                  </Text>
                  <Text style={styles.iotInfoText}>
                    � Data: {isDataFresh ? 'Fresh' : 'Stale'}
                  </Text>
                </>
              )}
              {connectionError && (
                <Text style={[styles.iotInfoText, { color: '#F44336' }]}>
                  ❌ Error: {connectionError}
                </Text>
              )}
            </View>
            
            {/* Bluetooth Control Buttons */}
            <View style={styles.bluetoothControls}>
              {!isConnected ? (
                <TouchableOpacity
                  style={[styles.bluetoothButton, styles.connectButton]}
                  onPress={handleBluetoothConnect}
                  disabled={isConnecting}
                >
                  <Text style={styles.bluetoothButtonText}>
                    {isConnecting ? '🔄 Connecting...' : '📶 Connect to Bottle'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.bluetoothButton, styles.disconnectButton]}
                  onPress={handleBluetoothDisconnect}
                >
                  <Text style={styles.bluetoothButtonText}>
                    🔌 Disconnect
                  </Text>
                </TouchableOpacity>
              )}
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
  bluetoothControls: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  bluetoothButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  bluetoothButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: Spacing.xxl,
  },
});