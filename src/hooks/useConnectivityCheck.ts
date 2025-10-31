import { useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Alert } from 'react-native';

interface ConnectivityCheckOptions {
  showAlert?: boolean;
  alertTitle?: string;
  alertMessage?: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
}

interface ConnectivityCheckResult {
  isConnected: boolean;
  isInternetReachable: boolean;
  connectionType: string;
  isLoading: boolean;
  error: string | null;
  retry: () => Promise<void>;
}

export const useConnectivityCheck = (
  options: ConnectivityCheckOptions = {}
): ConnectivityCheckResult => {
  const {
    showAlert = false,
    alertTitle = 'No Internet Connection',
    alertMessage = 'Please check your internet connection and try again.',
    retryOnFailure = false,
    maxRetries = 3,
  } = options;

  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const checkConnectivity = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const state = await NetInfo.fetch();
      
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);

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

      // Reset retry count on successful connection
      if (state.isConnected && state.isInternetReachable) {
        setRetryCount(0);
      } else if (showAlert) {
        // Show alert for connection issues
        Alert.alert(alertTitle, alertMessage, [
          {
            text: 'OK',
            onPress: () => {},
          },
          ...(retryOnFailure && retryCount < maxRetries
            ? [
                {
                  text: 'Retry',
                  onPress: () => {
                    setRetryCount(prev => prev + 1);
                    setTimeout(() => checkConnectivity(), 1000);
                  },
                },
              ]
            : []),
        ]);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Connectivity check error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [showAlert, alertTitle, alertMessage, retryOnFailure, maxRetries, retryCount]);

  const retry = useCallback(async (): Promise<void> => {
    setRetryCount(0);
    await checkConnectivity();
  }, [checkConnectivity]);

  useEffect(() => {
    // Initial check
    checkConnectivity();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);

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
    });

    return () => {
      unsubscribe();
    };
  }, [checkConnectivity]);

  return {
    isConnected,
    isInternetReachable,
    connectionType,
    isLoading,
    error,
    retry,
  };
};

export default useConnectivityCheck;
