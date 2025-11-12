import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCaretakerAuth } from '../../providers/caretaker-auth-provider';
import { useBluetoothWater } from '../../hooks/useBluetoothWater';
import { BluetoothDevice } from '../../services/BluetoothWaterService';
import { Colors, Typography, Spacing } from '../../constants/theme';

interface PatientFormData {
  name: string;
  age: string;
  weight: string;
  dailyGoal: string;
  notes: string;
}

export default function AddPatientScreen() {
  const { addPatient, updatePatientDeviceStatus } = useCaretakerAuth();
  const [currentStep, setCurrentStep] = useState<'info' | 'device'>('info');
  const [isLoading, setIsLoading] = useState(false);
  
  // Patient form data
  const [formData, setFormData] = useState<PatientFormData>({
    name: '',
    age: '',
    weight: '',
    dailyGoal: '2000',
    notes: '',
  });

  // Device selection
  const {
    isConnected,
    isConnecting,
    isScanning,
    availableDevices,
    selectedDevice,
    connectionError,
    scanForDevices,
    stopScanning,
    selectDevice,
    connectToDevice,
    disconnectDevice,
    ensureServiceReady,
  } = useBluetoothWater();

  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);

  useEffect(() => {
    // If device gets connected, complete the process
    if (isConnected && createdPatientId && selectedDevice) {
      console.log('✅ Device connected successfully, completing setup...');
      handleDeviceConnected();
    }
  }, [isConnected, createdPatientId, selectedDevice?.id]);

  // Cleanup on unmount - only stop scanning, don't destroy service
  useEffect(() => {
    return () => {
      if (isScanning) {
        console.log('🛑 Stopping device scan on unmount...');
        stopScanning();
      }
      // Don't disconnect the device if it's connected, as we want to keep it for the patient
    };
  }, [isScanning]);

  const handlePatientInfoSubmit = async () => {
    // Validate form
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter patient name');
      return;
    }

    if (!formData.age.trim() || isNaN(Number(formData.age))) {
      Alert.alert('Error', 'Please enter a valid age');
      return;
    }

    if (!formData.weight.trim() || isNaN(Number(formData.weight))) {
      Alert.alert('Error', 'Please enter a valid weight');
      return;
    }

    if (!formData.dailyGoal.trim() || isNaN(Number(formData.dailyGoal))) {
      Alert.alert('Error', 'Please enter a valid daily goal');
      return;
    }

    setIsLoading(true);

    try {
      // Create patient
      const patientData = {
        name: formData.name.trim(),
        age: parseInt(formData.age),
        weight: parseInt(formData.weight),
        dailyGoal: parseInt(formData.dailyGoal),
        notes: formData.notes.trim(),
      };

      const patientId = await addPatient(patientData);
      setCreatedPatientId(patientId);
      setCurrentStep('device');
      
      // Auto-start scanning for devices
      scanForDevices();
    } catch (error) {
      Alert.alert('Error', 'Failed to add patient. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeviceSelection = async (device: BluetoothDevice) => {
    if (isConnecting) {
      console.log('⚠️ Device connection already in progress...');
      return;
    }
    
    console.log('🔗 Selecting device:', device.name || device.id);
    
    try {
      // Ensure service is ready before attempting connection
      const serviceReady = await ensureServiceReady();
      if (!serviceReady) {
        throw new Error('Bluetooth service not ready');
      }
      
      selectDevice(device);
      console.log('📡 Attempting to connect to device...');
      await connectToDevice();
    } catch (error) {
      console.error('❌ Device connection error:', error);
      Alert.alert(
        'Connection Error', 
        `Failed to connect to device: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleDeviceConnected = async () => {
    if (!createdPatientId || !selectedDevice) {
      console.log('⚠️ Missing patient ID or selected device');
      return;
    }

    try {
      console.log('🔄 Updating patient with device connection...');
      
      // Update patient with device connection
      await updatePatientDeviceStatus(createdPatientId, true);
      
      console.log('✅ Patient device status updated successfully');
      
      Alert.alert(
        'Success!',
        `Patient added successfully and device "${selectedDevice.name || selectedDevice.id}" connected. Real-time monitoring is now active.`,
        [
          {
            text: 'View Patient',
            onPress: () => {
              router.replace(`/caretaker/patient/${createdPatientId}`);
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error updating patient device status:', error);
      Alert.alert(
        'Partial Success', 
        'Patient added successfully but there was an issue saving device connection. You can connect the device later from the patient details.',
        [
          {
            text: 'Continue',
            onPress: () => {
              router.replace('/caretaker/dashboard');
            },
          },
        ]
      );
    }
  };

  const handleSkipDevice = () => {
    Alert.alert(
      'Skip Device Connection?',
      'You can connect a device later from the patient details page.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            // Stop any ongoing operations
            if (isScanning) {
              stopScanning();
            }
            router.replace('/caretaker/dashboard');
          },
        },
      ]
    );
  };

  const renderPatientInfoForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>Patient Information</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Patient Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="Enter patient name"
          placeholderTextColor={Colors.text.light}
          editable={!isLoading}
        />
      </View>

      <View style={styles.rowContainer}>
        <View style={[styles.inputContainer, styles.halfWidth]}>
          <Text style={styles.inputLabel}>Age *</Text>
          <TextInput
            style={styles.input}
            value={formData.age}
            onChangeText={(text) => setFormData({ ...formData, age: text })}
            placeholder="Years"
            placeholderTextColor={Colors.text.light}
            keyboardType="numeric"
            editable={!isLoading}
          />
        </View>

        <View style={[styles.inputContainer, styles.halfWidth]}>
          <Text style={styles.inputLabel}>Weight *</Text>
          <TextInput
            style={styles.input}
            value={formData.weight}
            onChangeText={(text) => setFormData({ ...formData, weight: text })}
            placeholder="Kg"
            placeholderTextColor={Colors.text.light}
            keyboardType="numeric"
            editable={!isLoading}
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Daily Goal (ml) *</Text>
        <TextInput
          style={styles.input}
          value={formData.dailyGoal}
          onChangeText={(text) => setFormData({ ...formData, dailyGoal: text })}
          placeholder="2000"
          placeholderTextColor={Colors.text.light}
          keyboardType="numeric"
          editable={!isLoading}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="Medical conditions, allergies, special instructions..."
          placeholderTextColor={Colors.text.light}
          multiline
          numberOfLines={3}
          editable={!isLoading}
        />
      </View>

      <TouchableOpacity 
        style={[styles.primaryButton, isLoading && styles.disabledButton]}
        onPress={handlePatientInfoSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.primaryButtonText}>Continue to Device Setup</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderDeviceSelection = () => (
    <View style={styles.deviceContainer}>
      <Text style={styles.sectionTitle}>Connect IoT Device</Text>
      <Text style={styles.sectionDescription}>
        Select a smart water bottle from the available devices
      </Text>

      <View style={styles.scanningContainer}>
        {isScanning ? (
          <View style={styles.scanningStatus}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.scanningText}>Scanning for devices...</Text>
            <TouchableOpacity onPress={stopScanning} style={styles.stopScanButton}>
              <Text style={styles.stopScanText}>Stop Scanning</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={scanForDevices} style={styles.scanButton}>
            <Ionicons name="bluetooth-outline" size={24} color="white" />
            <Text style={styles.scanButtonText}>Scan for Devices</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Available Devices */}
      <View style={styles.devicesContainer}>
        <Text style={styles.devicesTitle}>Available Devices ({availableDevices.length})</Text>
        
        {availableDevices.length === 0 ? (
          <View style={styles.noDevicesContainer}>
            <Ionicons name="bluetooth-outline" size={48} color={Colors.text.light} />
            <Text style={styles.noDevicesText}>No devices found</Text>
            <Text style={styles.noDevicesSubtext}>
              Make sure your smart bottle is powered on and in pairing mode
            </Text>
          </View>
        ) : (
          availableDevices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={[
                styles.deviceItem,
                selectedDevice?.id === device.id && styles.selectedDevice,
                isConnecting && styles.connectingDevice,
              ]}
              onPress={() => handleDeviceSelection(device)}
              disabled={isConnecting}
            >
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name || 'Smart Water Bottle'}</Text>
                <Text style={styles.deviceId}>{device.id}</Text>
              </View>
              
              <View style={styles.deviceActions}>
                {isConnecting && selectedDevice?.id === device.id ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : isConnected && selectedDevice?.id === device.id ? (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                ) : (
                  <Ionicons name="radio-button-off" size={24} color={Colors.text.light} />
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.deviceActionButtons}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkipDevice}>
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>
        
        {isConnected && (
          <TouchableOpacity style={styles.completeButton} onPress={handleDeviceConnected}>
            <Text style={styles.completeButtonText}>Complete Setup</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <LinearGradient
        colors={['#F0F9FF', '#FFFFFF']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Add Patient</Text>
            <Text style={styles.headerSubtitle}>
              {currentStep === 'info' ? 'Step 1: Patient Info' : 'Step 2: Device Setup'}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 'info' ? renderPatientInfoForm() : renderDeviceSelection()}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? Spacing.md : Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.header,
    color: Colors.text.dark,
    marginBottom: Spacing.sm,
    fontWeight: '700',
  },
  sectionDescription: {
    ...Typography.body,
    color: Colors.text.medium,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  inputLabel: {
    ...Typography.body,
    color: Colors.text.dark,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.text.dark,
    backgroundColor: 'white',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  deviceContainer: {
    padding: Spacing.lg,
  },
  scanningContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  scanningStatus: {
    alignItems: 'center',
  },
  scanningText: {
    ...Typography.body,
    color: Colors.text.medium,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  stopScanButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
  },
  stopScanText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  devicesContainer: {
    marginBottom: Spacing.xl,
  },
  devicesTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  noDevicesContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.background.light,
    borderStyle: 'dashed',
  },
  noDevicesText: {
    ...Typography.body,
    color: Colors.text.medium,
    marginTop: Spacing.md,
    fontWeight: '600',
  },
  noDevicesSubtext: {
    ...Typography.caption,
    color: Colors.text.light,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedDevice: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F9FF',
  },
  connectingDevice: {
    opacity: 0.7,
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
  },
  deviceActions: {
    marginLeft: Spacing.sm,
  },
  deviceActionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  skipButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.text.light,
  },
  skipButtonText: {
    color: Colors.text.medium,
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});