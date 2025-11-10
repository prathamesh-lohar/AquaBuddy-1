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
  { label: '1000ml', value: 1000 },
  { label: '1500ml', value: 1500 },
  { label: '2000ml', value: 2000 },
  { label: '2500ml', value: 2500 },
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
    enterDeepSleep,
    wakeUpDevice,
    sendCommand,
  } = useBluetoothWater();
  
  // Fallback simulation when Bluetooth is not connected
  const [simulatedWaterLevel, setSimulatedWaterLevel] = useState(0);
  
  // Use app-side calibration if available, otherwise use ESP32 percentage
  const currentWaterLevel = (() => {
    if (isConnected && sensorData) {
      // Check if distance is too close (likely ground/surface detection)
      const MIN_VALID_DISTANCE = 40; // mm - anything closer is likely not a bottle
      
      if (sensorData.distance < MIN_VALID_DISTANCE) {
        console.log(`⚠️ Distance too close (${sensorData.distance}mm) - likely no bottle detected`);
        return 0; // No bottle detected
      }
      
      if (calibrationService.isDeviceCalibrated()) {
        // Use app-side calibration for accurate water level
        return calibrationService.calculateWaterLevel(sensorData) / 100; // Convert to 0-1 range
      } else {
        // Fallback to ESP32 percentage, but convert to 0-1 range
        return Math.min(Math.max(sensorData.waterLevel / 100, 0), 1);
      }
    }
    return simulatedWaterLevel; // Fallback simulation
  })();
  
  // App State
  const [selectedBottleSize, setSelectedBottleSize] = useState(1000);
  const [dailyWaterConsumed, setDailyWaterConsumed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTip, setCurrentTip] = useState(getMotivationalTip());
  const [previousWaterLevel, setPreviousWaterLevel] = useState(currentWaterLevel);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [showBottleSizeModal, setShowBottleSizeModal] = useState(false);
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
  // Removed automatic simulation - user requested to stop automatic behavior

  // Track water consumption when level decreases (with minimum threshold to avoid noise)
  useEffect(() => {
    const MIN_CONSUMPTION_THRESHOLD = 0.02; // 2% minimum change to register as consumption
    const levelDifference = previousWaterLevel - currentWaterLevel;
    
    if (levelDifference > MIN_CONSUMPTION_THRESHOLD && previousWaterLevel > 0) {
      const consumption = levelDifference * selectedBottleSize;
      const maxReasonableConsumption = selectedBottleSize * 0.5; // Max 50% of bottle in one reading
      
      // Cap consumption to reasonable amounts
      const actualConsumption = Math.min(consumption, maxReasonableConsumption);
      setDailyWaterConsumed(prev => prev + actualConsumption);
      
      console.log(`Water consumed: ${Math.round(actualConsumption)}ml (Level: ${(previousWaterLevel * 100).toFixed(1)}% → ${(currentWaterLevel * 100).toFixed(1)}%)`);
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

  // Water level notifications
  useEffect(() => {
    if (!isConnected || !sensorData) return;

    const waterLevelPercent = currentWaterLevel * 100;
    
    // Send low water notification at 10%
    if (waterLevelPercent <= 10 && waterLevelPercent > 0) {
      notificationService.sendLowWaterNotification(waterLevelPercent);
    }
    
    // Send empty bottle notification at 0%
    if (waterLevelPercent <= 0) {
      notificationService.sendEmptyBottleNotification();
    }
  }, [currentWaterLevel, isConnected, sensorData]);

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
      `Your water bottle has been calibrated successfully! 
      
Empty: ${calibration.emptyBaseline.toFixed(1)}mm
Full: ${calibration.fullBaseline.toFixed(1)}mm
Capacity: ${selectedBottleSize}ml

You can now track your water consumption accurately.`,
      [{ text: 'Done' }]
    );
  };

  const handleBottleSizeSelect = (size: number) => {
    setSelectedBottleSize(size);
    setShowBottleSizeModal(false);
    // Reset calibration when bottle size changes
    setIsCalibrated(false);
    Alert.alert(
      'Bottle Size Updated',
      `Bottle size changed to ${size}ml. Please recalibrate your device for accurate readings.`,
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

  const handleEnterSleepMode = async () => {
    Alert.alert(
      'Sleep Mode Options',
      'Choose how long the device should sleep. This will save battery power.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: '30 minutes', 
          onPress: () => confirmSleepMode(30)
        },
        { 
          text: '1 hour', 
          onPress: () => confirmSleepMode(60)
        },
        { 
          text: '2 hours', 
          onPress: () => confirmSleepMode(120)
        },
        { 
          text: '6 hours', 
          onPress: () => confirmSleepMode(360)
        },
      ]
    );
  };

  const confirmSleepMode = (minutes: number) => {
    Alert.alert(
      'Confirm Sleep Mode',
      `Device will sleep for ${minutes} minutes and disconnect. You'll need to wait for it to wake up automatically or manually power cycle it. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sleep Now', 
          onPress: async () => {
            const success = await enterDeepSleep(minutes);
            if (success) {
              Alert.alert(
                'Sleep Mode Activated 😴',
                `Device is entering deep sleep for ${minutes} minutes. It will wake up automatically and you can reconnect.`,
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert(
                'Sleep Mode Failed',
                'Failed to put device into sleep mode. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const handleWakeUpDevice = async () => {
    if (isConnected) {
      Alert.alert(
        'Device Already Awake',
        'The device is already connected and awake.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Wake Up Device',
      'Attempting to wake up and reconnect to your device...',
      [{ text: 'OK' }]
    );

    const success = await wakeUpDevice();
    if (success) {
      Alert.alert(
        'Device Awake! ⏰',
        'Successfully woken up and reconnected to your device.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Wake Up Failed',
        'Device may still be sleeping or requires manual wake-up. Try scanning for devices if the sleep period has ended.',
        [
          { text: 'OK' },
          { text: 'Scan for Devices', onPress: handleScanForDevices }
        ]
      );
    }
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
              {sensorData?.distance && sensorData.distance < 60 ? 'No Bottle Detected' : `${currentWaterAmount}ml / ${selectedBottleSize}ml`}
            </Text>
            <Text style={styles.bottleSubtext}>
              {sensorData?.distance && sensorData.distance < 60 ? 
                'Place bottle on device to start tracking' : 
                `Current Bottle Level: ${Math.round(currentWaterLevel * 100)}%`}
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

          {/* Bottle Configuration */}
          <View style={styles.configurationContainer}>
            <Text style={styles.sectionTitle}>Bottle Configuration</Text>
            <View style={styles.configurationCard}>
              <View style={styles.configRow}>
                <View style={styles.configInfo}>
                  <Text style={styles.configLabel}>Current Bottle Size</Text>
                  <Text style={styles.configValue}>{selectedBottleSize}ml</Text>
                </View>
                <TouchableOpacity
                  style={styles.bottleSizeButton}
                  onPress={() => setShowBottleSizeModal(true)}
                >
                  <Text style={styles.bottleSizeButtonText}>
                    Change Size
                  </Text>
                </TouchableOpacity>
              </View>
              {!isCalibrated && (
                <View style={styles.calibrationWarning}>
                  <Text style={styles.warningText}>
                    ⚠️ Calibration required for accurate tracking
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Device Actions */}
          <View style={styles.notificationContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsColumn}>
              <NotifyButton />
              {isConnected && (
                <>
                  <TouchableOpacity
                    style={styles.calibrateButton}
                    onPress={() => setShowCalibrationModal(true)}
                  >
                    <Text style={styles.calibrateButtonText}>
                      {isCalibrated ? '🔧 Recalibrate Device' : '⚙️ Calibrate Device'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.sleepButton}
                    onPress={handleEnterSleepMode}
                  >
                    <Text style={styles.sleepButtonText}>
                      😴 Sleep Mode
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              
              {!isConnected && (
                <TouchableOpacity
                  style={styles.wakeButton}
                  onPress={handleWakeUpDevice}
                >
                  <Text style={styles.wakeButtonText}>
                    ⏰ Wake Up Device
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
                    � Raw Sensor: {sensorData?.distance || 'No data'}mm
                  </Text>
                  <Text style={styles.iotInfoText}>
                    🎯 Valid Range: {sensorData?.distance && sensorData.distance > 0 && sensorData.distance < 400 ? 'Yes' : 'No'}
                  </Text>
                  <Text style={styles.iotInfoText}>
                    🍼 Bottle Status: {sensorData?.distance && sensorData.distance < 60 ? 'No bottle detected (too close)' : 'Bottle detected'}
                  </Text>
                  <Text style={styles.iotInfoText}>
                    �🔧 Calibration: {isCalibrated ? 'Calibrated ✅' : 'Not Calibrated ❌'}
                  </Text>
                  <Text style={styles.iotInfoText}>
                    💧 Water Level: {(currentWaterLevel * 100).toFixed(1)}% ({isCalibrated ? 'App Calculated' : 'ESP32 Raw'})
                  </Text>
                  <Text style={styles.iotInfoText}>
                    ⏰ Last update: {lastUpdateTime ? new Date(lastUpdateTime).toLocaleTimeString() : 'No data'}
                  </Text>
                  <Text style={styles.iotInfoText}>
                    📊 Data: {isDataFresh ? 'Fresh' : 'Stale'}
                  </Text>
                  <Text style={styles.iotInfoText}>
                    😴 Power: {isConnected ? 'Active' : 'Disconnected/Sleeping'}
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
                          <Text style={styles.bluetoothButtonText} numberOfLines={1} adjustsFontSizeToFit>
                            {isConnecting ? 'Connecting...' : 'Connect'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.bluetoothButton, styles.rescanButton]}
                          onPress={handleScanForDevices}
                          disabled={isScanning}
                        >
                          <Text style={styles.bluetoothButtonText} numberOfLines={1} adjustsFontSizeToFit>
                            {isScanning ? 'Scanning...' : 'Rescan'}
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

        {/* Bottle Size Selection Modal */}
        <Modal
          visible={showBottleSizeModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowBottleSizeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Select Bottle Size</Text>
              <Text style={styles.modalSubtitle}>
                Choose your water bottle capacity for accurate tracking
              </Text>
              
              <FlatList
                data={BOTTLE_SIZES}
                keyExtractor={(item) => item.value.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.deviceItem,
                      selectedBottleSize === item.value && styles.selectedDeviceItem
                    ]}
                    onPress={() => handleBottleSizeSelect(item.value)}
                  >
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>
                        {item.label}
                      </Text>
                      <Text style={styles.deviceName}>
                        Capacity: {item.value}ml
                      </Text>
                    </View>
                    {selectedBottleSize === item.value && (
                      <Text style={styles.deviceName}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowBottleSizeModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    marginTop: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  bluetoothButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 90,
    maxWidth: '47%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectButton: {
    backgroundColor: '#28A745',
  },
  scanButton: {
    backgroundColor: '#2196F3',
  },
  rescanButton: {
    backgroundColor: '#FF9800',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  bluetoothButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedDeviceText: {
    ...Typography.body,
    color: Colors.text.dark,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  connectedDeviceText: {
    ...Typography.body,
    color: '#fff',
    
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  deviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
    gap: 12,
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
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  calibrateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sleepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(156, 39, 176, 0.9)', // Purple for sleep
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sleepButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  wakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.9)', // Green for wake up
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  wakeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Professional Bluetooth Control Panel Styles
  bluetoothControlPanel: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectionStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  statusIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusConnected: {
    backgroundColor: '#28A745',
  },
  statusDisconnected: {
    backgroundColor: '#DC3545',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  deviceLabel: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
  },
  connectionControls: {
    marginBottom: 16,
  },
  disconnectedControls: {
    alignItems: 'stretch',
  },
  selectedDeviceContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  bluetoothDeviceInfo: {
    marginBottom: 12,
  },
  bluetoothDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  bluetoothDeviceId: {
    fontSize: 12,
    color: '#6C757D',
    fontFamily: 'monospace',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#007BFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: '60%',
    maxWidth: '65%',
    shadowColor: '#007BFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryConnectButton: {
    backgroundColor: '#28A745',
  },
  secondaryButton: {
    backgroundColor: '#6C757D',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: '30%',
    maxWidth: '35%',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#fff',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonIcon: {
    fontSize: 14,
    marginRight: 6,
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  connectedControls: {
    alignItems: 'center',
  },
  professionalDisconnectButton: {
    backgroundColor: '#DC3545',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  advancedControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  professionalDiagnosticButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  diagnosticButtonIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  professionalDiagnosticButtonText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },
  // New styles for bottle configuration
  configurationContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  bottleSizeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
  },
  bottleSizeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickActionsColumn: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  configurationCard: {
    backgroundColor: '#007BFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configInfo: {
    flex: 1,
  },
  configLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  configValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  calibrationWarning: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.4)',
  },
  warningText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});