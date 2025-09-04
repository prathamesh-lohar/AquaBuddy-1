import { useState, useEffect, useRef } from 'react';
import { BluetoothWaterService, BluetoothDevice } from '../services/BluetoothWaterService';
import { SensorData } from '../types';
import { useAuth } from '../providers/auth-provider';

export const useBluetoothWater = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const bluetoothService = useRef<BluetoothWaterService | null>(null);

  useEffect(() => {
    // Initialize Bluetooth service with error handling
    const initializeService = async () => {
      try {
        bluetoothService.current = new BluetoothWaterService();
        
        // Wait a bit for service to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Set bottle configuration from user settings
        if (user?.bottleCapacity) {
          bluetoothService.current.setBottleConfiguration(user.bottleCapacity);
        }

        // Set up listeners
        const handleDataReceived = (data: SensorData) => {
          setSensorData(data);
          setLastUpdateTime(data.timestamp);
          setConnectionError(null);
        };

        const handleConnectionChange = (connected: boolean) => {
          setIsConnected(connected);
          if (!connected) {
            setConnectionError('Device disconnected');
          } else {
            setConnectionError(null);
          }
        };

        const handleDeviceListUpdate = (devices: BluetoothDevice[]) => {
          setAvailableDevices(devices);
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
    if (!bluetoothService.current) {
      console.error('❌ Bluetooth service not initialized, reinitializing...');
      // Try to reinitialize
      try {
        bluetoothService.current = new BluetoothWaterService();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('❌ Failed to reinitialize Bluetooth service:', error);
        return [];
      }
    }
    
    if (isScanning) return [];

    setIsScanning(true);
    setConnectionError(null);

    try {
      console.log('Scanning for Bluetooth devices...');
      const devices = await bluetoothService.current.scanForDevices();
      setAvailableDevices(devices);
      return devices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown scan error';
      setConnectionError(`Scan failed: ${errorMessage}`);
      console.error('Scan error:', error);
      return [];
    } finally {
      setIsScanning(false);
    }
  };

  const connectToDevice = async (deviceId?: string) => {
    if (!bluetoothService.current || isConnecting) return false;

    // If no deviceId provided, try to connect to selected device
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
      
      if (!connected) {
        setConnectionError('Failed to connect to selected device');
        console.log('Connection failed');
      } else {
        console.log('Successfully connected to device');
        // Update selected device info if connected by ID
        if (deviceId) {
          const device = availableDevices.find(d => d.id === deviceId);
          if (device) setSelectedDevice(device);
        }
      }
      
      return connected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      setConnectionError(`Connection failed: ${errorMessage}`);
      console.error('Connection error:', error);
      
      // Show user-friendly error
      if (errorMessage.includes('not available') || errorMessage.includes('not initialized')) {
        setConnectionError('Bluetooth not available. Please restart the app.');
      } else if (errorMessage.includes('permission')) {
        setConnectionError('Bluetooth permissions required. Please enable in settings.');
      } else {
        setConnectionError('Connection failed. Please try again.');
      }
      
      return false;
    } finally {
      setIsConnecting(false);
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
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const getCurrentWaterLevel = (): number => {
    return sensorData?.waterLevel || 0;
  };

  const getCurrentDistance = (): number => {
    return sensorData?.distance || 0;
  };

  const getTimeSinceLastUpdate = (): number => {
    if (!lastUpdateTime) return 0;
    return Date.now() - lastUpdateTime;
  };

  const isDataFresh = (): boolean => {
    const timeSince = getTimeSinceLastUpdate();
    return timeSince < 10000; // Consider data fresh if less than 10 seconds old
  };

  const getDiagnostics = async (): Promise<string> => {
    if (!bluetoothService.current) {
      return 'Bluetooth service not available';
    }
    return await bluetoothService.current.getDiagnostics();
  };

  const forceReinitialize = async (): Promise<boolean> => {
    try {
      setConnectionError(null);
      
      if (bluetoothService.current) {
        return await bluetoothService.current.reinitialize();
      }
      
      // Create new service if none exists
      bluetoothService.current = new BluetoothWaterService();
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    } catch (error) {
      console.error('❌ Failed to reinitialize:', error);
      setConnectionError('Failed to reinitialize Bluetooth');
      return false;
    }
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
    sensorData,
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
    forceReinitialize,
  };
};
