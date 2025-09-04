// BluetoothWaterService.ts
import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import { decode as atob } from 'base-64';
import { SensorData } from '../types';
import { calibrationService } from './CalibrationService';

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
    this.initialize();
  }

  private async initialize() {
    try {
      console.log('🔄 Initializing Bluetooth service...');

      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        console.error('❌ Bluetooth permissions not granted');
        return;
      }

      const subscription = this.manager.onStateChange((state) => {
        console.log(`📡 Bluetooth state: ${state}`);
        if (state === 'PoweredOn') {
          subscription.remove();
          console.log('✅ Bluetooth is ready');
        }
      }, true);

      console.log('✅ Bluetooth service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Bluetooth:', error);
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
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for devices.', [{ text: 'OK' }]);
        return [];
      }

      console.log('🔍 Starting device scan...');
      this.isScanning = true;
      this.scannedDevices.clear();

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.manager.stopDeviceScan();
          this.isScanning = false;
          const devices = Array.from(this.scannedDevices.values());
          console.log(`✅ Scan completed. Found ${devices.length} devices`);
          resolve(devices);
        }, timeoutMs);

        this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
          if (error) {
            console.error('❌ Scan error:', error);
            clearTimeout(timeout);
            this.manager.stopDeviceScan();
            this.isScanning = false;
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
            this.notifyDeviceListeners(Array.from(this.scannedDevices.values()));
          }
        });
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
      this.manager.stopDeviceScan();
      this.isScanning = false;
      console.log('⏹️ Device scan stopped');
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

      // Disconnection handler
      this.device.onDisconnected((error, d) => {
        if (error) console.error('❌ Disconnection error:', error);
        console.log('📱 Device disconnected:', d?.name || 'Unknown');
        this.handleDisconnection();
      });

      this.isConnected = true;
      this.isConnecting = false;
      this.notifyConnectionListeners(true);

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
    this.characteristic.monitor((error, characteristic) => {
      if (error) {
        console.error('❌ Monitoring error:', error);
        return;
      }

      if (characteristic?.value) {
        try {
          // BLE values are base64-encoded; decode to string
          const rawData = atob(characteristic.value);
          console.log(`📨 Received data: ${rawData}`);

          const sensorData = this.parseReceivedData(rawData);
          if (sensorData) {
            // Calculate water level using calibration service if available
            let waterLevel = 0;
            if (calibrationService.isDeviceCalibrated()) {
              waterLevel = calibrationService.calculateWaterLevel(sensorData);
            }

            console.log(
              `💧 Distance: ${sensorData.distance}mm, Water level: ${waterLevel.toFixed(1)}%`
            );

            // Add to calibration if in progress
            if (calibrationService.isCalibrationInProgress()) {
              calibrationService.addCalibrationReading(sensorData.distance);
            }

            this.notifyDataListeners(sensorData);
          }
        } catch (parseError) {
          console.error('❌ Failed to parse received data:', parseError);
        }
      }
    });

    console.log('✅ Data monitoring started');
  }

  // Parse data received from IoT device
  // ESP32 sends: {"distance":123,"timestamp":456,"device":"SmartWaterBottle","status":"ok"}
  private parseReceivedData(rawData: string): SensorData | null {
    try {
      const json = JSON.parse(rawData);

      // Expected format from our simplified ESP32 code
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

  // Disconnect from current device
  public async disconnect(): Promise<void> {
    try {
      if (this.device && this.isConnected) {
        console.log('🔌 Disconnecting from device...');
        await this.device.cancelConnection();
      }
    } catch (error) {
      console.error('❌ Error during disconnection:', error);
    } finally {
      this.handleDisconnection();
    }
  }

  // Handle disconnection cleanup
  private handleDisconnection() {
    this.device = null;
    this.characteristic = null;
    this.isConnected = false;
    this.isConnecting = false;
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
    this.disconnect();
    this.stopScanning();
    this.manager.destroy();
    this.dataListeners = [];
    this.connectionListeners = [];
    this.deviceListeners = [];
    this.scannedDevices.clear();
  }
}

// Export singleton instance
export const bluetoothWaterService = new BluetoothWaterService();
