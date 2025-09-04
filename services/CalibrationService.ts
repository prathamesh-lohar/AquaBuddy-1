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

  isEmptyCalibrated(): boolean {
    return this.calibrationData?.emptyBaseline != null && this.calibrationData.emptyBaseline > 0;
  }

  isFullCalibrated(): boolean {
    return this.calibrationData?.fullBaseline != null && this.calibrationData.fullBaseline > 0;
  }

  getCalibrationData(): DeviceCalibration | null {
    return this.calibrationData;
  }

  startCalibration(): void {
    this.isCalibrating = true;
    this.calibrationStep = 'empty';
    this.calibrationReadings = [];
  }

  startEmptyCalibration(): void {
    this.isCalibrating = true;
    this.calibrationStep = 'empty';
    this.calibrationReadings = [];
  }

  startFullCalibration(): void {
    this.isCalibrating = true;
    this.calibrationStep = 'full';
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

    if (this.calibrationStep === 'empty') {
      // For empty bottle, take the MAXIMUM distance (furthest from sensor)
      const maxDistance = Math.max(...this.calibrationReadings);
      
      console.log(`📏 Empty calibration: Max distance = ${maxDistance}mm from ${this.calibrationReadings.length} readings`);
      
      if (!this.calibrationData) {
        this.calibrationData = {
          emptyBaseline: maxDistance,
          fullBaseline: 0,
          bottleCapacity: 1000, // Default 1L capacity
          calibrationDate: new Date().toISOString(),
          isCalibrated: false,
        };
      } else {
        this.calibrationData.emptyBaseline = maxDistance;
      }

      // Don't automatically move to full step - stop here
      this.stopCalibration();
      
    } else if (this.calibrationStep === 'full') {
      // For full bottle, take the MINIMUM distance (closest to sensor - water surface)
      const minDistance = Math.min(...this.calibrationReadings);
      
      console.log(`📏 Full calibration: Min distance = ${minDistance}mm from ${this.calibrationReadings.length} readings`);
      
      if (!this.calibrationData) {
        // If no empty calibration exists, create with default
        this.calibrationData = {
          emptyBaseline: 0,
          fullBaseline: minDistance,
          bottleCapacity: 1000,
          calibrationDate: new Date().toISOString(),
          isCalibrated: false,
        };
      } else {
        this.calibrationData.fullBaseline = minDistance;
      }
      
      // Check if both calibrations are done
      if (this.calibrationData.emptyBaseline > 0 && this.calibrationData.fullBaseline > 0) {
        // Validate calibration makes sense
        if (this.calibrationData.emptyBaseline <= minDistance) {
          console.error(`❌ Invalid calibration: Empty (${this.calibrationData.emptyBaseline}mm) should be > Full (${minDistance}mm)`);
          this.calibrationData.isCalibrated = false;
        } else {
          this.calibrationData.isCalibrated = true;
          console.log(`✅ Calibration complete: Empty=${this.calibrationData.emptyBaseline}mm, Full=${this.calibrationData.fullBaseline}mm`);
        }
        
        // Save calibration data
        this.saveCalibration(this.calibrationData);
      }

      // Complete this step
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
      console.log(`📊 Water level: 100% (distance ${distance}mm <= full ${fullBaseline}mm)`);
      return 100; // 100% full
    }
    if (distance >= emptyBaseline) {
      console.log(`📊 Water level: 0% (distance ${distance}mm >= empty ${emptyBaseline}mm)`);
      return 0; // 0% empty
    }

    // Linear interpolation between full and empty
    const waterLevel = ((emptyBaseline - distance) / (emptyBaseline - fullBaseline)) * 100;
    const clampedLevel = Math.max(0, Math.min(100, waterLevel));
    
    console.log(`📊 Water level: ${clampedLevel.toFixed(1)}% (distance ${distance}mm between empty ${emptyBaseline}mm and full ${fullBaseline}mm)`);
    
    return clampedLevel;
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
