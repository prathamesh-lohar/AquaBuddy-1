import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { calibrationService } from '../services/CalibrationService';
import { DeviceCalibration, SensorData } from '../types';
import { Colors, Typography, Spacing } from '../constants/theme';

interface SimpleCalibrationModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (calibration: DeviceCalibration) => void;
  sensorData: SensorData | null;
}

type CalibrationStep = 'intro' | 'empty' | 'full' | 'complete';

export const SimpleCalibrationModal: React.FC<SimpleCalibrationModalProps> = ({
  visible,
  onClose,
  onComplete,
  sensorData
}) => {
  const [currentStep, setCurrentStep] = useState<CalibrationStep>('intro');
  const [emptyReading, setEmptyReading] = useState<number>(0);
  const [fullReading, setFullReading] = useState<number>(0);
  const [isCollecting, setIsCollecting] = useState(false);
  const [readingCount, setReadingCount] = useState(0);
  const [readings, setReadings] = useState<number[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentStep('intro');
      setEmptyReading(0);
      setFullReading(0);
      setIsCollecting(false);
      setReadingCount(0);
      setReadings([]);
    }
  }, [visible]);

  // Collect sensor readings when in collecting mode
  useEffect(() => {
    if (isCollecting && sensorData && visible) {
      setReadings(prev => [...prev, sensorData.distance]);
      setReadingCount(prev => prev + 1);

      // Collect 5 readings for stability
      if (readings.length >= 4) { // 4 previous + 1 current = 5 total
        const allReadings = [...readings, sensorData.distance];
        const avgReading = allReadings.reduce((sum, reading) => sum + reading, 0) / allReadings.length;
        
        if (currentStep === 'empty') {
          setEmptyReading(Math.round(avgReading));
          setCurrentStep('full');
        } else if (currentStep === 'full') {
          setFullReading(Math.round(avgReading));
          completeCalibration(emptyReading, Math.round(avgReading));
        }

        setIsCollecting(false);
        setReadingCount(0);
        setReadings([]);
      }
    }
  }, [sensorData, isCollecting, visible, readings.length]);

  const startCollecting = (step: 'empty' | 'full') => {
    setIsCollecting(true);
    setReadingCount(0);
    setReadings([]);
    setCurrentStep(step);
  };

  const completeCalibration = async (empty: number, full: number) => {
    if (Math.abs(empty - full) < 50) {
      Alert.alert(
        'Calibration Error',
        'The empty and full readings are too similar. Please ensure your bottle is completely empty, then completely full.',
        [{ text: 'Try Again', onPress: () => setCurrentStep('intro') }]
      );
      return;
    }

    const calibrationData: DeviceCalibration = {
      emptyBaseline: empty,
      fullBaseline: full,
      bottleCapacity: 1000, // Default, can be adjusted
      calibrationDate: new Date().toISOString(),
      isCalibrated: true,
    };

    try {
      await calibrationService.saveCalibration(calibrationData);
      setCurrentStep('complete');
      
      setTimeout(() => {
        onComplete(calibrationData);
        onClose();
      }, 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to save calibration. Please try again.');
      setCurrentStep('intro');
    }
  };

  const renderIntroStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="flask-outline" size={80} color={Colors.primary} />
      </View>
      
      <Text style={styles.stepTitle}>Calibrate Your Smart Bottle</Text>
      <Text style={styles.stepDescription}>
        Quick 2-step calibration for accurate water tracking
      </Text>

      <View style={styles.instructionsContainer}>
        <View style={styles.instructionItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.instructionText}>Empty your bottle completely</Text>
        </View>
        
        <View style={styles.instructionItem}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.instructionText}>Fill your bottle to 100%</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.primaryButton} 
        onPress={() => setCurrentStep('empty')}
      >
        <Text style={styles.primaryButtonText}>Start Calibration</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="flask-outline" size={80} color="#FF6B6B" />
      </View>
      
      <Text style={styles.stepTitle}>Step 1: Empty Bottle</Text>
      <Text style={styles.stepDescription}>
        Make sure your bottle is completely empty and place it on the sensor
      </Text>

      {!isCollecting ? (
        <View style={styles.currentReading}>
          <Text style={styles.readingLabel}>Current sensor reading:</Text>
          <Text style={styles.readingValue}>
            {sensorData?.distance || 0}mm
          </Text>
        </View>
      ) : (
        <View style={styles.collectingContainer}>
          <Text style={styles.collectingText}>
            Collecting readings... {readingCount}/5
          </Text>
          <View style={styles.progressDots}>
            {[...Array(5)].map((_, i) => (
              <View 
                key={i} 
                style={[
                  styles.progressDot, 
                  i < readingCount && styles.progressDotActive
                ]} 
              />
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.primaryButton, isCollecting && styles.disabledButton]} 
        onPress={() => startCollecting('empty')}
        disabled={isCollecting}
      >
        <Text style={styles.primaryButtonText}>
          {isCollecting ? 'Calibrating...' : 'Calibrate Empty'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderFullStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="flask" size={80} color="#4ECDC4" />
      </View>
      
      <Text style={styles.stepTitle}>Step 2: Full Bottle</Text>
      <Text style={styles.stepDescription}>
        Fill your bottle to 100% capacity and place it back on the sensor
      </Text>

      <View style={styles.calibrationProgress}>
        <View style={styles.progressItem}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <Text style={styles.progressText}>Empty: {emptyReading}mm ✓</Text>
        </View>
      </View>

      {!isCollecting ? (
        <View style={styles.currentReading}>
          <Text style={styles.readingLabel}>Current sensor reading:</Text>
          <Text style={styles.readingValue}>
            {sensorData?.distance || 0}mm
          </Text>
        </View>
      ) : (
        <View style={styles.collectingContainer}>
          <Text style={styles.collectingText}>
            Collecting readings... {readingCount}/5
          </Text>
          <View style={styles.progressDots}>
            {[...Array(5)].map((_, i) => (
              <View 
                key={i} 
                style={[
                  styles.progressDot, 
                  i < readingCount && styles.progressDotActive
                ]} 
              />
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.primaryButton, isCollecting && styles.disabledButton]} 
        onPress={() => startCollecting('full')}
        disabled={isCollecting}
      >
        <Text style={styles.primaryButtonText}>
          {isCollecting ? 'Calibrating...' : 'Calibrate Full'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
      </View>
      
      <Text style={styles.stepTitle}>Calibration Complete!</Text>
      <Text style={styles.stepDescription}>
        Your smart bottle is now calibrated for accurate tracking
      </Text>

      <View style={styles.calibrationResults}>
        <View style={styles.resultItem}>
          <Text style={styles.resultLabel}>Empty Reading:</Text>
          <Text style={styles.resultValue}>{emptyReading}mm</Text>
        </View>
        <View style={styles.resultItem}>
          <Text style={styles.resultLabel}>Full Reading:</Text>
          <Text style={styles.resultValue}>{fullReading}mm</Text>
        </View>
        <View style={styles.resultItem}>
          <Text style={styles.resultLabel}>Range:</Text>
          <Text style={styles.resultValue}>{Math.abs(emptyReading - fullReading)}mm</Text>
        </View>
      </View>

      <Text style={styles.successText}>
        🎉 Your bottle is ready for precise water tracking!
      </Text>
    </View>
  );

  const getCurrentStepContent = () => {
    switch (currentStep) {
      case 'intro': return renderIntroStep();
      case 'empty': return renderEmptyStep();
      case 'full': return renderFullStep();
      case 'complete': return renderCompleteStep();
      default: return renderIntroStep();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#F0F9FF', '#FFFFFF']}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.progressIndicator}>
              <View style={[styles.progressStep, currentStep !== 'intro' && styles.progressStepActive]}>
                <Text style={styles.progressStepText}>1</Text>
              </View>
              <View style={[styles.progressLine, (currentStep === 'full' || currentStep === 'complete') && styles.progressLineActive]} />
              <View style={[styles.progressStep, (currentStep === 'full' || currentStep === 'complete') && styles.progressStepActive]}>
                <Text style={styles.progressStepText}>2</Text>
              </View>
            </View>
            
            {currentStep !== 'complete' && (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          <View style={styles.content}>
            {getCurrentStepContent()}
          </View>

          {/* Footer */}
          {sensorData && currentStep !== 'complete' && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Device connected • Last update: {new Date(sensorData.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          )}
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepActive: {
    backgroundColor: Colors.primary,
  },
  progressStepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: Colors.primary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  stepTitle: {
    ...Typography.header,
    color: Colors.text.dark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  stepDescription: {
    ...Typography.body,
    color: Colors.text.medium,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  instructionsContainer: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionText: {
    ...Typography.body,
    color: Colors.text.dark,
    flex: 1,
  },
  currentReading: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readingLabel: {
    ...Typography.caption,
    color: Colors.text.medium,
    marginBottom: 4,
  },
  readingValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  collectingContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  collectingText: {
    ...Typography.body,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  calibrationProgress: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.xs,
  },
  progressText: {
    ...Typography.body,
    color: Colors.text.dark,
    marginLeft: Spacing.sm,
  },
  calibrationResults: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  resultLabel: {
    ...Typography.body,
    color: Colors.text.medium,
  },
  resultValue: {
    ...Typography.body,
    color: Colors.text.dark,
    fontWeight: '600',
  },
  successText: {
    ...Typography.body,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    ...Typography.caption,
    color: Colors.text.light,
  },
});