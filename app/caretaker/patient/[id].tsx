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
import { PatientUser } from '../../../types/caretaker';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { managedUsers, caretaker, refreshData } = useCaretakerAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [currentTip] = useState(getMotivationalTip());
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);

  // Find the patient data
  const patient = managedUsers.find(p => p.id === id);

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

  // Use real IoT data if connected, otherwise mock data
  const currentWaterLevel = (() => {
    if (isConnected && sensorData) {
      const MIN_VALID_DISTANCE = 40; // mm - anything closer is likely not a bottle
      
      if (sensorData.distance < MIN_VALID_DISTANCE) {
        console.log(`⚠️ Distance too close (${sensorData.distance}mm) - likely no bottle detected`);
        return 0; // No bottle detected
      }
      
      if (calibrationService.isDeviceCalibrated()) {
        return calibrationService.calculateWaterLevel(sensorData) / 100; // Convert to 0-1 range
      } else {
        return Math.min(Math.max(sensorData.waterLevel / 100, 0), 1);
      }
    }
    return 0.65; // Fallback mock data
  })();

  // Mock real-time data (enhanced with IoT integration)
  const [mockData, setMockData] = useState({
    dailyConsumed: 1400, // ml consumed today
    lastDrinkTime: new Date(Date.now() - 45 * 60000), // 45 minutes ago
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
    
    // Simulate fetching fresh IoT data
    setMockData(prev => ({
      ...prev,
      dailyConsumed: Math.floor(Math.random() * 1000 + 800), // 800-1800ml
      lastDrinkTime: new Date(Date.now() - Math.random() * 2 * 60 * 60000), // 0-2 hours ago
    }));
    
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Handle calibration completion
  const handleCalibrationComplete = async () => {
    try {
      setIsCalibrated(true);
      setShowCalibrationModal(false);
      Alert.alert(
        'Calibration Complete!',
        'The IoT device has been successfully calibrated for accurate patient monitoring.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error completing calibration:', error);
      Alert.alert(
        'Calibration Error',
        'There was an issue completing the calibration. Please try again.',
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

  const currentWaterAmount = Math.round(currentWaterLevel * patient.hydrationGoal);
  const progressPercentage = Math.min((mockData.dailyConsumed / patient.hydrationGoal) * 100, 100);
  const remainingGoal = Math.max(0, patient.hydrationGoal - mockData.dailyConsumed);

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
            <Text style={styles.headerSubtitle}>{caretaker?.facilityName}</Text>
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
              {getGreeting()}, monitoring {patient.name} 👋
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
              </Text>
            </View>
          </View>

          {/* Patient Details Card */}
          <View style={styles.patientDetailsCard}>
            <Text style={styles.sectionTitle}>Patient Information</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{patient.name}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Age</Text>
                <Text style={styles.detailValue}>{patient.age} years</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Gender</Text>
                <Text style={styles.detailValue}>{patient.gender}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Room</Text>
                <Text style={styles.detailValue}>{patient.roomNumber || 'N/A'}</Text>
              </View>
            </View>
            
            {patient.medicalConditions.length > 0 && (
              <View style={styles.medicalConditions}>
                <Text style={styles.detailLabel}>Medical Conditions</Text>
                <View style={styles.conditionsWrapper}>
                  {patient.medicalConditions.map((condition, index) => (
                    <View key={index} style={styles.conditionTag}>
                      <Text style={styles.conditionText}>{condition}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Emergency Contact */}
            <View style={styles.emergencyContact}>
              <Text style={styles.detailLabel}>Emergency Contact</Text>
              <Text style={styles.detailValue}>{patient.emergencyContact.name}</Text>
              <Text style={styles.emergencyPhone}>{patient.emergencyContact.phone}</Text>
              <Text style={styles.emergencyRelation}>{patient.emergencyContact.relationship}</Text>
            </View>
          </View>

          {/* Water Bottle Visualization */}
          <View style={styles.bottleContainer}>
            <WaterBottle progress={currentWaterLevel} capacity={patient.hydrationGoal} />
            <Text style={styles.bottleStatus}>
              {currentWaterAmount}ml / {patient.hydrationGoal}ml
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
              value={formatWaterAmount(patient.hydrationGoal, 'ml')}
              color={Colors.text.medium}
            />
            <StatCard
              label="Consumed"
              value={formatWaterAmount(mockData.dailyConsumed, 'ml')}
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
              </Text>
              <Text style={styles.deviceInfoText}>
                💧 Water Level: {(currentWaterLevel * 100).toFixed(1)}%
              </Text>
              <Text style={styles.deviceInfoText}>
                🕐 Last Update: {mockData.lastDrinkTime.toLocaleTimeString()}
              </Text>
              <Text style={styles.deviceInfoText}>
                📊 Daily Progress: {Math.round(progressPercentage)}%
              </Text>
              <Text style={styles.deviceInfoText}>
                🎯 Goal: {patient.hydrationGoal}ml
              </Text>
              <Text style={styles.deviceInfoText}>
                🔋 Device: {patient.deviceIds.length > 0 ? 'Active' : 'Not Assigned'}
              </Text>
              <Text style={styles.deviceInfoText}>
                📏 Calibrated: {isCalibrated ? 'Yes' : 'No'}
              </Text>
            </View>
            
            {/* Device Control Buttons */}
            <View style={styles.deviceButtons}>
              <TouchableOpacity
                style={[
                  styles.deviceActionButton, 
                  { backgroundColor: isConnected ? '#f44336' : '#2196F3' }
                ]}
                onPress={isConnected ? disconnectDevice : () => {
                  scanForDevices();
                  setTimeout(() => connectToDevice(), 2000); // Auto-connect after scan
                }}
                disabled={isScanning}
              >
                <Text style={styles.deviceActionButtonText}>
                  {isScanning ? '🔍 Scanning...' : isConnected ? '🔌 Disconnect' : '📡 Connect'}
                </Text>
              </TouchableOpacity>
              
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
          await handleCalibrationComplete();
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