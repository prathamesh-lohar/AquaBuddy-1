import { BleManager, Device, Service, Characteristic } from 'react-native-ble-plx';
import { Platform, Alert, PermissionsAndroid } from 'react-native';

// Your IoT device UUIDs (from Arduino code)
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const DEVICE_NAME = 'SmartWaterBottle';

export interface WaterLevelData {
  distance: number; // in mm
  waterLevel: number; // percentage (0-1)
  timestamp: number;
}

export class BluetoothWaterService {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private characteristic: Characteristic | null = null;
  private listeners: ((data: WaterLevelData) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private isConnecting = false;
  private isInitialized = false;
  private initializationError = false;
  
  // Bottle configuration
  private bottleHeight = 150; // mm (default bottle height)
  private emptyDistance = 140; // mm (distance when bottle is empty)
  private fullDistance = 20; // mm (distance when bottle is full)

  constructor() {
    try {
      this.initializeBluetooth().catch(error => {
        console.error('Constructor initialization error:', error);
        this.initializationError = true;
      });
    } catch (error) {
      console.error('Constructor error:', error);
      this.initializationError = true;
    }
  }

  private async initializeBluetooth() {
    try {
      console.log('Initializing Bluetooth service...');
      
      // Check if we're on a supported platform
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        console.log('Bluetooth not supported on this platform');
        this.initializationError = true;
        return;
      }

      // Check if BLE is available
      if (!BleManager) {
        console.error('BLE Manager not available');
        this.initializationError = true;
        return;
      }

      // Request permissions first
      const hasPermissions = await this.requestBluetoothPermissions();
      if (!hasPermissions) {
        console.log('Bluetooth permissions not granted');
        this.initializationError = true;
        return;
      }

      // Initialize BLE manager with immediate state checking
      await new Promise<void>((resolve, reject) => {
        try {
          this.manager = new BleManager();
          console.log('✅ BLE Manager created');

          // Check initial state immediately
          this.manager.state().then(initialState => {
            console.log('📱 Initial Bluetooth state:', initialState);
            if (initialState === 'PoweredOn') {
              console.log('🎯 Bluetooth is ready immediately');
              this.isInitialized = true;
              this.initializationError = false;
              resolve();
            } else {
              console.log('⏳ Waiting for Bluetooth to be ready...');
              
              // Set up state change listener
              this.manager!.onStateChange((state) => {
                console.log('🔄 Bluetooth state changed to:', state);
                if (state === 'PoweredOn') {
                  console.log('✅ Bluetooth is now ready!');
                  this.isInitialized = true;
                  this.initializationError = false;
                  resolve();
                } else {
                  console.log('⚠️ Bluetooth is not ready:', state);
                  this.isInitialized = false;
                  if (state === 'PoweredOff') {
                    console.log('❌ Bluetooth is disabled');
                    this.initializationError = true;
                    reject(new Error('Bluetooth is disabled'));
                  }
                }
              }, true);
              
              // Timeout after 10 seconds
              setTimeout(() => {
                if (!this.isInitialized) {
                  console.log('⏰ Bluetooth initialization timeout');
                  this.initializationError = true;
                  reject(new Error('Bluetooth initialization timeout'));
                }
              }, 10000);
            }
          }).catch(error => {
            console.error('❌ Error checking initial state:', error);
            this.initializationError = true;
            reject(error);
          });

        } catch (error) {
          console.error('❌ Error creating BLE manager:', error);
          this.initializationError = true;
          reject(error);
        }
      });

    } catch (error) {
      console.error('Error initializing Bluetooth:', error);
      this.initializationError = true;
    }
  }

  private async requestBluetoothPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // For Android 12+ (API 31+), we need BLUETOOTH_SCAN and BLUETOOTH_CONNECT
        // For older versions, we need BLUETOOTH and BLUETOOTH_ADMIN
        const permissions = [];
        
        // Check Android API level
        const apiLevel = parseInt(Platform.constants?.Release || '0', 10);
        
        if (apiLevel >= 12) {
          // Android 12+ permissions
          permissions.push(
            'android.permission.BLUETOOTH_SCAN',
            'android.permission.BLUETOOTH_CONNECT'
          );
        } else {
          // Legacy permissions for older Android
          permissions.push(
            'android.permission.BLUETOOTH',
            'android.permission.BLUETOOTH_ADMIN',
            'android.permission.ACCESS_COARSE_LOCATION' // Still needed for older versions
          );
        }

        // Request permissions
        let allGranted = true;
        for (const permission of permissions) {
          try {
            const granted = await PermissionsAndroid.request(
              permission as any // Type assertion for custom permissions
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              console.log(`Permission denied: ${permission}`);
              allGranted = false;
            } else {
              console.log(`Permission granted: ${permission}`);
            }
          } catch (error) {
            console.error(`Error requesting permission ${permission}:`, error);
            allGranted = false;
          }
        }

        if (!allGranted) {
          Alert.alert(
            'Bluetooth Permissions Required',
            'This app needs Bluetooth permissions to connect to your Smart Water Bottle. Please enable Bluetooth permissions in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                // You can add code here to open device settings if needed
                console.log('User should manually enable Bluetooth permissions in settings');
              }}
            ]
          );
          return false;
        }
        
        console.log('All Bluetooth permissions granted');
        return true;
      }
      
      // iOS permissions are handled by the BLE library
      console.log('iOS - permissions handled by BLE library');
      return true;
    } catch (error) {
      console.error('Error requesting Bluetooth permissions:', error);
      Alert.alert(
        'Permission Error',
        'Unable to request Bluetooth permissions. Please check your device settings and try again.'
      );
      return false;
    }
  }

  public setBottleConfiguration(capacity: number) {
    // Adjust distances based on bottle capacity
    // This is a rough calculation - you may need to calibrate
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
        // Use default values
        break;
    }
  }

  private convertDistanceToWaterLevel(distance: number): number {
    // Convert distance to water level percentage
    if (distance <= this.fullDistance) return 1.0; // 100% full
    if (distance >= this.emptyDistance) return 0.0; // 0% empty
    
    // Linear interpolation between full and empty
    const waterLevel = 1 - ((distance - this.fullDistance) / (this.emptyDistance - this.fullDistance));
    return Math.max(0, Math.min(1, waterLevel));
  }

  public async scanAndConnect(): Promise<boolean> {
    try {
      // Safety checks
      if (this.initializationError) {
        console.error('Bluetooth service failed to initialize');
        Alert.alert(
          'Bluetooth Error',
          'Bluetooth service is not available. Please restart the app and ensure Bluetooth is enabled.',
          [{ text: 'OK' }]
        );
        return false;
      }

      if (this.isConnecting) {
        console.log('Already connecting...');
        return false;
      }

      if (!this.manager) {
        console.error('BLE Manager not initialized');
        Alert.alert(
          'Bluetooth Error',
          'Bluetooth is not ready. Please restart the app.',
          [{ text: 'OK' }]
        );
        return false;
      }

      if (!this.isInitialized) {
        console.log('BLE Manager not ready, waiting...');
        // Try to wait for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!this.isInitialized) {
          Alert.alert(
            'Bluetooth Not Ready',
            'Bluetooth is not ready yet. Please ensure Bluetooth is enabled and try again.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }

      this.isConnecting = true;
      console.log('Starting scan for Smart Water Bottle...');
      
      // Check Bluetooth state
      const state = await this.manager.state();
      console.log('Current Bluetooth state:', state);
      
      if (state !== 'PoweredOn') {
        Alert.alert(
          'Bluetooth Disabled',
          'Please enable Bluetooth in your device settings to connect to your Smart Water Bottle.',
          [{ text: 'OK' }]
        );
        this.isConnecting = false;
        return false;
      }

      return new Promise((resolve) => {
        if (!this.manager) {
          console.error('Manager disappeared during scan');
          this.isConnecting = false;
          resolve(false);
          return;
        }

        // Set a timeout for scanning
        const scanTimeout = setTimeout(() => {
          console.log('Scan timeout - device not found');
          this.manager?.stopDeviceScan();
          this.isConnecting = false;
          Alert.alert(
            'Device Not Found',
            'Smart Water Bottle not found. Make sure your device is powered on and nearby.',
            [{ text: 'OK' }]
          );
          resolve(false);
        }, 30000); // 30 seconds timeout

        // Enhanced scanning - try both service UUID and name-based discovery
        console.log('Starting enhanced BLE scan...');
        
        this.manager.startDeviceScan(
          null, // Scan for all devices first
          { allowDuplicates: false },
          async (error, device) => {
            try {
              if (error) {
                console.error('Scan error:', error);
                clearTimeout(scanTimeout);
                this.manager?.stopDeviceScan();
                this.isConnecting = false;
                Alert.alert(
                  'Scan Error',
                  `Failed to scan for devices: ${error.message || 'Unknown error'}`,
                  [{ text: 'OK' }]
                );
                resolve(false);
                return;
              }

              if (device) {
                console.log(`Found device: ${device.name || 'Unknown'} (${device.id})`);
                
                // Check multiple ways to identify our device
                const isOurDevice = 
                  device.name === DEVICE_NAME ||
                  device.localName === DEVICE_NAME ||
                  (device.serviceUUIDs && device.serviceUUIDs.includes(SERVICE_UUID)) ||
                  (device.name && device.name.toLowerCase().includes('water')) ||
                  (device.name && device.name.toLowerCase().includes('smart'));

                if (isOurDevice) {
                  console.log('Found Smart Water Bottle:', {
                    name: device.name,
                    localName: device.localName,
                    id: device.id,
                    serviceUUIDs: device.serviceUUIDs
                  });
                  
                  clearTimeout(scanTimeout);
                  this.manager?.stopDeviceScan();

                  const connected = await this.connectToDevice(device);
                  this.isConnecting = false;
                  resolve(connected);
                }
              }
            } catch (scanError) {
              console.error('Error in scan callback:', scanError);
              clearTimeout(scanTimeout);
              this.manager?.stopDeviceScan();
              this.isConnecting = false;
              resolve(false);
            }
          }
        );
      });
    } catch (error) {
      console.error('Error in scanAndConnect:', error);
      this.isConnecting = false;
      Alert.alert(
        'Connection Error',
        `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
      return false;
    }
  }
            

  private async connectToDevice(device: Device): Promise<boolean> {
    try {
      console.log('Connecting to device...');
      this.device = await device.connect();
      
      console.log('Discovering services...');
      await this.device.discoverAllServicesAndCharacteristics();
      
      const services = await this.device.services();
      const service = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
      
      if (!service) {
        console.error('Service not found');
        return false;
      }

      const characteristics = await service.characteristics();
      this.characteristic = characteristics.find(c => 
        c.uuid.toLowerCase() === CHARACTERISTIC_UUID.toLowerCase()
      ) || null;

      if (!this.characteristic) {
        console.error('Characteristic not found');
        return false;
      }

      // Start monitoring for data
      await this.startMonitoring();
      
      // Set up disconnection monitoring
      this.device.onDisconnected(() => {
        console.log('Device disconnected');
        this.device = null;
        this.characteristic = null;
        this.notifyConnectionListeners(false);
        
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          this.scanAndConnect();
        }, 5000);
      });

      console.log('Successfully connected to Smart Water Bottle');
      this.notifyConnectionListeners(true);
      return true;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  }

  private async startMonitoring() {
    if (!this.characteristic) return;

    try {
      console.log('Starting data monitoring...');
      await this.characteristic.monitor((error, characteristic) => {
        if (error) {
          console.error('Monitoring error:', error);
          return;
        }

        if (characteristic && characteristic.value) {
          try {
            const data = Buffer.from(characteristic.value, 'base64').toString();
            console.log('Raw data received:', data);
            
            // Try to parse as JSON first (new ESP32 format)
            try {
              const jsonData = JSON.parse(data);
              if (jsonData.distance !== undefined) {
                const distance = parseInt(jsonData.distance);
                const timestamp = jsonData.timestamp ? parseInt(jsonData.timestamp) : Date.now();
                
                if (!isNaN(distance)) {
                  const waterLevel = this.convertDistanceToWaterLevel(distance);
                  
                  const waterData: WaterLevelData = {
                    distance,
                    waterLevel,
                    timestamp: timestamp
                  };

                  console.log(`JSON Data - Distance: ${distance}mm, Water Level: ${(waterLevel * 100).toFixed(1)}%`);
                  this.notifyListeners(waterData);
                }
                return;
              }
            } catch (jsonError) {
              // Not JSON, try parsing as plain number (legacy format)
              console.log('Not JSON, trying plain number format');
            }
            
            // Fallback: try parsing as plain distance value
            const distance = parseInt(data.trim());
            if (!isNaN(distance)) {
              const waterLevel = this.convertDistanceToWaterLevel(distance);
              
              const waterData: WaterLevelData = {
                distance,
                waterLevel,
                timestamp: Date.now()
              };

              console.log(`Plain Data - Distance: ${distance}mm, Water Level: ${(waterLevel * 100).toFixed(1)}%`);
              this.notifyListeners(waterData);
            } else {
              console.warn('Could not parse distance data:', data);
            }
          } catch (parseError) {
            console.error('Error parsing received data:', parseError);
          }
        }
      });
      
      console.log('Data monitoring started successfully');
    } catch (error) {
      console.error('Error starting monitoring:', error);
    }
  }
     

  public addDataListener(callback: (data: WaterLevelData) => void) {
    this.listeners.push(callback);
  }

  public removeDataListener(callback: (data: WaterLevelData) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  public addConnectionListener(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
  }

  public removeConnectionListener(callback: (connected: boolean) => void) {
    this.connectionListeners = this.connectionListeners.filter(listener => listener !== callback);
  }

  private notifyListeners(data: WaterLevelData) {
    this.listeners.forEach(listener => listener(data));
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(listener => listener(connected));
  }

  public isConnected(): boolean {
    return this.device !== null && this.characteristic !== null;
  }

  public async disconnect() {
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
    this.device = null;
    this.characteristic = null;
    this.notifyConnectionListeners(false);
  }

  public destroy() {
    this.disconnect();
    if (this.manager) {
      this.manager.destroy();
    }
    this.listeners = [];
    this.connectionListeners = [];
  }
}
