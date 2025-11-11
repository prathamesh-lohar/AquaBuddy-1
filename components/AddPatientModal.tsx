import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useBluetoothWater } from '../hooks/useBluetoothWater';
import { useCaretakerAuth } from '../providers/caretaker-auth-provider';
import { Colors, Typography, Spacing } from '../constants/theme';
import { PatientUser } from '../types/caretaker';

interface AddPatientModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PatientFormData {
  name: string;
  age: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  roomNumber: string;
  bedNumber: string;
  medicalConditions: string;
  hydrationGoal: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  selectedDeviceId: string;
}

const initialFormData: PatientFormData = {
  name: '',
  age: '',
  gender: 'MALE',
  roomNumber: '',
  bedNumber: '',
  medicalConditions: '',
  hydrationGoal: '2000',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  selectedDeviceId: '',
};

export const AddPatientModal: React.FC<AddPatientModalProps> = ({ 
  visible, 
  onClose, 
  onSuccess 
}) => {
  const [step, setStep] = useState<'device' | 'form'>('device');
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { addPatient } = useCaretakerAuth();
  
  const {
    isScanning,
    availableDevices,
    selectedDevice,
    scanForDevices,
    stopScanning,
    selectDevice,
  } = useBluetoothWater();

  // Start scanning when modal opens on device step
  useEffect(() => {
    if (visible && step === 'device') {
      handleScanDevices();
    }
    return () => {
      stopScanning();
    };
  }, [visible, step]);

  // Reset modal state when closed
  useEffect(() => {
    if (!visible) {
      setStep('device');
      setFormData(initialFormData);
      setIsSubmitting(false);
      stopScanning();
    }
  }, [visible]);

  const handleScanDevices = async () => {
    try {
      console.log('Scanning for IoT devices...');
      const devices = await scanForDevices();
      console.log('Found', devices.length, 'devices');
      
      if (devices.length === 0) {
        Alert.alert(
          'No Devices Found',
          'No IoT water bottles found nearby. Make sure the devices are powered on and in pairing mode.',
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
    setFormData(prev => ({ ...prev, selectedDeviceId: device.id }));
    console.log('Selected device:', device.name || device.id);
  };

  const handleContinueToForm = () => {
    if (!selectedDevice) {
      Alert.alert('No Device Selected', 'Please select a device before continuing.');
      return;
    }
    stopScanning();
    setStep('form');
  };

  const handleBackToDevices = () => {
    setStep('device');
  };

  const handleInputChange = (field: keyof PatientFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.name.trim()) errors.push('Patient name is required');
    if (!formData.age.trim() || isNaN(Number(formData.age))) errors.push('Valid age is required');
    if (!formData.hydrationGoal.trim() || isNaN(Number(formData.hydrationGoal))) errors.push('Valid hydration goal is required');
    if (!formData.emergencyContactName.trim()) errors.push('Emergency contact name is required');
    if (!formData.emergencyContactPhone.trim()) errors.push('Emergency contact phone is required');
    if (!formData.emergencyContactRelation.trim()) errors.push('Emergency contact relationship is required');

    if (errors.length > 0) {
      Alert.alert('Form Validation', errors.join('\n'));
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const patientData: Omit<PatientUser, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name.trim(),
        age: parseInt(formData.age),
        gender: formData.gender,
        roomNumber: formData.roomNumber.trim() || undefined,
        bedNumber: formData.bedNumber.trim() || undefined,
        medicalConditions: formData.medicalConditions.trim() 
          ? formData.medicalConditions.split(',').map(c => c.trim()).filter(c => c.length > 0)
          : [],
        hydrationGoal: parseInt(formData.hydrationGoal),
        deviceIds: [formData.selectedDeviceId],
        caretakerId: 'dev_caretaker_1', // This would come from logged in caretaker
        emergencyContact: {
          name: formData.emergencyContactName.trim(),
          phone: formData.emergencyContactPhone.trim(),
          relationship: formData.emergencyContactRelation.trim(),
        },
        isActive: true,
        lastSeen: new Date(),
      };

      const patientId = await addPatient(patientData);
      
      console.log('✅ Patient added successfully with ID:', patientId);
      
      Alert.alert(
        'Patient Added Successfully! ✅',
        `${formData.name} has been added to your patient list with device ${selectedDevice?.name || 'Unknown Device'}.`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              console.log('🔄 Calling onSuccess callback');
              onSuccess();
              onClose();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error adding patient:', error);
      Alert.alert(
        'Error Adding Patient',
        error.message || 'Failed to add patient. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDeviceStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Select IoT Device</Text>
        <Text style={styles.stepSubtitle}>
          Choose a water bottle device to assign to the patient
        </Text>
      </View>

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
                {item.name || item.localName || 'IoT Water Bottle'}
              </Text>
              <Text style={styles.deviceId}>ID: {item.id}</Text>
              {item.rssi && (
                <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
              )}
            </View>
            {selectedDevice?.id === item.id && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isScanning ? (
            <View style={styles.emptyList}>
              <Text style={styles.emptyText}>No devices found</Text>
              <Text style={styles.emptySubtext}>
                Make sure IoT devices are powered on and in pairing mode
              </Text>
              <TouchableOpacity style={styles.rescanButton} onPress={handleScanDevices}>
                <Text style={styles.rescanButtonText}>🔄 Scan Again</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        {selectedDevice && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinueToForm}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderFormStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToDevices}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.stepTitle}>Patient Information</Text>
          <Text style={styles.stepSubtitle}>
            Device: {selectedDevice?.name || 'Unknown Device'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
        {/* Personal Information */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter patient's full name"
              value={formData.name}
              onChangeText={(value) => handleInputChange('name', value)}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Age *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Age"
                value={formData.age}
                onChangeText={(value) => handleInputChange('age', value)}
                keyboardType="numeric"
                editable={!isSubmitting}
              />
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Gender *</Text>
              <View style={styles.genderContainer}>
                {(['MALE', 'FEMALE', 'OTHER'] as const).map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.genderOption,
                      formData.gender === gender && styles.selectedGenderOption
                    ]}
                    onPress={() => handleInputChange('gender', gender)}
                    disabled={isSubmitting}
                  >
                    <Text style={[
                      styles.genderOptionText,
                      formData.gender === gender && styles.selectedGenderOptionText
                    ]}>
                      {gender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Room Information */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Room Information</Text>
          
          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Room Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., A-101"
                value={formData.roomNumber}
                onChangeText={(value) => handleInputChange('roomNumber', value)}
                editable={!isSubmitting}
              />
            </View>

            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Bed Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 1"
                value={formData.bedNumber}
                onChangeText={(value) => handleInputChange('bedNumber', value)}
                editable={!isSubmitting}
              />
            </View>
          </View>
        </View>

        {/* Medical Information */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Medical Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Medical Conditions</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder="Enter medical conditions separated by commas"
              value={formData.medicalConditions}
              onChangeText={(value) => handleInputChange('medicalConditions', value)}
              multiline
              numberOfLines={3}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Daily Hydration Goal (ml) *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="2000"
              value={formData.hydrationGoal}
              onChangeText={(value) => handleInputChange('hydrationGoal', value)}
              keyboardType="numeric"
              editable={!isSubmitting}
            />
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Contact Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Emergency contact full name"
              value={formData.emergencyContactName}
              onChangeText={(value) => handleInputChange('emergencyContactName', value)}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="+1 (555) 123-4567"
              value={formData.emergencyContactPhone}
              onChangeText={(value) => handleInputChange('emergencyContactPhone', value)}
              keyboardType="phone-pad"
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Relationship *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Daughter, Son, Spouse"
              value={formData.emergencyContactRelation}
              onChangeText={(value) => handleInputChange('emergencyContactRelation', value)}
              editable={!isSubmitting}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.stepActions}>
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={handleBackToDevices}
          disabled={isSubmitting}
        >
          <Text style={styles.cancelButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Adding Patient...' : 'Add Patient'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#F0F9FF', '#FFFFFF']}
        style={styles.modalContainer}
      >
        {step === 'device' ? renderDeviceStep() : renderFormStep()}
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
    marginRight: Spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  stepTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepSubtitle: {
    ...Typography.body,
    color: Colors.text.medium,
  },
  scanningIndicator: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  scanningText: {
    ...Typography.body,
    color: Colors.primary,
  },
  deviceList: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    marginVertical: Spacing.xs,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedDeviceItem: {
    backgroundColor: '#E3F2FD',
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
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  deviceRssi: {
    ...Typography.caption,
    color: Colors.text.light,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
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
    marginBottom: Spacing.lg,
  },
  rescanButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  rescanButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
  },
  stepActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.text.medium,
  },
  continueButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  continueButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    minWidth: 120,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '600',
  },
  formScroll: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.text.dark,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputLabel: {
    ...Typography.body,
    color: Colors.text.dark,
    marginBottom: Spacing.xs,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'white',
    fontSize: 16,
    color: Colors.text.dark,
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  genderOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  selectedGenderOption: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderOptionText: {
    ...Typography.caption,
    color: Colors.text.dark,
    fontWeight: '500',
  },
  selectedGenderOptionText: {
    color: 'white',
  },
});