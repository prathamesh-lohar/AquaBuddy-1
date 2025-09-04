import { DeviceCalibration, SensorData } from '../types';
import { StorageService } from '../utils/storage';

export class CalibrationService {
  private static instance: CalibrationService;
  private calibrationData: DeviceCalibration | null = null;
  private isCalibrating = false;
  private calibrationStep: 'empty' | 'full' | 'none' = 'none';
  private calibrationReadings: number[] = [];

  static getInstance(): CalibrationService {
    if (!CalibrationService.instance) {
      CalibrationService.instance = new CalibrationService();
    }
    return CalibrationService.instance;
  }

  async loadCalibration(): Promise<DeviceCalibration | null> {
    this.calibrationData = await StorageService.getDeviceCalibration();
    return this.calibrationData;
  }

  async saveCalibration(calibration: DeviceCalibration): Promise<void> {
    this.calibrationData = calibration;
    await StorageService.saveDeviceCalibration(calibration);
  }

  async clearCalibration(): Promise<void> {
    this.calibrationData = null;
    await StorageService.clearDeviceCalibration();
  }

  isDeviceCalibrated(): boolean {
    return this.calibrationData?.isCalibrated || false;
  }

  getCalibrationData(): DeviceCalibration | null {
    return this.calibrationData;
  }

  startCalibration(): void {
    this.isCalibrating = true;
    this.calibrationStep = 'empty';
    this.calibrationReadings = [];
  }

  stopCalibration(): void {
    this.isCalibrating = false;
    this.calibrationStep = 'none';
    this.calibrationReadings = [];
  }

  getCurrentStep(): 'empty' | 'full' | 'none' {
    return this.calibrationStep;
  }

  isCalibrationInProgress(): boolean {
    return this.isCalibrating;
  }

  addCalibrationReading(distance: number): void {
    if (!this.isCalibrating) return;

    this.calibrationReadings.push(distance);

    // Collect 10 readings for each step for accuracy
    if (this.calibrationReadings.length >= 10) {
      this.processCalibrationStep();
    }
  }

  private processCalibrationStep(): void {
    if (this.calibrationReadings.length === 0) return;

    // Calculate average distance from readings
    const avgDistance = this.calibrationReadings.reduce((sum, reading) => sum + reading, 0) / this.calibrationReadings.length;

    if (this.calibrationStep === 'empty') {
      // Save empty baseline and move to full step
      if (!this.calibrationData) {
        this.calibrationData = {
          emptyBaseline: avgDistance,
          fullBaseline: 0,
          bottleCapacity: 1000, // Default 1L capacity
          calibrationDate: new Date().toISOString(),
          isCalibrated: false,
        };
      } else {
        this.calibrationData.emptyBaseline = avgDistance;
      }

      this.calibrationStep = 'full';
      this.calibrationReadings = [];
    } else if (this.calibrationStep === 'full') {
      // Save full baseline and complete calibration
      if (this.calibrationData) {
        this.calibrationData.fullBaseline = avgDistance;
        this.calibrationData.calibrationDate = new Date().toISOString();
        this.calibrationData.isCalibrated = true;
        
        // Save calibration data
        this.saveCalibration(this.calibrationData);
      }

      // Complete calibration
      this.stopCalibration();
    }
  }

  calculateWaterLevel(sensorData: SensorData): number {
    if (!this.calibrationData || !this.calibrationData.isCalibrated) {
      return 0;
    }

    const { distance } = sensorData;
    const { emptyBaseline, fullBaseline } = this.calibrationData;

    // Handle edge cases
    if (distance <= fullBaseline) {
      return 100; // 100% full
    }
    if (distance >= emptyBaseline) {
      return 0; // 0% empty
    }

    // Linear interpolation between full and empty
    const waterLevel = ((emptyBaseline - distance) / (emptyBaseline - fullBaseline)) * 100;
    return Math.max(0, Math.min(100, waterLevel)); // Clamp between 0-100%
  }

  calculateWaterVolume(sensorData: SensorData): number {
    if (!this.calibrationData || !this.calibrationData.isCalibrated) {
      return 0;
    }

    const waterLevel = this.calculateWaterLevel(sensorData);
    return (waterLevel / 100) * this.calibrationData.bottleCapacity;
  }

  updateBottleCapacity(capacity: number): void {
    if (this.calibrationData) {
      this.calibrationData.bottleCapacity = capacity;
      this.saveCalibration(this.calibrationData);
    }
  }

  validateCalibration(): boolean {
    if (!this.calibrationData) return false;

    const { emptyBaseline, fullBaseline, isCalibrated } = this.calibrationData;
    
    // Empty baseline should be greater than full baseline (sensor measures distance)
    return isCalibrated && emptyBaseline > fullBaseline && emptyBaseline > 0 && fullBaseline > 0;
  }
}

export const calibrationService = CalibrationService.getInstance();
