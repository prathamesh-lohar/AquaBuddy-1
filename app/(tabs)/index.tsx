import 'react-native-get-random-values'; // example other polyfills if used
import { Buffer } from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

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
  FlatList,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';


import { useAuth } from '../../providers/auth-provider';
import { useBluetoothWater } from '../../hooks/useBluetoothWater';
import { WaterBottle } from '../../components/WaterBottle';
import { ProgressBar } from '../../components/ProgressBar';
import { StatCard } from '../../components/StatCard';
import { TipCard } from '../../components/TipCard';
import { CalibrationModal } from '../../components/CalibrationModal';
import { NotifyButton } from '../../components/NotifyButton';

import { Colors, Typography, Spacing } from '../../constants/theme';
import { getMotivationalTip, formatWaterAmount } from '../../utils/waterUtils';
import { calibrationService } from '../../services/CalibrationService';
import { notificationService } from '../../services/NotificationService';

// IoT Bottle sizes in ml
const BOTTLE_SIZES = [
  { label: '500ml', value: 500 },
  { label: '1L', value: 1000 },
  { label: '2L', value: 2000 },
  { label: '2.5L', value: 2500 },
];

export default function HomeScreen() {
  const { user } = useAuth();
  
  // Bluetooth IoT Integration with device selection
  const {
    isConnected,
    isConnecting,
    isScanning,
    availableDevices,
    selectedDevice,
    connectionError,
    currentWaterLevel: bluetoothWaterLevel,
    currentDistance,
    lastUpdateTime,
    isDataFresh,
    sensorData,
    scanForDevices,
    stopScanning,
    selectDevice,
    connectToDevice,
    disconnectDevice,
    getDiagnostics,
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
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  // Initialize calibration service
  useEffect(() => {
    const initCalibration = async () => {
      await calibrationService.loadCalibration();
      setIsCalibrated(calibrationService.isDeviceCalibrated());
    };
    initCalibration();
  }, []);

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize();
  }, []);
  // Check for calibration needed when device connects
  useEffect(() => {
    if (isConnected && !isCalibrated) {
      Alert.alert(
        'Device Calibration Required',
        'Your smart water bottle needs to be calibrated for accurate tracking. Would you like to calibrate it now?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Calibrate Now', onPress: () => setShowCalibrationModal(true) },
        ]
      );
    }
  }, [isConnected, isCalibrated]);
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

  const handleDiagnostics = async () => {
    try {
      const diagnostics = await getDiagnostics();
      Alert.alert(
        'BLE Manager Diagnostics',
        diagnostics,
        [
          { text: 'Copy to Clipboard', onPress: () => console.log(diagnostics) },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to get diagnostics');
    }
  };

  const handleCalibrationComplete = async (calibration: any) => {
    setIsCalibrated(true);
    Alert.alert(
      'Calibration Complete! ✅',
      `Your water bottle has been calibrated successfully. 
      
Empty: ${calibration.emptyBaseline.toFixed(1)}mm
Full: ${calibration.fullBaseline.toFixed(1)}mm
Capacity: ${calibration.bottleCapacity}ml`,
      [{ text: 'OK' }]
    );
  };

  const handleForceReinitialize = async () => {
    Alert.alert(
      'Force Disconnect',
      'This will disconnect the current device. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          onPress: async () => {
            await disconnectDevice();
            Alert.alert(
              'Disconnected',
              'Device has been disconnected successfully',
              [{ text: 'OK' }]
            );
          }
        }
      ]
    );
  };

  const handleScanForDevices = async () => {
    setShowDeviceSelector(true);
    try {
      console.log('Scanning for BLE devices...');
      const devices = await scanForDevices();
      console.log('Found', devices.length, 'devices');
      
      if (devices.length === 0) {
        Alert.alert(
          'No Devices Found',
          'No Bluetooth devices found nearby. Make sure your water bottle device is powered on and in pairing mode.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error scanning for devices:', error);
      Alert.alert(
        'Scan Error',
        'Failed to scan for devices. Please check Bluetooth is enabled and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleDeviceSelect = (device: any) => {
    selectDevice(device);
    console.log('Selected device:', device.name || device.id);
  };

  const handleBluetoothConnect = async () => {
    if (!selectedDevice) {
      // No device selected, show device selector
      await handleScanForDevices();
      return;
    }

    if (isConnecting) {
      console.log('Already connecting, ignoring button press');
      return;
    }
    
    try {
      console.log('User clicked connect button for device:', selectedDevice.name);
      
      const success = await connectToDevice(selectedDevice.id);
      
      if (success) {
        setShowDeviceSelector(false);
        Alert.alert(
          'Success!',
          `Connected to ${selectedDevice.name || 'device'} successfully!`,
          [{ text: 'OK' }]
        );
      } else {
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
      setShowDeviceSelector(false);
      Alert.alert(
        'Disconnected',
        'Disconnected from device',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error in handleBluetoothDisconnect:', error);
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
        colors={['#E3F2FD', '#FFFFFF']}
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

          {/* Notification Button */}
          <View style={styles.notificationContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsRow}>
              <NotifyButton />
              {isConnected && (
                <TouchableOpacity
                  style={styles.calibrateButton}
                  onPress={() => setShowCalibrationModal(true)}
                >
                  <Text style={styles.calibrateButtonText}>
                    {isCalibrated ? '🔧 Recalibrate' : '⚙️ Calibrate Device'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
                <>
                  {!selectedDevice ? (
                    <TouchableOpacity
                      style={[styles.bluetoothButton, styles.scanButton]}
                      onPress={handleScanForDevices}
                      disabled={isScanning}
                    >
                      <Text style={styles.bluetoothButtonText}>
                        {isScanning ? '🔍 Scanning...' : '🔍 Scan for Devices'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <Text style={styles.selectedDeviceText}>
                        Selected: {selectedDevice.name || selectedDevice.id}
                      </Text>
                      <View style={styles.deviceActions}>
                        <TouchableOpacity
                          style={[styles.bluetoothButton, styles.connectButton]}
                          onPress={handleBluetoothConnect}
                          disabled={isConnecting}
                        >
                          <Text style={styles.bluetoothButtonText}>
                            {isConnecting ? '🔄 Connecting...' : '📶 Connect'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.bluetoothButton, styles.rescanButton]}
                          onPress={handleScanForDevices}
                          disabled={isScanning}
                        >
                          <Text style={styles.bluetoothButtonText}>
                            {isScanning ? '🔍 Scanning...' : '🔄 Rescan'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View>
                  <Text style={styles.connectedDeviceText}>
                    Connected to: {selectedDevice?.name || 'Unknown Device'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.bluetoothButton, styles.disconnectButton]}
                    onPress={handleBluetoothDisconnect}
                  >
                    <Text style={styles.bluetoothButtonText}>
                      🔌 Disconnect
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Debug/Diagnostic Buttons */}
              <View style={styles.diagnosticButtons}>
                <TouchableOpacity
                  style={[styles.diagnosticButton, styles.infoButton]}
                  onPress={handleDiagnostics}
                >
                  <Text style={styles.diagnosticButtonText}>🔍 Diagnostics</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.diagnosticButton, styles.warningButton]}
                  onPress={handleForceReinitialize}
                >
                  <Text style={styles.diagnosticButtonText}>� Disconnect</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Device Selector Modal */}
          <Modal
            visible={showDeviceSelector}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowDeviceSelector(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Select Bluetooth Device</Text>
                <Text style={styles.modalSubtitle}>
                  Choose a device to connect as your water bottle
                </Text>
                
                {isScanning && (
                  <View style={styles.scanningIndicator}>
                    <Text style={styles.scanningText}>🔍 Scanning for devices...</Text>
                  </View>
                )}

                <FlatList
                  data={availableDevices}
                  keyExtractor={(item) => item.id}
                  style={styles.deviceList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.deviceItem,
                        selectedDevice?.id === item.id && styles.selectedDeviceItem
                      ]}
                      onPress={() => handleDeviceSelect(item)}
                    >
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceName}>
                          {item.name || item.localName || 'Unknown Device'}
                        </Text>
                        <Text style={styles.deviceId}>ID: {item.id}</Text>
                        {item.rssi && (
                          <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
                        )}
                      </View>
                      {selectedDevice?.id === item.id && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    !isScanning ? (
                      <View style={styles.emptyList}>
                        <Text style={styles.emptyText}>No devices found</Text>
                        <Text style={styles.emptySubtext}>
                          Make sure your device is powered on and in pairing mode
                        </Text>
                      </View>
                    ) : null
                  }
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      stopScanning();
                      setShowDeviceSelector(false);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  {selectedDevice && (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.confirmButton]}
                      onPress={() => {
                        stopScanning();
                        setShowDeviceSelector(false);
                      }}
                    >
                      <Text style={styles.confirmButtonText}>Select Device</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </Modal>

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

        {/* Calibration Modal */}
        <CalibrationModal
          visible={showCalibrationModal}
          onClose={() => setShowCalibrationModal(false)}
          onComplete={handleCalibrationComplete}
          sensorData={sensorData}
        />
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
  scanButton: {
    backgroundColor: '#2196F3',
  },
  rescanButton: {
    backgroundColor: '#FF9800',
    flex: 1,
    marginLeft: Spacing.sm,
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  bluetoothButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
  },
  selectedDeviceText: {
    ...Typography.body,
    color: Colors.text.dark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  connectedDeviceText: {
    ...Typography.body,
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  deviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: Spacing.lg,
    margin: Spacing.lg,
    maxHeight: '80%',
    minWidth: '85%',
  },
  modalTitle: {
    ...Typography.header,
    color: Colors.text.dark,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    ...Typography.body,
    color: Colors.text.medium,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  scanningIndicator: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  scanningText: {
    ...Typography.body,
    color: Colors.primary,
  },
  deviceList: {
    maxHeight: 300,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    marginVertical: Spacing.xs,
    backgroundColor: '#f5f5f5',
  },
  selectedDeviceItem: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    ...Typography.body,
    color: Colors.text.dark,
    fontWeight: '600',
    marginBottom: 2,
  },
  deviceId: {
    ...Typography.caption,
    color: Colors.text.medium,
    marginBottom: 2,
  },
  deviceRssi: {
    ...Typography.caption,
    color: Colors.text.light,
  },
  checkmark: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 20,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.text.medium,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    ...Typography.caption,
    color: Colors.text.light,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  modalButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.text.medium,
  },
  confirmButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
  },
  // Diagnostic button styles
  diagnosticButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  diagnosticButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  infoButton: {
    backgroundColor: '#2196F3',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  diagnosticButtonText: {
    ...Typography.caption,
    color: 'white',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: Spacing.xxl,
  },
  // Notification and Quick Actions Styles
  notificationContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: Spacing.md,
  },
  calibrateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  calibrateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});