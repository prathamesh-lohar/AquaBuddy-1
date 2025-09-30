import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calibrationService } from '../services/CalibrationService';
import { DeviceCalibration, SensorData } from '../types';

interface CalibrationModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (calibration: DeviceCalibration) => void;
  sensorData: SensorData | null;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  visible,
  onClose,
  onComplete,
  sensorData
}) => {
  const [currentStep, setCurrentStep] = useState<'empty' | 'full' | 'none'>('none');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [readingCount, setReadingCount] = useState(0);
  const [emptyBaseline, setEmptyBaseline] = useState<number>(0);
  const [isEmptyCalibrated, setIsEmptyCalibrated] = useState(false);
  const [isFullCalibrated, setIsFullCalibrated] = useState(false);

  // Check calibration status when modal opens
  useEffect(() => {
    if (visible) {
      setIsEmptyCalibrated(calibrationService.isEmptyCalibrated());
      setIsFullCalibrated(calibrationService.isFullCalibrated());
    }
  }, [visible]);

  useEffect(() => {
    if (visible && sensorData && calibrationService.isCalibrationInProgress()) {
      const step = calibrationService.getCurrentStep();
      setCurrentStep(step);
      
      console.log(`📊 Adding reading for ${step}: ${sensorData.distance}mm`);
      
      // Add sensor reading to calibration
      calibrationService.addCalibrationReading(sensorData.distance);
      
      // Increment reading count
      setReadingCount(prev => {
        const newCount = prev + 1;
        console.log(`📊 Reading count for ${step}: ${newCount}/10`);
        return newCount;
      });

      // Check if calibration step is complete
      if (!calibrationService.isCalibrationInProgress() && step !== 'none') {
        const calibrationData = calibrationService.getCalibrationData();
        console.log('🔧 Calibration step completed:', step, calibrationData);
        
        if (calibrationData) {
          if (step === 'empty') {
            setIsEmptyCalibrated(calibrationService.isEmptyCalibrated());
            setCurrentStep('none');
            setIsCalibrating(false);
            setReadingCount(0);
            Alert.alert('Empty Calibration Complete! ✅', 'Empty bottle calibrated successfully!');
          } else if (step === 'full') {
            setIsFullCalibrated(calibrationService.isFullCalibrated());
            
            if (calibrationData.isCalibrated) {
              Alert.alert('Full Calibration Complete! ✅', 'Full bottle calibrated successfully!');
              setTimeout(() => {
                onComplete(calibrationData);
                handleClose();
              }, 1000);
            } else {
              Alert.alert('Calibration Failed ❌', 'Full calibration failed. Please try again.');
              setCurrentStep('none');
              setIsCalibrating(false);
              setReadingCount(0);
            }
          }
        }
      }
    }
  }, [sensorData, visible]);

  const startEmptyCalibration = () => {
    setIsCalibrating(true);
    setReadingCount(0);
    calibrationService.startCalibration();
    setCurrentStep('empty');
  };

  const startFullCalibration = () => {
    if (!isEmptyCalibrated) {
      Alert.alert(
        'Empty Calibration Required',
        'Please calibrate the empty bottle first before calibrating the full bottle.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    console.log('🔧 Starting full calibration...');
    setIsCalibrating(true);
    setReadingCount(0); // Reset reading count for full calibration
    calibrationService.startFullCalibration();
    setCurrentStep('full');
    console.log('📱 UI updated to full step');
  };

  const handleClose = () => {
    calibrationService.stopCalibration();
    setIsCalibrating(false);
    setCurrentStep('none');
    setReadingCount(0);
    setEmptyBaseline(0);
    setIsEmptyCalibrated(false);
    setIsFullCalibrated(false);
    onClose();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'empty':
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="flask-outline" size={64} color="#FF6B6B" />
            <Text style={styles.stepTitle}>Step 1: Empty Bottle</Text>
            <Text style={styles.stepDescription}>
              Make sure your water bottle is completely empty, then place it on a stable surface.
            </Text>
            <Text style={styles.readingCounter}>
              Readings collected: {readingCount}/10
            </Text>
            <ActivityIndicator size="large" color="#4A90E2" style={styles.spinner} />
          </View>
        );

      case 'full':
        console.log('🖥️ Rendering full calibration step');
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="flask" size={64} color="#4ECDC4" />
            <Text style={styles.stepTitle}>Step 2: Full Bottle</Text>
            <Text style={styles.stepDescription}>
              Fill your water bottle to 100% capacity and place it back on the surface.
            </Text>
            <Text style={styles.readingCounter}>
              Readings collected: {readingCount}/10
            </Text>
            <ActivityIndicator size="large" color="#4A90E2" style={styles.spinner} />
          </View>
        );

      default:
        console.log(`🖥️ Rendering default step, currentStep: ${currentStep}, isCalibrating: ${isCalibrating}`);
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="settings-outline" size={64} color="#4A90E2" />
            <Text style={styles.stepTitle}>Device Calibration</Text>
            <Text style={styles.stepDescription}>
              Calibrate your smart water bottle for accurate tracking. Follow the steps below:
            </Text>
            
            {/* Current Status Display */}
            <View style={styles.calibrationStatus}>
              <Text style={styles.statusTitle}>Calibration Status</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Empty Bottle:</Text>
                <Text style={[styles.statusValue, isEmptyCalibrated ? styles.statusComplete : styles.statusPending]}>
                  {isEmptyCalibrated ? '✅ Calibrated' : '⏳ Pending'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Full Bottle:</Text>
                <Text style={[styles.statusValue, isFullCalibrated ? styles.statusComplete : styles.statusPending]}>
                  {isFullCalibrated ? '✅ Calibrated' : '⏳ Pending'}
                </Text>
              </View>
            </View>
            
            <View style={styles.calibrationSteps}>
              <View style={styles.calibrationStep}>
                <Text style={styles.stepNumber}>1.</Text>
                <Text style={styles.stepText}>Empty your bottle completely</Text>
                <TouchableOpacity
                  style={[styles.calibrationStepButton, isEmptyCalibrated && styles.completedButton]}
                  onPress={startEmptyCalibration}
                  disabled={isCalibrating}
                >
                  <Text style={[styles.calibrationStepButtonText, isEmptyCalibrated && styles.completedButtonText]}>
                    {isEmptyCalibrated ? '✅ Empty Done' : '📏 Calibrate Empty'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.calibrationStep}>
                {/* <Text style={styles.stepNumber}>2.</Text> */}
                {/* <Text style={styles.stepText}>Fill your bottle to 100%</Text> */}
                {/* <TouchableOpacity
                  style={[
                    styles.calibrationStepButton, 
                    (!isEmptyCalibrated || isFullCalibrated) && styles.disabledButton,
                    isFullCalibrated && styles.completedButton
                  ]}
                  onPress={startFullCalibration}
                  disabled={!isEmptyCalibrated || isCalibrating || isFullCalibrated}
                > */}
                  {/* <Text style={[
                    styles.calibrationStepButtonText,
                    (!isEmptyCalibrated || isFullCalibrated) && styles.disabledButtonText,
                    isFullCalibrated && styles.completedButtonText
                  ]}>
                    {isFullCalibrated ? '✅ Full Done' : '📏 Calibrate Full'}
                  </Text> */}
                {/* </TouchableOpacity> */}
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bottle Calibration</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {renderStep()}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {sensorData ? `Current reading: ${sensorData.distance}mm` : 'Waiting for sensor data...'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  stepContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  readingCounter: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
    marginBottom: 20,
  },
  spinner: {
    marginTop: 10,
  },
  startButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
  // New calibration step styles
  calibrationSteps: {
    width: '100%',
    gap: 20,
    marginTop: 20,
  },
  calibrationStep: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    gap: 12,
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4A90E2',
    width: 30,
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  calibrationStepButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  calibrationStepButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  completedButton: {
    backgroundColor: '#4CAF50',
  },
  completedButtonText: {
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  disabledButtonText: {
    color: '#999',
  },
  // Status display styles
  calibrationStatus: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusComplete: {
    color: '#4CAF50',
  },
  statusPending: {
    color: '#FF9800',
  },
});
