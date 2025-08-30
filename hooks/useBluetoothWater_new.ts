import { useState, useEffect, useRef } from 'react';
import { BluetoothWaterService, WaterLevelData, BluetoothDevice } from '../services/BluetoothWaterService';
import { useAuth } from '../providers/auth-provider';

export const useBluetoothWater = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [waterLevelData, setWaterLevelData] = useState<WaterLevelData | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const bluetoothService = useRef<BluetoothWaterService | null>(null);

  useEffect(() => {
    // Initialize Bluetooth service
    const initializeService = async () => {
      try {
        bluetoothService.current = new BluetoothWaterService();
        
        // Set bottle configuration from user settings
        if (user?.bottleCapacity) {
          bluetoothService.current.setBottleConfiguration(user.bottleCapacity);
        }

        // Set up listeners
        const handleDataReceived = (data: WaterLevelData) => {
          setWaterLevelData(data);
          setLastUpdateTime(data.timestamp);
          setConnectionError(null);
        };

        const handleConnectionChange = (connected: boolean) => {
          setIsConnected(connected);
          setIsConnecting(false);
          if (!connected) {
            setConnectionError('Device disconnected');
            setSelectedDevice(null);
          } else {
            setConnectionError(null);
          }
        };

        const handleDeviceListUpdate = (devices: BluetoothDevice[]) => {
          setAvailableDevices(devices);
          setIsScanning(devices.length === 0); // Still scanning if no devices found
        };

        bluetoothService.current.addDataListener(handleDataReceived);
        bluetoothService.current.addConnectionListener(handleConnectionChange);
        bluetoothService.current.addDeviceListener(handleDeviceListUpdate);
        
      } catch (error) {
        console.error('Failed to initialize Bluetooth service:', error);
        setConnectionError('Failed to initialize Bluetooth');
      }
    };

    initializeService();

    // Cleanup on unmount
    return () => {
      if (bluetoothService.current) {
        bluetoothService.current.destroy();
      }
    };
  }, [user?.bottleCapacity]);

  const scanForDevices = async () => {
    if (!bluetoothService.current || isScanning) return [];

    setIsScanning(true);
    setConnectionError(null);
    setAvailableDevices([]);

    try {
      console.log('Scanning for Bluetooth devices...');
      const devices = await bluetoothService.current.scanForDevices(15000);
      setAvailableDevices(devices);
      setIsScanning(false);
      
      if (devices.length === 0) {
        setConnectionError('No devices found. Make sure your water bottle is powered on and nearby.');
      }
      
      return devices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown scan error';
      setConnectionError(`Scan failed: ${errorMessage}`);
      console.error('Scan error:', error);
      setIsScanning(false);
      return [];
    }
  };

  const connectToDevice = async (deviceId?: string) => {
    if (!bluetoothService.current || isConnecting) return false;

    // Use provided deviceId or selected device
    const targetDeviceId = deviceId || selectedDevice?.id;
    if (!targetDeviceId) {
      setConnectionError('No device selected');
      return false;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log('Attempting to connect to device:', targetDeviceId);
      const connected = await bluetoothService.current.connectToDevice(targetDeviceId);
      
      if (connected) {
        console.log('Successfully connected to device');
        // Update selected device info if connected by ID
        if (deviceId) {
          const device = availableDevices.find(d => d.id === deviceId);
          if (device) setSelectedDevice(device);
        }
        setConnectionError(null);
      } else {
        setConnectionError('Failed to connect to selected device');
        console.log('Connection failed');
      }
      
      setIsConnecting(false);
      return connected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      setConnectionError(`Connection failed: ${errorMessage}`);
      console.error('Connection error:', error);
      setIsConnecting(false);
      return false;
    }
  };

  const stopScanning = () => {
    if (bluetoothService.current) {
      bluetoothService.current.stopScanning();
      setIsScanning(false);
    }
  };

  const selectDevice = (device: BluetoothDevice) => {
    setSelectedDevice(device);
    setConnectionError(null);
  };

  const disconnectDevice = async () => {
    if (!bluetoothService.current) return;

    try {
      await bluetoothService.current.disconnect();
      setConnectionError(null);
      setSelectedDevice(null);
      setWaterLevelData(null);
      setLastUpdateTime(0);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const getDiagnostics = async (): Promise<string> => {
    if (!bluetoothService.current) {
      return 'Bluetooth service not available';
    }
    return await bluetoothService.current.getDiagnostics();
  };

  const getCurrentWaterLevel = (): number => {
    return waterLevelData?.waterLevel || 0;
  };

  const getCurrentDistance = (): number => {
    return waterLevelData?.distance || 0;
  };

  const getTimeSinceLastUpdate = (): number => {
    if (!lastUpdateTime) return 0;
    return Date.now() - lastUpdateTime;
  };

  const isDataFresh = (): boolean => {
    const timeSince = getTimeSinceLastUpdate();
    return timeSince < 10000; // Consider data fresh if less than 10 seconds old
  };

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,
    
    // Device scanning
    isScanning,
    availableDevices,
    selectedDevice,
    
    // Data
    waterLevelData,
    currentWaterLevel: getCurrentWaterLevel(),
    currentDistance: getCurrentDistance(),
    lastUpdateTime,
    timeSinceLastUpdate: getTimeSinceLastUpdate(),
    isDataFresh: isDataFresh(),
    
    // Actions
    scanForDevices,
    stopScanning,
    selectDevice,
    connectToDevice,
    disconnectDevice,
    getDiagnostics,
  };
};
