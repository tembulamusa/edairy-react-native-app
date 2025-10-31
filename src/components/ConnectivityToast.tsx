import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useConnectivity } from '../context/ConnectivityContext';

const { width } = Dimensions.get('window');

const ConnectivityToast: React.FC = () => {
  const { isConnected, isInternetReachable, connectionType } = useConnectivity();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'offline' | 'online'>('offline');
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    const isOnline = isConnected && isInternetReachable;
    
    if (!isOnline) {
      // Going offline
      setToastMessage('No internet connection');
      setToastType('offline');
      setShowToast(true);
    } else if (showToast && toastType === 'offline') {
      // Coming back online
      setToastMessage(`You're back online! (${connectionType})`);
      setToastType('online');
      setShowToast(true);
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
    }
  }, [isConnected, isInternetReachable, connectionType]);

  useEffect(() => {
    if (showToast) {
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
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showToast]);

  const getToastStyle = () => {
    return {
      backgroundColor: toastType === 'online' ? '#16a34a' : '#dc2626',
    };
  };

  const getIcon = () => {
    return toastType === 'online' ? 'wifi' : 'wifi-off';
  };

  if (!showToast) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        getToastStyle(),
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.toastContent}>
        <Icon name={getIcon()} size={20} color="#ffffff" />
        <Text style={styles.toastText}>{toastMessage}</Text>
        {toastType === 'online' && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => setShowToast(false)}
          >
            <Icon name="close" size={16} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60, // Below status bar
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  dismissButton: {
    padding: 4,
  },
});

export default ConnectivityToast;
