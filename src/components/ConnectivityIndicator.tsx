import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useConnectivity } from '../context/ConnectivityContext';

interface ConnectivityIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  onPress?: () => void;
  style?: any;
}

const ConnectivityIndicator: React.FC<ConnectivityIndicatorProps> = ({
  size = 'medium',
  showText = false,
  onPress,
  style,
}) => {
  const {
    isConnected,
    connectionType,
    isInternetReachable,
    connectionQuality,
  } = useConnectivity();

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

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          icon: 16,
          text: styles.smallText,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          icon: 24,
          text: styles.largeText,
        };
      default:
        return {
          container: styles.mediumContainer,
          icon: 20,
          text: styles.mediumText,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();

  const indicator = (
    <View style={[sizeStyles.container, style]}>
      <Icon
        name={statusIcon}
        size={sizeStyles.icon}
        color={statusColor}
      />
      {showText && (
        <Text style={[sizeStyles.text, { color: statusColor }]}>
          {!isConnected || !isInternetReachable
            ? 'Offline'
            : connectionType}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {indicator}
      </TouchableOpacity>
    );
  }

  return indicator;
};

const styles = StyleSheet.create({
  smallContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  mediumContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  largeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  smallText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  mediumText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  largeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ConnectivityIndicator;
