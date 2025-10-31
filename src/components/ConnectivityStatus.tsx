import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useConnectivity } from '../context/ConnectivityContext';

interface ConnectivityStatusProps {
  showBanner?: boolean;
  position?: 'top' | 'bottom';
  onRetry?: () => void;
}

const ConnectivityStatus: React.FC<ConnectivityStatusProps> = ({
  showBanner = true,
  position = 'top',
  onRetry,
}) => {
  const {
    isConnected,
    connectionType,
    isInternetReachable,
    connectionQuality,
    showOfflineBanner,
    setShowOfflineBanner,
    checkConnectivity,
  } = useConnectivity();

  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [slideAnim] = React.useState(new Animated.Value(-100));

  React.useEffect(() => {
    const isOffline = !isConnected || !isInternetReachable;
    const shouldShow = showBanner && (showOfflineBanner || isOffline);
    
    if (shouldShow) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: position === 'top' ? -100 : 100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showOfflineBanner, showBanner, position, isConnected, isInternetReachable]);

  const getStatusColor = () => {
    if (!isConnected || !isInternetReachable) return '#dc2626';
    
    switch (connectionQuality) {
      case 'excellent':
        return '#16a34a';
      case 'good':
        return '#2563eb';
      case 'poor':
        return '#d97706';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = () => {
    if (!isConnected || !isInternetReachable) return 'wifi-off';
    
    switch (connectionType) {
      case 'WiFi':
        return 'wifi';
      case 'Mobile Data':
        return 'signal-cellular-4-bar';
      case 'Ethernet':
        return 'ethernet';
      default:
        return 'wifi';
    }
  };

  const getStatusText = () => {
    if (!isConnected || !isInternetReachable) {
      return 'No Internet Connection';
    }
    
    return `${connectionType} - ${connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)}`;
  };

  const handleRetry = () => {
    checkConnectivity();
    onRetry?.();
  };

  const handleDismiss = () => {
    setShowOfflineBanner(false);
  };

  // Show banner when offline OR when showOfflineBanner is true
  const shouldShow = showBanner && (showOfflineBanner || (!isConnected || !isInternetReachable));
  
  if (!shouldShow) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.topContainer : styles.bottomContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          backgroundColor: getStatusColor(),
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.statusInfo}>
          <Icon
            name={getStatusIcon()}
            size={20}
            color="#ffffff"
            style={styles.icon}
          />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Icon name="refresh" size={16} color="#ffffff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          
          {(isConnected && isInternetReachable) && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDismiss}
            >
              <Icon name="close" size={16} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  topContainer: {
    top: 0,
  },
  bottomContainer: {
    bottom: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 12 + (Dimensions.get('window').height > 800 ? 44 : 20), // Account for status bar
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  dismissButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 6,
    borderRadius: 12,
  },
});

export default ConnectivityStatus;
