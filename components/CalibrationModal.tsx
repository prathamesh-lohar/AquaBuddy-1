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

  useEffect(() => {
    if (visible && sensorData && calibrationService.isCalibrationInProgress()) {
      const step = calibrationService.getCurrentStep();
      setCurrentStep(step);
      
      // Add sensor reading to calibration
      calibrationService.addCalibrationReading(sensorData.distance);
      setReadingCount(prev => prev + 1);

      // Check if calibration is complete
      if (!calibrationService.isCalibrationInProgress() && step !== 'none') {
        const calibrationData = calibrationService.getCalibrationData();
        if (calibrationData && calibrationData.isCalibrated) {
          onComplete(calibrationData);
          handleClose();
        }
      }
    }
  }, [sensorData, visible]);

  const startCalibration = () => {
    setIsCalibrating(true);
    setReadingCount(0);
    calibrationService.startCalibration();
    setCurrentStep('empty');
  };

  const handleClose = () => {
    calibrationService.stopCalibration();
    setIsCalibrating(false);
    setCurrentStep('none');
    setReadingCount(0);
    setEmptyBaseline(0);
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
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="flask" size={64} color="#4ECDC4" />
            <Text style={styles.stepTitle}>Step 2: Full Bottle</Text>
            <Text style={styles.stepDescription}>
              Fill your water bottle to 100% capacity and place it back on the surface.
            </Text>
            <Text style={styles.readingCounter}>
              Readings collected: {readingCount - 10}/10
            </Text>
            <ActivityIndicator size="large" color="#4A90E2" style={styles.spinner} />
          </View>
        );

      default:
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="settings-outline" size={64} color="#4A90E2" />
            <Text style={styles.stepTitle}>Device Calibration</Text>
            <Text style={styles.stepDescription}>
              Calibrate your smart water bottle for accurate tracking. This process will take about 30 seconds.
            </Text>
            
            <TouchableOpacity
              style={styles.startButton}
              onPress={startCalibration}
            >
              <Text style={styles.startButtonText}>Start Calibration</Text>
            </TouchableOpacity>
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
});
