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

    // Cleanup on unmount - Don't destroy the service, just clean up listeners
    return () => {
      if (bluetoothService.current) {
        try {
          // Only stop scanning, don't destroy the whole service
          if (isScanning) {
            bluetoothService.current.stopScanning();
          }
          // The service should persist across components for device continuity
          console.log('🔄 Cleaning up Bluetooth hook listeners (keeping service alive)');
        } catch (error) {
          console.error('⚠️ Error during hook cleanup:', error);
        }
      }
    };
  }, [user?.bottleCapacity]);

  const scanForDevices = async () => {
    try {
      // Ensure service is ready
      const serviceReady = await ensureServiceReady();
      if (!serviceReady) {
        setConnectionError('Bluetooth service initialization failed');
        return [];
      }

      if (isScanning) {
        console.log('⚠️ Scan already in progress, skipping...');
        return [];
      }

      setIsScanning(true);
      setConnectionError(null);

      console.log('🔍 Starting device scan...');
      const devices = await bluetoothService.current!.scanForDevices();
      setAvailableDevices(devices);
      console.log(`✅ Scan completed. Found ${devices.length} devices`);
      return devices;
    } catch (error) {
      console.error('❌ Error scanning for devices:', error);
      setConnectionError(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    } finally {
      setIsScanning(false);
    }
  };

    const connectToDevice = async (deviceId?: string) => {
    try {
      // Ensure service is ready
      const serviceReady = await ensureServiceReady();
      if (!serviceReady) {
        setConnectionError('Bluetooth service initialization failed');
        return false;
      }
      
      if (isConnecting) {
        console.log('⚠️ Connection already in progress, skipping...');
        return false;
      }

      // If no deviceId provided, try to connect to selected device
      const targetDeviceId = deviceId || selectedDevice?.id;
      if (!targetDeviceId) {
        console.error('❌ No device selected for connection');
        setConnectionError('No device selected');
        return false;
      }

      setIsConnecting(true);
      setConnectionError(null);

      console.log('🔗 Attempting to connect to device:', targetDeviceId);
      const success = await bluetoothService.current!.connectToDevice(targetDeviceId);
      
      if (success) {
        console.log('✅ Device connected successfully');
        setIsConnected(true);
        
        // Start listening to sensor data
        bluetoothService.current!.addDataListener((data: SensorData) => {
          setSensorData(data);
          setLastUpdateTime(Date.now());
        });
      } else {
        console.error('❌ Device connection failed');
        setConnectionError('Failed to connect to device');
        setIsConnected(false);
      }
      
      return success;
    } catch (error) {
      console.error('❌ Error during device connection:', error);
      setConnectionError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnected(false);
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const stopScanning = () => {
    try {
      if (bluetoothService.current && isScanning) {
        console.log('⏹️ Stopping device scan...');
        bluetoothService.current.stopScanning();
        setIsScanning(false);
        console.log('✅ Device scan stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping scan:', error);
      setIsScanning(false); // Force update state even if service call fails
    }
  };

  const selectDevice = (device: BluetoothDevice) => {
    setSelectedDevice(device);
    setConnectionError(null);
  };

  const disconnectDevice = async () => {
    try {
      if (!bluetoothService.current) {
        console.log('⚠️ No Bluetooth service to disconnect from');
        return;
      }

      console.log('🔌 Disconnecting from device...');
      await bluetoothService.current.disconnect();
      setIsConnected(false);
      setSensorData(null);
      setSelectedDevice(null);
      setConnectionError(null);
      console.log('✅ Device disconnected successfully');
    } catch (error) {
      console.error('❌ Error during disconnect:', error);
      setConnectionError(`Disconnect failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Still update state to reflect disconnection attempt
      setIsConnected(false);
      setSensorData(null);
      setSelectedDevice(null);
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
      console.log('🔄 Force reinitializing Bluetooth service...');
      setConnectionError(null);
      setIsConnected(false);
      setIsConnecting(false);
      setIsScanning(false);
      setSelectedDevice(null);
      setSensorData(null);
      
      if (bluetoothService.current) {
        try {
          // Only disconnect, don't destroy
          await bluetoothService.current.disconnect();
        } catch (disconnectError) {
          console.log('⚠️ Disconnect error during reinit (continuing):', disconnectError);
        }
        
        return await bluetoothService.current.reinitialize();
      }
      
      // Create new service if none exists
      console.log('🆕 Creating new Bluetooth service instance...');
      bluetoothService.current = new BluetoothWaterService();
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ Bluetooth service reinitialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to reinitialize:', error);
      setConnectionError(`Reinit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const enterDeepSleep = async (durationMinutes: number = 60): Promise<boolean> => {
    if (!bluetoothService.current) {
      setConnectionError('Bluetooth service not available');
      return false;
    }

    try {
      console.log(`😴 Entering deep sleep mode for ${durationMinutes} minutes...`);
      const success = await bluetoothService.current.enterDeepSleep(durationMinutes);
      
      if (success) {
        setConnectionError(null);
        console.log('✅ Device entered deep sleep mode');
      } else {
        setConnectionError('Failed to enter sleep mode');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Sleep mode error:', error);
      setConnectionError('Failed to enter sleep mode');
      return false;
    }
  };

  const wakeUpDevice = async (): Promise<boolean> => {
    if (!bluetoothService.current) {
      setConnectionError('Bluetooth service not available');
      return false;
    }

    try {
      console.log('⏰ Attempting to wake up device...');
      const success = await bluetoothService.current.wakeUpDevice();
      
      if (success) {
        setConnectionError(null);
        console.log('✅ Device woken up successfully');
      } else {
        setConnectionError('Device may still be sleeping');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Wake up error:', error);
      setConnectionError('Failed to wake up device');
      return false;
    }
  };

  const sendCommand = async (command: string): Promise<boolean> => {
    if (!bluetoothService.current) {
      setConnectionError('Bluetooth service not available');
      return false;
    }

    try {
      const success = await bluetoothService.current.sendCommand(command);
      
      if (!success) {
        setConnectionError('Failed to send command');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Command error:', error);
      setConnectionError('Failed to send command');
      return false;
    }
  };

  // Production safety check
  const ensureServiceReady = async (): Promise<boolean> => {
    if (!bluetoothService.current) {
      console.log('🔧 Bluetooth service not ready, initializing...');
      return await forceReinitialize();
    }
    return true;
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
    ensureServiceReady,
    
    // Sleep mode functions
    enterDeepSleep,
    wakeUpDevice,
    sendCommand,
  };
};
