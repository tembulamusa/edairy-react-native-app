import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Alert } from 'react-native';

interface ConnectivityContextType {
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean;
  lastConnectedAt: Date | null;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'none';
  showOfflineBanner: boolean;
  setShowOfflineBanner: (show: boolean) => void;
  checkConnectivity: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

interface ConnectivityProviderProps {
  children: ReactNode;
}

export const ConnectivityProvider: React.FC<ConnectivityProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(false);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'none'>('none');
  const [showOfflineBanner, setShowOfflineBanner] = useState<boolean>(false);
  const [hasShownInitialAlert, setHasShownInitialAlert] = useState<boolean>(false);

  const checkConnectivity = async (): Promise<void> => {
    try {
      const state = await NetInfo.fetch();
      handleNetworkChange(state);
    } catch (error) {
      console.error('Error checking connectivity:', error);
    }
  };

  const handleNetworkChange = (state: NetInfoState) => {
    const wasConnected = isConnected;
    const wasInternetReachable = isInternetReachable;

    setIsConnected(state.isConnected ?? false);
    setIsInternetReachable(state.isInternetReachable ?? false);

    // Update connection type
    const connectionMap: Record<string, string> = {
      unknown: 'Unknown',
      none: 'No Connection',
      cellular: 'Mobile Data',
      wifi: 'WiFi',
      ethernet: 'Ethernet',
      bluetooth: 'Bluetooth',
      vpn: 'VPN',
      wimax: 'WiMAX',
      other: 'Other',
    };
    
    setConnectionType(connectionMap[state.type] || 'Unknown');

    // Determine connection quality based on type and details
    let quality: 'excellent' | 'good' | 'poor' | 'none' = 'none';
    
    if (state.isConnected && state.isInternetReachable) {
      if (state.type === 'wifi') {
        quality = 'excellent';
      } else if (state.type === 'cellular') {
        // Check cellular generation for quality
        const cellularDetails = state.details as any;
        const generation = cellularDetails?.cellularGeneration;
        if (generation === '4g' || generation === '5g') {
          quality = 'good';
        } else {
          quality = 'poor';
        }
      } else {
        quality = 'good';
      }
    }
    
    setConnectionQuality(quality);

    // Update last connected timestamp
    if (state.isConnected && state.isInternetReachable && !wasConnected) {
      setLastConnectedAt(new Date());
      setShowOfflineBanner(false);
    }

    // Show offline banner and alert when connection is lost
    if (!state.isConnected || !state.isInternetReachable) {
      setShowOfflineBanner(true);
      
      // Always show alert when going offline (except on very first app load)
      const shouldShowAlert = wasConnected || wasInternetReachable || 
                            (!hasShownInitialAlert && !state.isConnected);
      
      if (shouldShowAlert) {
        setHasShownInitialAlert(true);
        
        // Use setTimeout to ensure alert shows after state updates
        setTimeout(() => {
          Alert.alert(
            'No Internet Connection',
            'Your internet connection is not available. Some features may not work properly.',
            [
              {
                text: 'OK',
                onPress: () => {},
              },
              {
                text: 'Retry',
                onPress: () => {
                  checkConnectivity();
                },
              },
            ]
          );
        }, 100);
      }
    } else {
      // Connection restored - show "back online" notification
      const wasOffline = !wasConnected || !wasInternetReachable;
      setShowOfflineBanner(false);
      setHasShownInitialAlert(true);
      
      // Show "back online" notification if we were previously offline
      if (wasOffline && hasShownInitialAlert) {
        setTimeout(() => {
          Alert.alert(
            'You\'re back online!',
            'Your internet connection has been restored.',
            [
              {
                text: 'OK',
                onPress: () => {},
              },
            ]
          );
        }, 200);
      }
    }

    // Log connection changes for debugging
    console.log('Network Status:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      quality,
      timestamp: new Date().toISOString(),
    });
  };

  useEffect(() => {
    // Initial connectivity check
    checkConnectivity();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log('Network state changed:', state);
      handleNetworkChange(state);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Periodic connectivity check (every 10 seconds when offline, 60 seconds when online)
  useEffect(() => {
    const checkInterval = isConnected && isInternetReachable ? 60000 : 10000;
    
    const interval = setInterval(() => {
      console.log('Periodic connectivity check...');
      checkConnectivity();
    }, checkInterval);

    return () => clearInterval(interval);
  }, [isConnected, isInternetReachable]);

  const contextValue: ConnectivityContextType = {
    isConnected,
    connectionType,
    isInternetReachable,
    lastConnectedAt,
    connectionQuality,
    showOfflineBanner,
    setShowOfflineBanner,
    checkConnectivity,
  };

  return (
    <ConnectivityContext.Provider value={contextValue}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = (): ConnectivityContextType => {
  const context = useContext(ConnectivityContext);
  if (context === undefined) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
};

export default ConnectivityContext;
