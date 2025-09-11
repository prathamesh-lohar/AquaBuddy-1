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

type CalibrationStep = 'welcome' | 'empty' | 'empty-calibrating' | 'empty-done' | 'full-ready' | 'full-calibrating' | 'completed';

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  visible,
  onClose,
  onComplete,
  sensorData
}) => {
  const [currentStep, setCurrentStep] = useState<CalibrationStep>('welcome');
  const [readingCount, setReadingCount] = useState(0);
  const [emptyDistance, setEmptyDistance] = useState<number>(0);
  const [fullDistance, setFullDistance] = useState<number>(0);

  // Reset state when modal opens
  useEffect(() => {
    console.log('🔧 Modal visibility changed:', visible);
    if (visible) {
      const isEmptyDone = calibrationService.isEmptyCalibrated();
      const isFullDone = calibrationService.isFullCalibrated();
      
      console.log('🔧 Calibration status - Empty:', isEmptyDone, 'Full:', isFullDone);
      
      if (isEmptyDone && isFullDone) {
        console.log('🔧 Both calibrated, showing welcome for recalibration');
        setCurrentStep('welcome'); // Allow recalibration
      } else if (isEmptyDone) {
        console.log('🔧 Empty done, showing full-ready');
        setCurrentStep('full-ready');
      } else {
        console.log('🔧 Starting fresh, showing welcome');
        setCurrentStep('welcome');
      }
      
      setReadingCount(0);
    }
  }, [visible]);

  // Handle sensor data for calibration
  useEffect(() => {
    if (visible && sensorData && calibrationService.isCalibrationInProgress()) {
      const step = calibrationService.getCurrentStep();
      
      // Add sensor reading
      calibrationService.addCalibrationReading(sensorData.distance);
      
      // Update reading count
      setReadingCount(prev => prev + 1);

      // Check if calibration step is complete
      if (!calibrationService.isCalibrationInProgress()) {
        const calibrationData = calibrationService.getCalibrationData();
        
        if (step === 'empty') {
          setEmptyDistance(calibrationData?.emptyBaseline || 0);
          setCurrentStep('empty-done');
        } else if (step === 'full') {
          setFullDistance(calibrationData?.fullBaseline || 0);
          if (calibrationData?.isCalibrated) {
            setCurrentStep('completed');
          }
        }
      }
    }
  }, [sensorData, visible]);

  const startEmptyCalibration = () => {
    setReadingCount(0);
    calibrationService.startCalibration();
    setCurrentStep('empty-calibrating');
  };

  const startFullCalibration = () => {
    setReadingCount(0);
    calibrationService.startFullCalibration();
    setCurrentStep('full-calibrating');
  };

  const handleComplete = () => {
    const calibrationData = calibrationService.getCalibrationData();
    if (calibrationData) {
      onComplete(calibrationData);
    }
    handleClose();
  };

  const handleClose = () => {
    calibrationService.stopCalibration();
    setCurrentStep('welcome');
    setReadingCount(0);
    onClose();
  };

  const renderCurrentStep = () => {
    console.log('🔧 Rendering step:', currentStep);
    
    switch (currentStep) {
      case 'welcome':
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="settings-outline" size={80} color="#4A90E2" />
            <Text style={styles.stepTitle}>Bottle Calibration</Text>
            <Text style={styles.stepDescription}>
              Let's calibrate your smart water bottle for accurate tracking.
            </Text>
            <Text style={styles.stepInstructions}>
              Make sure your bottle is completely empty and place it on a stable surface.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={startEmptyCalibration}
            >
              <Text style={styles.primaryButtonText}>Start Empty Calibration</Text>
            </TouchableOpacity>
          </View>
        );

      case 'empty-calibrating':
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="flask-outline" size={80} color="#FF6B6B" />
            <Text style={styles.stepTitle}>Calibrating Empty Level</Text>
            <Text style={styles.stepDescription}>
              Keep your bottle empty and stable. We're taking readings...
            </Text>
            <View style={styles.progressContainer}>
              <Text style={styles.readingCounter}>
                Readings: {readingCount}/10
              </Text>
              <ActivityIndicator size="large" color="#4A90E2" />
            </View>
            <Text style={styles.currentReading}>
              Current: {sensorData?.distance || 0}mm
            </Text>
          </View>
        );

      case 'empty-done':
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text style={styles.stepTitle}>Empty Level Complete!</Text>
            <Text style={styles.stepDescription}>
              Empty baseline: {emptyDistance.toFixed(1)}mm
            </Text>
            <Text style={styles.stepInstructions}>
              Now fill your bottle to 100% capacity and place it back.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setCurrentStep('full-ready')}
            >
              <Text style={styles.primaryButtonText}>Continue to Full Level</Text>
            </TouchableOpacity>
          </View>
        );

      case 'full-ready':
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="flask" size={80} color="#4ECDC4" />
            <Text style={styles.stepTitle}>Ready for Full Level</Text>
            <Text style={styles.stepDescription}>
              Make sure your bottle is filled to 100% capacity.
            </Text>
            <Text style={styles.stepInstructions}>
              Place the full bottle on the same stable surface.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={startFullCalibration}
            >
              <Text style={styles.primaryButtonText}>Start Water Level Calibration</Text>
            </TouchableOpacity>
          </View>
        );

      case 'full-calibrating':
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="flask" size={80} color="#4ECDC4" />
            <Text style={styles.stepTitle}>Calibrating Water Level</Text>
            <Text style={styles.stepDescription}>
              Keep your full bottle stable. Taking readings...
            </Text>
            <View style={styles.progressContainer}>
              <Text style={styles.readingCounter}>
                Readings: {readingCount}/10
              </Text>
              <ActivityIndicator size="large" color="#4A90E2" />
            </View>
            <Text style={styles.currentReading}>
              Current: {sensorData?.distance || 0}mm
            </Text>
          </View>
        );

      case 'completed':
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text style={styles.stepTitle}>Calibration Complete!</Text>
            <Text style={styles.stepDescription}>
              Your bottle is fully calibrated and ready to use.
            </Text>
            <View style={styles.resultsContainer}>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Empty:</Text>
                <Text style={styles.resultValue}>{emptyDistance.toFixed(1)}mm</Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Full:</Text>
                <Text style={styles.resultValue}>{fullDistance.toFixed(1)}mm</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleComplete}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        console.log('🚨 Unknown step:', currentStep);
        return (
          <View style={styles.stepContainer}>
            <Ionicons name="alert-circle" size={80} color="#FF6B6B" />
            <Text style={styles.stepTitle}>Loading...</Text>
            <Text style={styles.stepDescription}>
              Preparing calibration interface...
            </Text>
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
          <Text style={styles.title}>Calibration</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {renderCurrentStep()}
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
    paddingHorizontal: 30,
  },
  stepContainer: {
    alignItems: 'center',
    width: '100%',
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginTop: 30,
    marginBottom: 16,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 26,
  },
  stepInstructions: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 250,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  readingCounter: {
    fontSize: 18,
    color: '#4A90E2',
    fontWeight: '600',
    marginBottom: 20,
  },
  currentReading: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
  },
  resultsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
    minWidth: 250,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '700',
  },
});
