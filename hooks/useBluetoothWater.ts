import { useState, useEffect, useRef } from 'react';
import { BluetoothWaterService, WaterLevelData } from '../services/BluetoothWaterService';
import { useAuth } from '../providers/auth-provider';

export const useBluetoothWater = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [waterLevelData, setWaterLevelData] = useState<WaterLevelData | null>(null);
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
        const handleDataReceived = (data: WaterLevelData) => {
          setWaterLevelData(data);
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

        bluetoothService.current.addDataListener(handleDataReceived);
        bluetoothService.current.addConnectionListener(handleConnectionChange);
        
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

  const connectToDevice = async () => {
    if (!bluetoothService.current || isConnecting) return false;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log('Attempting to connect to Bluetooth device...');
      const connected = await bluetoothService.current.scanAndConnect();
      
      if (!connected) {
        setConnectionError('Failed to connect to Smart Water Bottle');
        console.log('Connection failed');
      } else {
        console.log('Successfully connected to Smart Water Bottle');
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
    
    // Data
    waterLevelData,
    currentWaterLevel: getCurrentWaterLevel(),
    currentDistance: getCurrentDistance(),
    lastUpdateTime,
    timeSinceLastUpdate: getTimeSinceLastUpdate(),
    isDataFresh: isDataFresh(),
    
    // Actions
    connectToDevice,
    disconnectDevice,
  };
};
