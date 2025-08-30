import { BleManager, Device, Characteristic, State } from 'react-native-ble-plx';
import { Platform, Alert, PermissionsAndroid } from 'react-native';

// IoT device configuration - Match your ESP32 code
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const DEVICE_NAME = 'SmartWaterBottle';

export interface WaterLevelData {
  distance: number; // Distance in mm from sensor
  waterLevel: number; // Water level percentage (0-1)
  timestamp: number; // When data was received
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
  private dataListeners: ((data: WaterLevelData) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private deviceListeners: ((devices: BluetoothDevice[]) => void)[] = [];
  private scannedDevices: Map<string, BluetoothDevice> = new Map();
  
  // Bottle configuration for water level calculation
  private bottleHeight = 150; // mm
  private emptyDistance = 140; // mm (distance when empty)
  private fullDistance = 20; // mm (distance when full)

  constructor() {
    this.manager = new BleManager();
    this.initialize();
  }

  private async initialize() {
    try {
      console.log('🔄 Initializing Bluetooth service...');
      
      // Request permissions
      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        console.error('❌ Bluetooth permissions not granted');
        return;
      }

      // Wait for Bluetooth to be ready
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
      return true; // iOS handles permissions automatically
    }

    try {
      const apiLevel = parseInt(Platform.constants?.Release || '0', 10);
      const permissions = [];

      if (apiLevel >= 12) {
        // Android 12+ permissions
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
      } else {
        // Older Android versions
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );
      }

      console.log('📋 Requesting Bluetooth permissions...');
      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      const allGranted = Object.values(results).every(
        result => result === PermissionsAndroid.RESULTS.GRANTED
      );

      if (allGranted) {
        console.log('✅ All Bluetooth permissions granted');
        return true;
      } else {
        console.log('❌ Some Bluetooth permissions denied');
        Alert.alert(
          'Permissions Required',
          'Bluetooth permissions are required to connect to your water bottle device.',
          [{ text: 'OK' }]
        );
        return false;
      }
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
      // Check Bluetooth state
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        Alert.alert(
          'Bluetooth Disabled',
          'Please enable Bluetooth to scan for devices.',
          [{ text: 'OK' }]
        );
        return [];
      }

      console.log('🔍 Starting device scan...');
      this.isScanning = true;
      this.scannedDevices.clear();

      return new Promise((resolve) => {
        // Scan timeout
        const timeout = setTimeout(() => {
          this.manager.stopDeviceScan();
          this.isScanning = false;
          const devices = Array.from(this.scannedDevices.values());
          console.log(`✅ Scan completed. Found ${devices.length} devices`);
          resolve(devices);
        }, timeoutMs);

        // Start scanning
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
            console.log(`📱 Found device: ${device.name || device.localName} (${device.id})`);
            
            const bluetoothDevice: BluetoothDevice = {
              id: device.id,
              name: device.name,
              localName: device.localName,
              rssi: device.rssi,
              serviceUUIDs: device.serviceUUIDs
            };

            this.scannedDevices.set(device.id, bluetoothDevice);
            
            // Notify listeners of updated device list
            const currentDevices = Array.from(this.scannedDevices.values());
            this.notifyDeviceListeners(currentDevices);
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
        requestMTU: 512, // Request larger MTU for better data transfer
        timeout: 10000 // 10 second timeout
      });

      console.log('🔍 Discovering services and characteristics...');
      await this.device.discoverAllServicesAndCharacteristics();

      // Find the service and characteristic
      const services = await this.device.services();
      console.log(`📋 Found ${services.length} services`);

      // Try to find our expected service first
      let service = services.find(s => 
        s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase()
      );

      // If our service not found, use the first available service
      if (!service) {
        console.log('⚠️ Expected service not found, using first available service');
        service = services[0];
      }

      if (!service) {
        throw new Error('No services found on device');
      }

      console.log(`✅ Using service: ${service.uuid}`);
      
      // Get characteristics
      const characteristics = await service.characteristics();
      console.log(`📋 Found ${characteristics.length} characteristics`);

      // Try to find our expected characteristic first
      this.characteristic = characteristics.find(c =>
        c.uuid.toLowerCase() === CHARACTERISTIC_UUID.toLowerCase()
      );

      // If our characteristic not found, find any readable/notifiable characteristic
      if (!this.characteristic) {
        console.log('⚠️ Expected characteristic not found, searching for compatible characteristic');
        this.characteristic = characteristics.find(c =>
          c.isReadable || c.isNotifiable
        );
      }

      if (!this.characteristic) {
        throw new Error('No readable characteristics found on device');
      }

      console.log(`✅ Using characteristic: ${this.characteristic.uuid}`);

      // Start monitoring data
      await this.startDataMonitoring();

      // Set up disconnection handler
      this.device.onDisconnected((error, device) => {
        console.log('📱 Device disconnected:', device?.name || 'Unknown');
        if (error) {
          console.error('❌ Disconnection error:', error);
        }
        this.handleDisconnection();
      });

      this.isConnected = true;
      this.isConnecting = false;
      this.notifyConnectionListeners(true);
      
      console.log('🎉 Successfully connected to device!');
      return true;

    } catch (error) {
      console.error('❌ Failed to connect to device:', error);
      this.isConnecting = false;
      this.handleConnectionError(error);
      return false;
    }
  }

  // Start monitoring data from the connected device
  private async startDataMonitoring() {
    if (!this.characteristic) {
      throw new Error('No characteristic available for monitoring');
    }

    try {
      console.log('📊 Starting data monitoring...');
      
      // Monitor characteristic for data changes
      this.characteristic.monitor((error, characteristic) => {
        if (error) {
          console.error('❌ Monitoring error:', error);
          return;
        }

        if (characteristic?.value) {
          try {
            // Decode base64 data
            const rawData = Buffer.from(characteristic.value, 'base64').toString('utf8');
            console.log(`📨 Received data: ${rawData}`);
            
            // Parse the data
            const waterData = this.parseReceivedData(rawData);
            if (waterData) {
              console.log(`💧 Water level: ${(waterData.waterLevel * 100).toFixed(1)}% (${waterData.distance}mm)`);
              this.notifyDataListeners(waterData);
            }
          } catch (parseError) {
            console.error('❌ Failed to parse received data:', parseError);
          }
        }
      });

      console.log('✅ Data monitoring started');
    } catch (error) {
      console.error('❌ Failed to start data monitoring:', error);
      throw error;
    }
  }

  // Parse data received from IoT device
  private parseReceivedData(rawData: string): WaterLevelData | null {
    try {
      // Try parsing as JSON first (preferred format)
      const jsonData = JSON.parse(rawData);
      if (jsonData.distance !== undefined) {
        const distance = parseInt(jsonData.distance);
        if (!isNaN(distance)) {
          return {
            distance,
            waterLevel: this.convertDistanceToWaterLevel(distance),
            timestamp: jsonData.timestamp || Date.now()
          };
        }
      }
    } catch (jsonError) {
      // Not JSON, try parsing as plain distance value
      const distance = parseInt(rawData.trim());
      if (!isNaN(distance)) {
        return {
          distance,
          waterLevel: this.convertDistanceToWaterLevel(distance),
          timestamp: Date.now()
        };
      }
    }

    console.warn('⚠️ Could not parse data:', rawData);
    return null;
  }

  // Convert distance to water level percentage
  private convertDistanceToWaterLevel(distance: number): number {
    if (distance <= this.fullDistance) return 1.0; // 100% full
    if (distance >= this.emptyDistance) return 0.0; // 0% empty
    
    // Linear interpolation between full and empty
    const waterLevel = 1 - ((distance - this.fullDistance) / (this.emptyDistance - this.fullDistance));
    return Math.max(0, Math.min(1, waterLevel));
  }

  // Configure bottle dimensions for accurate water level calculation
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
    console.log(`🍼 Bottle configured: ${capacity}ml (empty: ${this.emptyDistance}mm, full: ${this.fullDistance}mm)`);
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
    Alert.alert(
      'Connection Failed',
      `Failed to connect to device: ${errorMessage}`,
      [{ text: 'OK' }]
    );
  }

  // Event listener management
  public addDataListener(callback: (data: WaterLevelData) => void) {
    this.dataListeners.push(callback);
  }

  public removeDataListener(callback: (data: WaterLevelData) => void) {
    this.dataListeners = this.dataListeners.filter(listener => listener !== callback);
  }

  public addConnectionListener(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
  }

  public removeConnectionListener(callback: (connected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter(listener => listener !== callback);
  }

  public addDeviceListener(callback: (devices: BluetoothDevice[]) => void) {
    this.deviceListeners.push(callback);
  }

  public removeDeviceListener(callback: (devices: BluetoothDevice[]) => void) {
    this.deviceListeners = this.deviceListeners.filter(listener => listener !== callback);
  }

  // Notify listeners
  private notifyDataListeners(data: WaterLevelData) {
    this.dataListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('❌ Error in data listener:', error);
      }
    });
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('❌ Error in connection listener:', error);
      }
    });
  }

  private notifyDeviceListeners(devices: BluetoothDevice[]) {
    this.deviceListeners.forEach(listener => {
      try {
        listener(devices);
      } catch (error) {
        console.error('❌ Error in device listener:', error);
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
    const diagnostics = [];
    
    try {
      const state = await this.manager.state();
      diagnostics.push(`🔧 Bluetooth Diagnostics:`);
      diagnostics.push(`Platform: ${Platform.OS}`);
      diagnostics.push(`Bluetooth State: ${state}`);
      diagnostics.push(`Connected: ${this.isConnected ? 'Yes' : 'No'}`);
      diagnostics.push(`Connecting: ${this.isConnecting ? 'Yes' : 'No'}`);
      diagnostics.push(`Scanning: ${this.isScanning ? 'Yes' : 'No'}`);
      
      if (this.device) {
        diagnostics.push(`Device Name: ${this.device.name || 'Unknown'}`);
        diagnostics.push(`Device ID: ${this.device.id}`);
      }
      
      if (this.characteristic) {
        diagnostics.push(`Characteristic: ${this.characteristic.uuid}`);
      }

      // Check permissions on Android
      if (Platform.OS === 'android') {
        const apiLevel = parseInt(Platform.constants?.Release || '0', 10);
        diagnostics.push(`Android API Level: ${apiLevel}`);
        
        if (apiLevel >= 12) {
          const scanPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
          const connectPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
          diagnostics.push(`BLUETOOTH_SCAN: ${scanPerm ? 'Granted' : 'Denied'}`);
          diagnostics.push(`BLUETOOTH_CONNECT: ${connectPerm ? 'Granted' : 'Denied'}`);
        } else {
          const bluetoothPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH);
          const locationPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
          diagnostics.push(`BLUETOOTH: ${bluetoothPerm ? 'Granted' : 'Denied'}`);
          diagnostics.push(`LOCATION: ${locationPerm ? 'Granted' : 'Denied'}`);
        }
      }
      
    } catch (error) {
      diagnostics.push(`Error getting diagnostics: ${error}`);
    }

    return diagnostics.join('\n');
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
