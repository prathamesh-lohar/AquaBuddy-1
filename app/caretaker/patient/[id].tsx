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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCaretakerAuth } from '../../../providers/caretaker-auth-provider';
import { useBluetoothWater } from '../../../hooks/useBluetoothWater';
import { WaterBottle } from '../../../components/WaterBottle';
import { ProgressBar } from '../../../components/ProgressBar';
import { StatCard } from '../../../components/StatCard';
import { TipCard } from '../../../components/TipCard';
import { SimpleCalibrationModal } from '../../../components/SimpleCalibrationModal';

import { Colors, Typography, Spacing } from '../../../constants/theme';
import { formatWaterAmount, getMotivationalTip } from '../../../utils/waterUtils';
import { calibrationService } from '../../../services/CalibrationService';
import { Patient, DeviceCalibration } from '../../../types';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { patients, caretaker, refreshData } = useCaretakerAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [currentTip] = useState(getMotivationalTip());
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  // Find the patient data
  const patient = patients.find(p => p.id === id);

  // Bluetooth IoT Integration
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
  } = useBluetoothWater();

  // Set active patient for this device when component mounts
  useEffect(() => {
    if (patient?.id && isConnected) {
      // Import the service directly for patient management
      import('../../../services/BluetoothWaterService').then(({ bluetoothWaterService }) => {
        bluetoothWaterService.setActivePatient(patient.id);
      });
    }
  }, [patient?.id, isConnected]);

  // Use real IoT data if connected, otherwise mock data
  const currentWaterLevel = (() => {
    try {
      if (isConnected && sensorData && isDataFresh) {
        console.log('📊 Using real-time sensor data:', sensorData);
        const MIN_VALID_DISTANCE = 40; // mm - anything closer is likely not a bottle
        
        if (sensorData.distance < MIN_VALID_DISTANCE) {
          console.log(`⚠️ Distance too close (${sensorData.distance}mm) - likely no bottle detected`);
          return 0; // No bottle detected
        }
        
        if (calibrationService.isDeviceCalibrated() && patient?.deviceCalibration?.isCalibrated) {
          // Use patient's calibration data
          const { emptyBaseline, fullBaseline } = patient.deviceCalibration;
          const calculatedLevel = Math.max(0, Math.min(100, 
            ((emptyBaseline - sensorData.distance) / (emptyBaseline - fullBaseline)) * 100
          ));
          console.log(`📏 Calibrated level: ${calculatedLevel}% (distance: ${sensorData.distance}mm)`);
          return calculatedLevel / 100; // Return as 0-1 range
        } else {
          // Use sensor's calculated water level if not calibrated
          const sensorLevel = sensorData.waterLevel || 0;
          console.log(`📊 Sensor level: ${sensorLevel}%`);
          return Math.min(Math.max(sensorLevel / 100, 0), 1);
        }
      }
      
      // Use patient's stored water level if available
      if (patient?.currentWaterLevel !== undefined && patient.currentWaterLevel >= 0) {
        return Math.min(Math.max(patient.currentWaterLevel / 100, 0), 1);
      }
      
      // Fallback to sensible mock data
      return 0.65;
    } catch (error) {
      console.error('Error calculating water level:', error);
      return 0.65; // Safe fallback
    }
  })();

  // Mock real-time data (enhanced with IoT integration)
  const [mockData, setMockData] = useState(() => {
    // Calculate initial values based on patient data and current water level
    const baseConsumption = patient?.dailyGoal ? Math.floor(patient.dailyGoal * 0.7) : 1400;
    return {
      dailyConsumed: patient?.todayIntakes?.reduce((sum, intake) => sum + intake.amount, 0) || baseConsumption,
      lastDrinkTime: new Date(Date.now() - 45 * 60000), // 45 minutes ago
    };
  });

  // Initialize calibration service
  useEffect(() => {
    const initCalibration = async () => {
      await calibrationService.loadCalibration();
      setIsCalibrated(calibrationService.isDeviceCalibrated());
    };
    initCalibration();
  }, []);

  // Check for calibration needed when device connects
  useEffect(() => {
    if (isConnected && !isCalibrated) {
      Alert.alert(
        'Device Calibration Required',
        'The IoT water bottle needs to be calibrated for accurate patient monitoring. Would you like to calibrate it now?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Calibrate Now', onPress: () => setShowCalibrationModal(true) },
        ]
      );
    }
  }, [isConnected, isCalibrated]);

  // Real-time data refresh effect
  useEffect(() => {
    let refreshInterval: any;
    
    if (isConnected && sensorData) {
      // Refresh the display every 2 seconds when connected
      refreshInterval = setInterval(() => {
        // Force re-render to update timestamps and fresh data indicators
        setMockData(prev => ({
          ...prev,
          lastDrinkTime: sensorData.waterLevel !== undefined && sensorData.waterLevel > 0 ? 
            new Date(sensorData.timestamp) : prev.lastDrinkTime,
        }));
      }, 2000);
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isConnected, sensorData]);

  useEffect(() => {
    if (!patient) {
      Alert.alert(
        'Patient Not Found',
        'The requested patient could not be found.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [patient]);

  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      // Refresh caretaker data
      await refreshData();
      
      // Simulate fetching fresh IoT data with more realistic values
      const baseGoal = patient?.dailyGoal || 2000;
      const newConsumed = Math.floor(Math.random() * baseGoal * 0.4 + baseGoal * 0.4); // 40-80% of goal
      
      setMockData(prev => ({
        ...prev,
        dailyConsumed: newConsumed,
        lastDrinkTime: new Date(Date.now() - Math.random() * 2 * 60 * 60000), // 0-2 hours ago
      }));
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  // Handle calibration completion
  const handleCalibrationComplete = async (calibration: DeviceCalibration) => {
    try {
      setIsCalibrated(true);
      setShowCalibrationModal(false);
      
      // Save calibration to patient's profile if we have an active patient
      if (patient?.id) {
        // Import the service and save patient-specific calibration
        const { bluetoothWaterService } = await import('../../../services/BluetoothWaterService');
        await bluetoothWaterService.savePatientCalibration();
        
        // Update patient in caretaker context with calibration data
        if (refreshData) {
          await refreshData();
        }
      }
      
      Alert.alert(
        'Calibration Complete!',
        'The IoT device has been successfully calibrated for accurate patient monitoring. The calibration is saved to this patient\'s profile.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error completing calibration:', error);
      Alert.alert(
        'Calibration Error',
        'There was an issue saving the calibration. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading patient data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate bottle capacity (assume 1000ml bottle capacity)
  const bottleCapacity = patient?.deviceCalibration?.bottleCapacity || 1000;
  const currentWaterAmount = Math.round(currentWaterLevel * bottleCapacity);
  const progressPercentage = Math.min((mockData.dailyConsumed / (patient?.dailyGoal || 2000)) * 100, 100);
  const remainingGoal = Math.max(0, (patient?.dailyGoal || 2000) - mockData.dailyConsumed);

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

  const getLastDrinkText = () => {
    const timeDiff = Date.now() - mockData.lastDrinkTime.getTime();
    const minutes = Math.floor(timeDiff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
  };

  const getHydrationStatus = () => {
    if (progressPercentage >= 80) return { status: 'Excellent', color: '#4CAF50' };
    if (progressPercentage >= 60) return { status: 'Good', color: '#8BC34A' };
    if (progressPercentage >= 40) return { status: 'Fair', color: '#FF9800' };
    return { status: 'Needs Attention', color: '#F44336' };
  };

  const hydrationStatus = getHydrationStatus();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <LinearGradient
        colors={['#E3F2FD', '#FFFFFF']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Patient Monitor</Text>
            <Text style={styles.headerSubtitle}>Patient Dashboard</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

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
          {/* Patient Info Header */}
          <View style={styles.patientInfoHeader}>
            <Text style={styles.greeting}>
              {getGreeting()}, monitoring {patient?.name || 'Unknown Patient'} 👋
            </Text>
            <Text style={styles.date}>{formatDate()}</Text>
            
            {/* Device Connection Status */}
            <View style={styles.connectionStatus}>
              <View style={[
                styles.connectionDot, 
                { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }
              ]} />
              <Text style={styles.connectionText}>
                IoT Device {isConnected ? 'Connected' : 'Disconnected'} 
                {isDataFresh && isConnected ? ' • Live Data' : isConnected ? ' • No Data' : ''}
              </Text>
              {connectionError && (
                <Text style={[styles.connectionText, { color: '#F44336', fontSize: 11 }]}>
                  {connectionError}
                </Text>
              )}
            </View>
          </View>

          {/* Patient Details Card */}
          <View style={styles.patientDetailsCard}>
            <Text style={styles.sectionTitle}>Patient Information</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{patient?.name || 'Unknown'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Age</Text>
                <Text style={styles.detailValue}>{patient?.age ? `${patient.age} years` : 'Not specified'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Weight</Text>
                <Text style={styles.detailValue}>{patient?.weight ? `${patient.weight} kg` : 'Not specified'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Daily Goal</Text>
                <Text style={styles.detailValue}>{patient?.dailyGoal || 2000}ml</Text>
              </View>
            </View>
            
            {patient.notes && (
              <View style={styles.medicalConditions}>
                <Text style={styles.detailLabel}>Notes</Text>
                <View style={styles.conditionsWrapper}>
                  <Text style={styles.conditionText}>{patient.notes}</Text>
                </View>
              </View>
            )}

            {/* Emergency Contact */}
            {/* <View style={styles.emergencyContact}>
              <Text style={styles.detailLabel}>Emergency Contact</Text>
              <Text style={styles.detailValue}>{patient.emergencyContact.name}</Text>
              <Text style={styles.emergencyPhone}>{patient.emergencyContact.phone}</Text>
              <Text style={styles.emergencyRelation}>{patient.emergencyContact.relationship}</Text>
            </View> */}
          </View>

          {/* Water Bottle Visualization */}
          <View style={styles.bottleContainer}>
            <WaterBottle 
              progress={Math.min(Math.max(currentWaterLevel, 0), 1)} 
              capacity={bottleCapacity} 
            />
            <Text style={styles.bottleStatus}>
              {currentWaterAmount}ml / {bottleCapacity}ml
            </Text>
            <Text style={styles.bottleSubtext}>
              Current Bottle Level: {Math.round(currentWaterLevel * 100)}%
            </Text>
            <Text style={styles.lastDrinkText}>
              Last drink: {getLastDrinkText()}
            </Text>
          </View>

          {/* Daily Stats */}
          <View style={styles.statsContainer}>
            <StatCard
              label="Daily Goal"
              value={formatWaterAmount(patient?.dailyGoal || 2000, 'ml')}
              color={Colors.text.medium}
            />
            <StatCard
              label="Consumed"
              value={formatWaterAmount(mockData.dailyConsumed || 0, 'ml')}
              color={Colors.primary}
            />
            <StatCard
              label="Remaining"
              value={formatWaterAmount(remainingGoal, 'ml')}
              color={Colors.accent}
            />
          </View>

          {/* Daily Progress */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressTitle}>Daily Hydration Progress</Text>
            <ProgressBar progress={progressPercentage} />
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {Math.round(progressPercentage)}% of daily goal achieved
              </Text>
              <Text style={[styles.statusText, { color: hydrationStatus.color }]}>
                Status: {hydrationStatus.status}
              </Text>
            </View>
          </View>

          {/* Device Information */}
          <View style={styles.deviceInfoContainer}>
            <Text style={styles.sectionTitle}>Smart Bottle Status</Text>
            <View style={[styles.deviceInfo, { borderLeftColor: isConnected ? '#4CAF50' : '#F44336' }]}>
              <Text style={styles.deviceInfoText}>
                📱 Status: {isConnected ? 'Connected' : 'Disconnected'}
                {isConnecting ? ' (Connecting...)' : ''}
                {isScanning ? ' (Scanning...)' : ''}
              </Text>
              <Text style={styles.deviceInfoText}>
                💧 Water Level: {(currentWaterLevel * 100).toFixed(1)}%
                {isConnected && sensorData ? ` (Live: ${sensorData.distance}mm)` : ''}
              </Text>
              <Text style={styles.deviceInfoText}>
                🕐 Last Update: {isConnected && sensorData && isDataFresh ? 
                  new Date(sensorData.timestamp).toLocaleTimeString() : 
                  mockData.lastDrinkTime.toLocaleTimeString()
                }
                {isDataFresh && isConnected ? ' 🟢' : !isConnected ? ' 🔴' : ' 🟡'}
              </Text>
              <Text style={styles.deviceInfoText}>
                📊 Daily Progress: {Math.round(progressPercentage)}%
              </Text>
              <Text style={styles.deviceInfoText}>
                🎯 Goal: {patient?.dailyGoal || 2000}ml
              </Text>
              <Text style={styles.deviceInfoText}>
                🔋 Device: {isConnected ? 'Online' : 'Offline'}
                {selectedDevice ? ` (${selectedDevice.name || selectedDevice.id})` : ''}
              </Text>
              <Text style={styles.deviceInfoText}>
                📏 Calibrated: {isCalibrated ? 'Yes' : 'No'}
                {patient?.deviceCalibration?.isCalibrated ? ' (Patient-specific)' : ''}
              </Text>
              {availableDevices.length > 0 && !isConnected && (
                <Text style={styles.deviceInfoText}>
                  📡 Found Devices: {availableDevices.length}
                </Text>
              )}
            </View>
            
            {/* Device Control Buttons */}
            <View style={styles.deviceButtons}>
              {!isConnected ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.deviceActionButton, 
                      { backgroundColor: isScanning ? '#FF9800' : '#2196F3' }
                    ]}
                    onPress={async () => {
                      if (isScanning) {
                        stopScanning();
                      } else {
                        await scanForDevices();
                      }
                    }}
                    disabled={isConnecting}
                  >
                    <Text style={styles.deviceActionButtonText}>
                      {isScanning ? '⏹️ Stop Scan' : '🔍 Scan Devices'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.deviceActionButton, 
                      { 
                        backgroundColor: availableDevices.length > 0 ? '#4CAF50' : '#9E9E9E',
                        opacity: isConnecting ? 0.5 : 1
                      }
                    ]}
                    onPress={async () => {
                      if (availableDevices.length > 0) {
                        // Connect to first available device or selected device
                        const deviceToConnect = selectedDevice || availableDevices[0];
                        selectDevice(deviceToConnect);
                        const success = await connectToDevice(deviceToConnect.id);
                        if (success && patient) {
                          // Import the service and set active patient
                          const { bluetoothWaterService } = await import('../../../services/BluetoothWaterService');
                          bluetoothWaterService.setActivePatient(patient.id);
                          
                          Alert.alert(
                            'Connected!',
                            `Connected to ${deviceToConnect.name || deviceToConnect.id}. Real-time monitoring active.`,
                            [{ text: 'OK' }]
                          );
                        }
                      } else {
                        Alert.alert(
                          'No Devices Found',
                          'Please scan for devices first.',
                          [{ text: 'OK' }]
                        );
                      }
                    }}
                    disabled={isConnecting || availableDevices.length === 0}
                  >
                    <Text style={styles.deviceActionButtonText}>
                      {isConnecting ? '� Connecting...' : 
                       availableDevices.length > 0 ? `📡 Connect (${availableDevices.length})` : '📡 No Devices'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.deviceActionButton, 
                    { backgroundColor: '#f44336' }
                  ]}
                  onPress={async () => {
                    await disconnectDevice();
                    Alert.alert(
                      'Disconnected',
                      'Device disconnected. Real-time monitoring stopped.',
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <Text style={styles.deviceActionButtonText}>
                    � Disconnect
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[
                  styles.deviceActionButton,
                  styles.calibrateButton,
                  { opacity: isConnected ? 1 : 0.5 }
                ]}
                onPress={() => setShowCalibrationModal(true)}
                disabled={!isConnected}
              >
                <Text style={styles.deviceActionButtonText}>
                  ⚙️ {isCalibrated ? 'Recalibrate' : 'Calibrate'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Caretaker Actions */}
          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Caretaker Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.reminderButton]}>
                <Text style={styles.actionButtonText}>📱 Send Reminder</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.callButton]}>
                <Text style={styles.actionButtonText}>📞 Call Patient</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.emergencyButton]}>
                <Text style={styles.actionButtonText}>🚨 Emergency Contact</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.notesButton]}>
                <Text style={styles.actionButtonText}>📝 Add Notes</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hydration Tip */}
          <TipCard tip={currentTip} />

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </LinearGradient>

      {/* Simple Calibration Modal for IoT device calibration */}
      <SimpleCalibrationModal
        visible={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        onComplete={async (calibration) => {
          await handleCalibrationComplete(calibration);
        }}
        sensorData={sensorData}
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? Spacing.md : Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.text.medium,
  },
  headerRight: {
    width: 40,
  },
  patientInfoHeader: {
    paddingHorizontal: Spacing.lg,
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
  patientDetailsCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.md,
    fontWeight: '700',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  detailItem: {
    width: '48%',
    marginBottom: Spacing.md,
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.text.medium,
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    ...Typography.body,
    color: Colors.text.dark,
    fontWeight: '600',
  },
  medicalConditions: {
    marginBottom: Spacing.lg,
  },
  conditionsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  conditionTag: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  conditionText: {
    ...Typography.caption,
    color: '#E65100',
    fontWeight: '600',
  },
  emergencyContact: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FFCCCB',
  },
  emergencyPhone: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  emergencyRelation: {
    ...Typography.caption,
    color: Colors.text.medium,
    marginTop: 2,
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
  lastDrinkText: {
    ...Typography.caption,
    color: Colors.text.light,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
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
    fontWeight: '700',
  },
  progressInfo: {
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  progressText: {
    ...Typography.body,
    color: Colors.text.medium,
    textAlign: 'center',
  },
  statusText: {
    ...Typography.body,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  deviceInfoContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  deviceInfo: {
    backgroundColor: 'rgba(0, 201, 255, 0.1)',
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  deviceInfoText: {
    ...Typography.body,
    color: Colors.text.dark,
    marginBottom: Spacing.xs,
  },
  actionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  actionButton: {
    width: '48%',
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reminderButton: {
    backgroundColor: '#4CAF50',
  },
  callButton: {
    backgroundColor: '#2196F3',
  },
  emergencyButton: {
    backgroundColor: '#F44336',
  },
  notesButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: Spacing.xxl,
  },
  deviceButtons: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  deviceActionButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  calibrateButton: {
    backgroundColor: '#9C27B0',
  },
  deviceActionButtonText: {
    ...Typography.caption,
    color: 'white',
    fontWeight: '600',
  },
});