// BluetoothWaterService.ts
import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import { decode as atob } from 'base-64';
import { SensorData } from '../types';
import { calibrationService } from './CalibrationService';
import { StorageService } from '../utils/storage';

// IoT device configuration - Match your ESP32 code
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const DEVICE_NAME = 'SmartWaterBottle';

export interface WaterLevelData {
  distance: number;   // Distance in mm from sensor
  waterLevel: number; // Water level (0..1)
  timestamp: number;  // When data was received
}

export interface BluetoothDevice {
  id: string;
  name: string | null;
  localName: string | null;
  rssi?: number;
  serviceUUIDs?: string[];
}

export class BluetoothWaterService {
  private manager: BleManager;
  private device: Device | null = null;
  private characteristic: Characteristic | null = null;
  private isConnected = false;
  private isScanning = false;
  private isConnecting = false;
  private activePatientId: string | null = null; // Track which patient is using this device

  // Event listeners
  private dataListeners: Array<(data: SensorData) => void> = [];
  private connectionListeners: Array<(connected: boolean) => void> = [];
  private deviceListeners: Array<(devices: BluetoothDevice[]) => void> = [];
  private scannedDevices: Map<string, BluetoothDevice> = new Map();

  // Bottle configuration for optional distance→level conversion (fallback)
  private bottleHeight = 150;   // mm
  private emptyDistance = 140;  // mm (distance when empty)
  private fullDistance = 20;    // mm (distance when full)

  constructor() {
    this.manager = new BleManager();
    this.initialize().catch(error => {
      console.error('❌ Failed to initialize Bluetooth service in constructor:', error);
    });
    
    // Set up global error handler for uncaught BLE errors
    this.setupGlobalErrorHandler();
  }

  // Set up global error handler to catch uncaught BLE promise rejections
  private setupGlobalErrorHandler() {
    // Override BLE manager error handling
    if (this.manager && typeof this.manager.onStateChange === 'function') {
      try {
        this.manager.onStateChange((state) => {
          console.log(`📡 Bluetooth state: ${state}`);
        }, true);
      } catch (error) {
        console.error('❌ Error setting up state change listener:', error);
      }
    }

    // Add process-level unhandled promise rejection handler
    if (typeof process !== 'undefined' && process.on) {
      process.on('unhandledRejection', (reason, promise) => {
        if (reason && typeof reason === 'object' && 'name' in reason && reason.name === 'BleError') {
          console.error('❌ Unhandled BLE Promise rejection:', reason);
          // Don't re-throw BLE errors, just log them
          return;
        }
        console.error('❌ Unhandled Promise rejection:', reason);
      });
    }
  }

  // Add method to reinitialize the BLE manager
  public async reinitialize(): Promise<boolean> {
    try {
      console.log('🔄 Reinitializing Bluetooth service...');
      
      // Clean up existing manager safely
      if (this.manager) {
        try {
          await this.disconnect();
          this.manager.destroy();
        } catch (error) {
          console.log('❌ Error cleaning up manager:', error);
        }
      }

      // Reset state
      this.handleDisconnection();
      
      // Create new manager
      this.manager = new BleManager();
      
      // Initialize the new manager with error handling
      await this.initialize();
      
      // Re-setup error handlers
      this.setupGlobalErrorHandler();
      
      console.log('✅ Bluetooth service reinitialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to reinitialize Bluetooth service:', error);
      return false;
    }
  }

  private async initialize() {
    try {
      console.log('🔄 Initializing Bluetooth service...');

      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        console.error('❌ Bluetooth permissions not granted');
        return;
      }

      // Set up state change listener with error handling
      const subscription = this.manager.onStateChange((state) => {
        console.log(`📡 Bluetooth state: ${state}`);
        if (state === 'PoweredOn') {
          subscription.remove();
          console.log('✅ Bluetooth is ready');
        }
      }, true);

      console.log('✅ Bluetooth service initialized');
    } catch (error) {
      console.error('❌ Error initializing Bluetooth service:', error);
      throw error;
    }
  }

  private async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true; // iOS handles at runtime in Info.plist
    }

    try {
      // Use API level to decide required Android 12+ permissions
      const apiLevel = Number(Platform.Version); // e.g., 31 for Android 12
      const permissions: string[] = [];

      if (apiLevel >= 31) {
        // Android 12+ runtime BT permissions
        permissions.push(
          'android.permission.BLUETOOTH_SCAN' as any,
          'android.permission.BLUETOOTH_CONNECT' as any
        );
      } else {
        // Older Android versions need location
        permissions.push(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as any
        );
      }

      console.log('📋 Requesting Bluetooth permissions...');
      const results = await PermissionsAndroid.requestMultiple(permissions as any);

      const allGranted = Object.values(results).every(
        (res) => res === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        console.log('❌ Some Bluetooth permissions denied');
        Alert.alert(
          'Permissions Required',
          'Bluetooth permissions are required to connect to your water bottle device.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('✅ All Bluetooth permissions granted');
      }

      return allGranted;
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  // Scan for all available Bluetooth devices
  public async scanForDevices(timeoutMs: number = 15000): Promise<BluetoothDevice[]> {
    if (this.isScanning) {
      console.log('⚠️ Already scanning');
      return Array.from(this.scannedDevices.values());
    }

    try {
      // Check if manager is destroyed and reinitialize if needed
      let state: State;
      try {
        state = await this.manager.state();
      } catch (error) {
        console.log('🔄 BLE Manager destroyed, reinitializing...');
        const success = await this.reinitialize();
        if (!success) {
          return [];
        }
        state = await this.manager.state();
      }

      if (state !== 'PoweredOn') {
        Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for devices.', [{ text: 'OK' }]);
        return [];
      }

      console.log('🔍 Starting device scan...');
      this.isScanning = true;
      this.scannedDevices.clear();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          try {
            this.manager.stopDeviceScan();
          } catch (stopError) {
            console.error('❌ Error stopping scan:', stopError);
          }
          this.isScanning = false;
          const devices = Array.from(this.scannedDevices.values());
          console.log(`✅ Scan completed. Found ${devices.length} devices`);
          resolve(devices);
        }, timeoutMs);

        try {
          this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
            if (error) {
              console.error('❌ Scan error:', error);
              clearTimeout(timeout);
              try {
                this.manager.stopDeviceScan();
              } catch (stopError) {
                console.error('❌ Error stopping scan after error:', stopError);
              }
              this.isScanning = false;
              // Don't reject, just resolve with empty array to prevent uncaught promise
              resolve([]);
              return;
            }

            if (device && (device.name || device.localName)) {
              const bt: BluetoothDevice = {
                id: device.id,
                name: device.name,
                localName: device.localName,
                rssi: device.rssi ?? undefined,
                serviceUUIDs: device.serviceUUIDs ?? undefined,
              };

              this.scannedDevices.set(device.id, bt);
              
              try {
                this.notifyDeviceListeners(Array.from(this.scannedDevices.values()));
              } catch (listenerError) {
                console.error('❌ Error notifying device listeners:', listenerError);
              }
            }
          });
        } catch (startScanError) {
          console.error('❌ Error starting device scan:', startScanError);
          clearTimeout(timeout);
          this.isScanning = false;
          resolve([]);
        }
      });
    } catch (error) {
      console.error('❌ Failed to scan for devices:', error);
      this.isScanning = false;
      return [];
    }
  }

  // Stop scanning for devices
  public stopScanning() {
    if (this.isScanning) {
      try {
        this.manager.stopDeviceScan();
        this.isScanning = false;
        console.log('⏹️ Device scan stopped');
      } catch (error) {
        console.error('❌ Error stopping device scan:', error);
        this.isScanning = false;
      }
    }
  }

  // Connect to a specific device by ID
  public async connectToDevice(deviceId: string): Promise<boolean> {
    if (this.isConnecting) {
      console.log('⚠️ Already connecting to a device');
      return false;
    }
    if (this.isConnected) {
      console.log('⚠️ Already connected to a device');
      return true;
    }

    try {
      console.log(`🔗 Connecting to device: ${deviceId}`);
      this.isConnecting = true;
      this.stopScanning();

      // Check if manager is destroyed and reinitialize if needed
      try {
        await this.manager.state();
      } catch (error) {
        console.log('🔄 BLE Manager destroyed, reinitializing...');
        const success = await this.reinitialize();
        if (!success) {
          this.isConnecting = false;
          return false;
        }
      }

      // Connect to device
      this.device = await this.manager.connectToDevice(deviceId, {
        requestMTU: 512,
        timeout: 10000,
      });

      console.log('🔍 Discovering services and characteristics...');
      await this.device.discoverAllServicesAndCharacteristics();

      const services = await this.device.services();
      console.log(`📋 Found ${services.length} services`);

      // Prefer our expected service
      let service = services.find((s) => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
      if (!service) {
        console.log('⚠️ Expected service not found, using first available service');
        service = services[0];
      }
      if (!service) throw new Error('No services found on device');

      console.log(`✅ Using service: ${service.uuid}`);

      const characteristics = await service.characteristics();
      console.log(`📋 Found ${characteristics.length} characteristics`);

      // Prefer our expected characteristic
      this.characteristic =
        characteristics.find((c) => c.uuid.toLowerCase() === CHARACTERISTIC_UUID.toLowerCase()) ||
        characteristics.find((c) => c.isReadable || c.isNotifiable) ||
        null;

      if (!this.characteristic) throw new Error('No readable/notifiable characteristics found');

      console.log(`✅ Using characteristic: ${this.characteristic.uuid}`);

      // Start monitoring
      await this.startDataMonitoring();

      // Disconnection handler with error handling
      this.device.onDisconnected((error, d) => {
        if (error) console.error('❌ Disconnection error:', error);
        console.log('📱 Device disconnected:', d?.name || 'Unknown');
        try {
          this.handleDisconnection();
        } catch (disconnectError) {
          console.error('❌ Error handling disconnection:', disconnectError);
        }
      });

      this.isConnected = true;
      this.isConnecting = false;

      // Update patient connection status
      if (this.activePatientId) {
        await this.updatePatientConnectionStatus(this.activePatientId, true);
        // Load patient's specific calibration
        await this.loadPatientCalibration(this.activePatientId);
      }
      
      try {
        this.notifyConnectionListeners(true);
      } catch (listenerError) {
        console.error('❌ Error notifying connection listeners:', listenerError);
      }

      console.log('🎉 Successfully connected to device!');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to connect to device:', error);
      this.isConnecting = false;
      this.handleConnectionError(error);
      return false;
    }
  }

  // Start monitoring data from the connected device
  private async startDataMonitoring() {
    if (!this.characteristic) throw new Error('No characteristic available for monitoring');

    console.log('📊 Starting data monitoring...');
    
    try {
      this.characteristic.monitor((error, characteristic) => {
        if (error) {
          console.error('❌ Monitoring error:', error);
          // Don't throw here, just log - monitoring errors are common and should not crash the app
          return;
        }

        if (characteristic?.value) {
          try {
            // BLE values are base64-encoded; decode to string
            const rawData = atob(characteristic.value);
            console.log(`📨 Received data: ${rawData}`);

            const sensorData = this.parseReceivedData(rawData);
            if (sensorData) {
              // Calculate water level using calibration service if needed
              let waterLevel = sensorData.waterLevel;
              
              // If waterLevel is 0 and we have calibration, calculate it
              if (waterLevel === 0 && calibrationService.isDeviceCalibrated()) {
                waterLevel = calibrationService.calculateWaterLevel(sensorData);
              }

              console.log(
                `💧 Distance: ${sensorData.distance}mm, Water level: ${waterLevel.toFixed(1)}%`
              );

              // Add to calibration if in progress
              if (calibrationService.isCalibrationInProgress()) {
                calibrationService.addCalibrationReading(sensorData.distance);
              }

              // Update the sensor data with calculated water level
              const finalSensorData = { ...sensorData, waterLevel };
              
              try {
                this.notifyDataListeners(finalSensorData);
              } catch (listenerError) {
                console.error('❌ Error notifying data listeners:', listenerError);
              }
            }
          } catch (parseError) {
            console.error('❌ Failed to parse received data:', parseError);
          }
        }
      });

      console.log('✅ Data monitoring started');
    } catch (monitorError) {
      console.error('❌ Failed to start monitoring:', monitorError);
      throw monitorError;
    }
  }

  // Parse data received from IoT device
  // ESP32 sends various formats: {"p":75,"d":49}, {"distance":123}, or raw numbers
  private parseReceivedData(rawData: string): SensorData | null {
    try {
      const json = JSON.parse(rawData);

      // Handle format: {"p": percentage, "d": distance}
      if (typeof json.p !== 'undefined' && typeof json.d !== 'undefined') {
        const percentage = Number(json.p);
        const distance = Number(json.d);
        if (!Number.isNaN(percentage) && !Number.isNaN(distance)) {
          return {
            distance: distance,
            waterLevel: percentage, // Already a percentage (0-100)
            timestamp: Date.now(),
            device: DEVICE_NAME,
            status: 'ok',
          };
        }
      }

      // Handle format: {"distance": 123, ...}
      if (typeof json.distance !== 'undefined') {
        return {
          distance: Number(json.distance),
          waterLevel: 0, // Will be calculated by calibration service
          timestamp: json.timestamp || Date.now(),
          device: json.device || DEVICE_NAME,
          status: json.status || 'ok',
        };
      }
    } catch {
      // Try raw distance number
      const dist = Number(String(rawData).trim());
      if (!Number.isNaN(dist)) {
        return {
          distance: dist,
          waterLevel: 0,
          timestamp: Date.now(),
          device: DEVICE_NAME,
          status: 'ok',
        };
      }
    }

    console.warn('⚠️ Could not parse data:', rawData);
    return null;
  }

  // Convert distance to water level percentage (0..1) using linear interpolation
  private convertDistanceToWaterLevel(distance: number): number {
    if (distance <= this.fullDistance) return 1.0; // 100% full
    if (distance >= this.emptyDistance) return 0.0; // 0% full
    const waterLevel = 1 - (distance - this.fullDistance) / (this.emptyDistance - this.fullDistance);
    return Math.max(0, Math.min(1, waterLevel));
  }

  // Configure bottle dimensions for accurate water level calculation (fallback)
  public setBottleConfiguration(capacity: number) {
    switch (capacity) {
      case 500:
        this.bottleHeight = 120;
        this.emptyDistance = 110;
        this.fullDistance = 15;
        break;
      case 1000:
        this.bottleHeight = 150;
        this.emptyDistance = 140;
        this.fullDistance = 20;
        break;
      case 2000:
        this.bottleHeight = 200;
        this.emptyDistance = 190;
        this.fullDistance = 25;
        break;
      case 2500:
        this.bottleHeight = 220;
        this.emptyDistance = 210;
        this.fullDistance = 30;
        break;
      default:
        console.log('⚠️ Using default bottle configuration');
        break;
    }
    console.log(
      `🍼 Bottle configured: ${capacity}ml (empty: ${this.emptyDistance}mm, full: ${this.fullDistance}mm)`
    );
  }

  // Send a command to the connected ESP32 device
  public async sendCommand(command: string): Promise<boolean> {
    if (!this.characteristic || !this.isConnected) {
      console.error('❌ Cannot send command: Device not connected or characteristic not available');
      return false;
    }

    try {
      console.log(`📤 Sending command to device: ${command}`);
      
      // Convert command to base64 (BLE requirement)
      const commandBuffer = Buffer.from(command, 'utf8');
      const base64Command = commandBuffer.toString('base64');
      
      await this.characteristic.writeWithResponse(base64Command);
      console.log('✅ Command sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to send command:', error);
      return false;
    }
  }

  // Put ESP32-C3 into deep sleep mode
  public async enterDeepSleep(sleepDurationMinutes: number = 60): Promise<boolean> {
    if (!this.isConnected) {
      console.error('❌ Cannot enter sleep mode: Device not connected');
      return false;
    }

    try {
      console.log(`😴 Putting device into deep sleep for ${sleepDurationMinutes} minutes...`);
      
      // Send sleep command with duration in JSON format
      const sleepCommand = JSON.stringify({
        action: 'deep_sleep',
        duration_minutes: sleepDurationMinutes,
        timestamp: Date.now()
      });
      
      const success = await this.sendCommand(sleepCommand);
      
      if (success) {
        console.log('🌙 Device entering deep sleep mode...');
        // Device will disconnect automatically when entering sleep
        setTimeout(() => {
          this.handleDisconnection();
        }, 2000); // Give device time to process command
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to enter deep sleep mode:', error);
      return false;
    }
  }

  // Wake up device (ESP32-C3 will wake up automatically after sleep duration or on external interrupt)
  public async wakeUpDevice(): Promise<boolean> {
    if (this.isConnected) {
      console.log('⚠️ Device is already connected (not in sleep mode)');
      return true;
    }

    try {
      console.log('⏰ Attempting to wake up device...');
      
      // Try to reconnect (device should be awake by now)
      if (this.device) {
        const reconnected = await this.connectToDevice(this.device.id);
        if (reconnected) {
          console.log('✅ Device woken up and reconnected');
          return true;
        }
      }
      
      console.log('⚠️ Device may still be sleeping or needs manual wake-up');
      return false;
    } catch (error) {
      console.error('❌ Failed to wake up device:', error);
      return false;
    }
  }

  // Send calibration command to device
  public async sendCalibrationCommand(action: 'start_empty' | 'start_full' | 'complete'): Promise<boolean> {
    const command = JSON.stringify({
      action: 'calibration',
      step: action,
      timestamp: Date.now()
    });
    
    return await this.sendCommand(command);
  }

  // Send configuration update to device
  public async updateDeviceConfig(config: { bottle_capacity?: number; reading_interval?: number; }): Promise<boolean> {
    const command = JSON.stringify({
      action: 'config_update',
      config: config,
      timestamp: Date.now()
    });
    
    return await this.sendCommand(command);
  }

  // Disconnect from current device
  public async disconnect(): Promise<void> {
    try {
      if (this.device && this.isConnected) {
        console.log('🔌 Disconnecting from device...');
        await this.device.cancelConnection();
      }
    } catch (error) {
      console.error('❌ Error during disconnection:', error);
      // Don't re-throw, just ensure cleanup happens
    } finally {
      try {
        this.handleDisconnection();
      } catch (cleanupError) {
        console.error('❌ Error during disconnection cleanup:', cleanupError);
      }
    }
  }

  // Handle disconnection cleanup
  private handleDisconnection() {
    this.device = null;
    this.characteristic = null;
    this.isConnected = false;
    this.isConnecting = false;

    // Update patient connection status
    if (this.activePatientId) {
      this.updatePatientConnectionStatus(this.activePatientId, false);
    }

    this.notifyConnectionListeners(false);
    console.log('🔌 Device disconnected');
  }

  // Handle connection errors
  private handleConnectionError(error: any) {
    const errorMessage = error?.message || 'Unknown connection error';
    Alert.alert('Connection Failed', `Failed to connect to device: ${errorMessage}`, [{ text: 'OK' }]);
  }

  // Event listener management
  public addDataListener(callback: (data: SensorData) => void) {
    this.dataListeners.push(callback);
  }
  public removeDataListener(callback: (data: SensorData) => void) {
    this.dataListeners = this.dataListeners.filter((fn) => fn !== callback);
  }

  public addConnectionListener(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
  }
  public removeConnectionListener(callback: (connected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter((fn) => fn !== callback);
  }

  public addDeviceListener(callback: (devices: BluetoothDevice[]) => void) {
    this.deviceListeners.push(callback);
  }
  public removeDeviceListener(callback: (devices: BluetoothDevice[]) => void) {
    this.deviceListeners = this.deviceListeners.filter((fn) => fn !== callback);
  }

  // Notify listeners
  private notifyDataListeners(data: SensorData) {
    this.dataListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('❌ Error in data listener:', err);
      }
    });

    // Update active patient with real-time data if connected
    if (this.activePatientId && this.isConnected) {
      this.updateActivePatientData(data);
    }
  }

  // Patient Management Methods
  public setActivePatient(patientId: string): void {
    console.log(`👤 Setting active patient: ${patientId}`);
    this.activePatientId = patientId;

    // Update patient connection status
    if (patientId && this.isConnected) {
      this.updatePatientConnectionStatus(patientId, true);
    }
  }

  public getActivePatient(): string | null {
    return this.activePatientId;
  }

  public clearActivePatient(): void {
    if (this.activePatientId) {
      this.updatePatientConnectionStatus(this.activePatientId, false);
      this.activePatientId = null;
    }
  }

  // Update active patient with real-time sensor data
  private async updateActivePatientData(sensorData: SensorData): Promise<void> {
    if (!this.activePatientId) return;

    try {
      // Convert sensor data to patient's bottle capacity
      const patient = await StorageService.getPatientById(this.activePatientId);
      if (!patient) return;

      let waterLevelMl = 0;
      
      // Use patient's calibration if available
      if (patient.deviceCalibration?.isCalibrated) {
        const { emptyBaseline, fullBaseline, bottleCapacity } = patient.deviceCalibration;
        const levelPercentage = Math.max(0, Math.min(100, 
          ((emptyBaseline - sensorData.distance) / (emptyBaseline - fullBaseline)) * 100
        ));
        waterLevelMl = (levelPercentage / 100) * bottleCapacity;
      } else {
        // Fallback calculation
        const levelPercentage = Math.max(0, Math.min(100, sensorData.waterLevel));
        waterLevelMl = (levelPercentage / 100) * 500; // Assume 500ml bottle
      }

      // Update patient's current water level in storage
      await StorageService.updatePatientWaterLevel(this.activePatientId, waterLevelMl, sensorData);
      
      console.log(`💧 Updated patient ${this.activePatientId} water level: ${Math.round(waterLevelMl)}ml`);
    } catch (error) {
      console.error('❌ Error updating patient data:', error);
    }
  }

  // Update patient device connection status
  private async updatePatientConnectionStatus(patientId: string, isConnected: boolean): Promise<void> {
    try {
      await StorageService.updatePatientDeviceStatus(patientId, isConnected);
      console.log(`📡 Updated patient ${patientId} connection status: ${isConnected}`);
    } catch (error) {
      console.error('❌ Error updating patient connection status:', error);
    }
  }

  // Load patient's calibration when connecting
  public async loadPatientCalibration(patientId: string): Promise<void> {
    try {
      const calibration = await StorageService.getPatientCalibration(patientId);
      if (calibration?.isCalibrated) {
        console.log(`📏 Loaded calibration for patient ${patientId}:`, calibration);
        
        // Update local calibration service with patient's data
        await calibrationService.saveCalibration(calibration);
      }
    } catch (error) {
      console.error('❌ Error loading patient calibration:', error);
    }
  }

  // Save calibration for active patient
  public async savePatientCalibration(): Promise<boolean> {
    if (!this.activePatientId) {
      console.error('❌ No active patient to save calibration for');
      return false;
    }

    try {
      const calibrationData = calibrationService.getCalibrationData();
      if (!calibrationData?.isCalibrated) {
        console.error('❌ No valid calibration data to save');
        return false;
      }

      // Save to patient's profile using the existing calibration data structure
      await StorageService.savePatientCalibration(this.activePatientId, calibrationData);
      console.log(`✅ Saved calibration for patient ${this.activePatientId}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving patient calibration:', error);
      return false;
    }
  }
  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (err) {
        console.error('❌ Error in connection listener:', err);
      }
    });
  }
  private notifyDeviceListeners(devices: BluetoothDevice[]) {
    this.deviceListeners.forEach((listener) => {
      try {
        listener(devices);
      } catch (err) {
        console.error('❌ Error in device listener:', err);
      }
    });
  }

  // Utility methods
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getConnectedDevice(): Device | null {
    return this.device;
  }

  public async getBluetoothState(): Promise<State> {
    return await this.manager.state();
  }

  // Diagnostic information
  public async getDiagnostics(): Promise<string> {
    const lines: string[] = [];
    try {
      const state = await this.manager.state();
      lines.push(`🔧 Bluetooth Diagnostics:`);
      lines.push(`Platform: ${Platform.OS}`);
      lines.push(`Bluetooth State: ${state}`);
      lines.push(`Connected: ${this.isConnected ? 'Yes' : 'No'}`);
      lines.push(`Connecting: ${this.isConnecting ? 'Yes' : 'No'}`);
      lines.push(`Scanning: ${this.isScanning ? 'Yes' : 'No'}`);

      if (this.device) {
        lines.push(`Device Name: ${this.device.name || 'Unknown'}`);
        lines.push(`Device ID: ${this.device.id}`);
      }
      if (this.characteristic) {
        lines.push(`Characteristic: ${this.characteristic.uuid}`);
      }

      if (Platform.OS === 'android') {
        const apiLevel = Number(Platform.Version);
        lines.push(`Android API Level: ${apiLevel}`);

        if (apiLevel >= 31) {
          const scanPerm = await PermissionsAndroid.check('android.permission.BLUETOOTH_SCAN' as any);
          const connectPerm = await PermissionsAndroid.check('android.permission.BLUETOOTH_CONNECT' as any);
          lines.push(`BLUETOOTH_SCAN: ${scanPerm ? 'Granted' : 'Denied'}`);
          lines.push(`BLUETOOTH_CONNECT: ${connectPerm ? 'Granted' : 'Denied'}`);
        } else {
          const fineLoc = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          lines.push(`ACCESS_FINE_LOCATION: ${fineLoc ? 'Granted' : 'Denied'}`);
        }
      }
    } catch (error) {
      lines.push(`Error getting diagnostics: ${error}`);
    }
    return lines.join('\n');
  }

  // Cleanup
  public destroy() {
    console.log('🧹 Destroying Bluetooth service...');
    
    // Disconnect and stop scanning with error handling
    try {
      this.disconnect().catch(error => {
        console.error('❌ Error during disconnect in destroy:', error);
      });
    } catch (error) {
      console.error('❌ Error calling disconnect in destroy:', error);
    }
    
    try {
      this.stopScanning();
    } catch (error) {
      console.error('❌ Error stopping scan in destroy:', error);
    }
    
    // Destroy manager with error handling
    try {
      if (this.manager) {
        this.manager.destroy();
      }
    } catch (error) {
      console.error('❌ Error destroying manager:', error);
    }
    
    // Clear all data
    try {
      this.dataListeners = [];
      this.connectionListeners = [];
      this.deviceListeners = [];
      this.scannedDevices.clear();
      
      // Reset state
      this.device = null;
      this.characteristic = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.isScanning = false;
    } catch (error) {
      console.error('❌ Error clearing data in destroy:', error);
    }
    
    console.log('✅ Bluetooth service destroyed');
  }
}

// Export singleton instance
export const bluetoothWaterService = new BluetoothWaterService();
