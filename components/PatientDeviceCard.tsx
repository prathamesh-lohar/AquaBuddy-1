import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Patient } from '../types';
import { Colors, Spacing } from '../constants/theme';
import { bluetoothWaterService } from '../services/BluetoothWaterService';
import { WaterBottle } from './WaterBottle';
import { ProgressBar } from './ProgressBar';
import { formatWaterAmount } from '../utils/waterUtils';

interface PatientDeviceCardProps {
  patient: Patient;
  onPatientPress: () => void;
  onUpdatePatient: (patientId: string, updates: Partial<Patient>) => void;
}

export const PatientDeviceCard: React.FC<PatientDeviceCardProps> = ({
  patient,
  onPatientPress,
  onUpdatePatient,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [sensorData, setSensorData] = useState<any>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // Calculate water levels and progress
  const currentBottleLevel = patient.currentWaterLevel || 0;
  const bottleCapacity = patient.deviceCalibration?.bottleCapacity || 1000;
  const currentWaterAmount = Math.round(currentBottleLevel * bottleCapacity / 100);
  
  // Calculate daily progress
  const todayIntakes = patient.todayIntakes || [];
  const totalConsumed = todayIntakes.reduce((sum, intake) => sum + intake.amount, 0);
  const dailyGoal = patient.dailyGoal || 2000;
  const progressPercentage = Math.min((totalConsumed / dailyGoal) * 100, 100);

  // Subscribe to device data updates if this patient's device is connected
  useEffect(() => {
    if (patient.deviceId && patient.isConnected) {
      const dataListener = (data: any) => {
        // Check if this data is for our patient's device
        if (data.device === patient.deviceId) {
          setSensorData(data);
          setLastUpdateTime(new Date());
          
          // Update patient water level in real-time
          if (onUpdatePatient) {
            onUpdatePatient(patient.id, {
              currentWaterLevel: data.waterLevel,
              lastSync: new Date().toISOString(),
            });
          }
        }
      };

      bluetoothWaterService.addDataListener(dataListener);

      return () => {
        bluetoothWaterService.removeDataListener(dataListener);
      };
    }
  }, [patient.deviceId, patient.isConnected, patient.id]);

  const handleConnectDevice = async () => {
    if (!patient.deviceId) {
      Alert.alert(
        'No Device',
        'No Bluetooth device assigned to this patient. Please assign a device first.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsConnecting(true);
    try {
      // Find the device in available devices
      const success = await bluetoothWaterService.connectToDevice(patient.deviceId);
      
      if (success) {
        // Update patient connection status
        if (onUpdatePatient) {
          onUpdatePatient(patient.id, {
            isConnected: true,
            lastSync: new Date().toISOString(),
          });
        }
        
        Alert.alert(
          'Connected',
          `Successfully connected to ${patient.name}'s device!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Connection Failed',
          'Unable to connect to the device. Make sure it\'s nearby and powered on.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error connecting to patient device:', error);
      Alert.alert(
        'Connection Error',
        'An error occurred while connecting to the device.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectDevice = async () => {
    try {
      await bluetoothWaterService.disconnect();
      
      // Update patient connection status
      if (onUpdatePatient) {
        onUpdatePatient(patient.id, {
          isConnected: false,
        });
      }
      
      Alert.alert(
        'Disconnected',
        `Disconnected from ${patient.name}'s device.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error disconnecting from patient device:', error);
    }
  };

  const getConnectionStatusColor = () => {
    if (patient.isConnected) return '#4CAF50';
    if (isConnecting) return '#FF9800';
    return '#F44336';
  };

  const getConnectionStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (patient.isConnected) return 'Connected';
    return 'Disconnected';
  };

  const getHydrationStatusColor = () => {
    if (progressPercentage >= 80) return '#4CAF50';
    if (progressPercentage >= 50) return '#FF9800';
    return '#F44336';
  };

  const isDataFresh = lastUpdateTime && (Date.now() - lastUpdateTime.getTime()) < 30000; // 30 seconds

  return (
    <TouchableOpacity style={styles.container} onPress={onPatientPress}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFF']}
        style={styles.gradient}
      >
        {/* Patient Header */}
        <View style={styles.header}>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{patient.name}</Text>
            <Text style={styles.patientDetails}>
              {patient.age && `Age: ${patient.age}`}
              {patient.weight && ` • Weight: ${patient.weight}kg`}
            </Text>
            {patient.notes && (
              <Text style={styles.patientNotes} numberOfLines={2}>
                {patient.notes}
              </Text>
            )}
          </View>
          <View style={styles.statusContainer}>
            <View style={[styles.connectionDot, { backgroundColor: getConnectionStatusColor() }]} />
            <Text style={[styles.connectionStatus, { color: getConnectionStatusColor() }]}>
              {getConnectionStatusText()}
            </Text>
          </View>
        </View>

        {/* Device Data Section */}
        {patient.isConnected ? (
          <View style={styles.deviceDataContainer}>
            <View style={styles.deviceDataRow}>
              {/* Water Bottle Visualization */}
              <View style={styles.bottleSection}>
                <WaterBottle 
                  progress={currentBottleLevel / 100} 
                  capacity={bottleCapacity}
                  size={80}
                />
                <Text style={styles.bottleLabel}>Current Bottle</Text>
                <Text style={styles.bottleAmount}>
                  {currentWaterAmount}ml / {bottleCapacity}ml
                </Text>
                <Text style={styles.bottlePercentage}>
                  {Math.round(currentBottleLevel)}%
                </Text>
              </View>

              {/* Daily Progress */}
              <View style={styles.progressSection}>
                <Text style={styles.progressTitle}>Daily Progress</Text>
                <ProgressBar 
                  progress={progressPercentage} 
                  height={8}
                />
                <Text style={styles.progressText}>
                  {totalConsumed}ml / {dailyGoal}ml
                </Text>
                <Text style={[styles.progressPercentage, { color: getHydrationStatusColor() }]}>
                  {Math.round(progressPercentage)}% Complete
                </Text>
              </View>
            </View>

            {/* Real-time Data */}
            {sensorData && (
              <View style={styles.sensorDataContainer}>
                <Text style={styles.sensorDataTitle}>Real-time Sensor Data</Text>
                <View style={styles.sensorDataRow}>
                  <View style={styles.sensorDataItem}>
                    <Text style={styles.sensorDataLabel}>Distance</Text>
                    <Text style={styles.sensorDataValue}>{sensorData.distance}mm</Text>
                  </View>
                  <View style={styles.sensorDataItem}>
                    <Text style={styles.sensorDataLabel}>Water Level</Text>
                    <Text style={styles.sensorDataValue}>{Math.round(sensorData.waterLevel)}%</Text>
                  </View>
                  <View style={styles.sensorDataItem}>
                    <Text style={styles.sensorDataLabel}>Last Update</Text>
                    <Text style={[
                      styles.sensorDataValue, 
                      { color: isDataFresh ? '#4CAF50' : '#FF9800' }
                    ]}>
                      {lastUpdateTime?.toLocaleTimeString() || 'Never'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Device Actions */}
            <View style={styles.deviceActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.disconnectButton]}
                onPress={handleDisconnectDevice}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.detailsButton]}
                onPress={onPatientPress}
              >
                <Text style={styles.detailsButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Disconnected State */
          <View style={styles.disconnectedContainer}>
            <View style={styles.dailyProgressOnly}>
              <Text style={styles.progressTitle}>Daily Progress</Text>
              <ProgressBar 
                progress={progressPercentage} 
                height={8}
              />
              <Text style={styles.progressText}>
                {totalConsumed}ml / {dailyGoal}ml ({Math.round(progressPercentage)}%)
              </Text>
            </View>

            <View style={styles.disconnectedActions}>
              {patient.deviceId ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.connectButton, isConnecting && styles.connectingButton]}
                  onPress={handleConnectDevice}
                  disabled={isConnecting}
                >
                  <Text style={styles.connectButtonText}>
                    {isConnecting ? 'Connecting...' : 'Connect Device'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noDeviceText}>No device assigned</Text>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.detailsButton]}
                onPress={onPatientPress}
              >
                <Text style={styles.detailsButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Last Sync Info */}
        {patient.lastSync && (
          <View style={styles.syncInfo}>
            <Text style={styles.syncText}>
              Last sync: {new Date(patient.lastSync).toLocaleString()}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  gradient: {
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  patientInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.dark,
    marginBottom: 4,
  },
  patientDetails: {
    fontSize: 14,
    color: Colors.text.medium,
    marginBottom: 4,
  },
  patientNotes: {
    fontSize: 12,
    color: Colors.text.light,
    fontStyle: 'italic',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  connectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  connectionStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  deviceDataContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  deviceDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  bottleSection: {
    flex: 1,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  bottleLabel: {
    fontSize: 12,
    color: Colors.text.medium,
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  bottleAmount: {
    fontSize: 14,
    color: Colors.text.dark,
    fontWeight: '600',
    marginTop: 2,
  },
  bottlePercentage: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  progressSection: {
    flex: 1,
    justifyContent: 'center',
  },
  progressTitle: {
    fontSize: 14,
    color: Colors.text.dark,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  progressText: {
    fontSize: 12,
    color: Colors.text.medium,
    marginTop: Spacing.xs,
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sensorDataContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sensorDataTitle: {
    fontSize: 12,
    color: Colors.text.dark,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  sensorDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sensorDataItem: {
    alignItems: 'center',
  },
  sensorDataLabel: {
    fontSize: 10,
    color: Colors.text.light,
    marginBottom: 2,
  },
  sensorDataValue: {
    fontSize: 12,
    color: Colors.text.dark,
    fontWeight: '600',
  },
  deviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  disconnectedContainer: {
    marginBottom: Spacing.sm,
  },
  dailyProgressOnly: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  disconnectedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: Colors.primary,
  },
  connectingButton: {
    backgroundColor: Colors.text.medium,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  disconnectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  detailsButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  detailsButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  noDeviceText: {
    color: Colors.text.medium,
    fontSize: 14,
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center',
  },
  syncInfo: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  syncText: {
    fontSize: 11,
    color: Colors.text.light,
    textAlign: 'center',
  },
});