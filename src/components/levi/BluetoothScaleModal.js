import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  FlatList,
  Dimensions
} from 'react-native';
import {
  Bluetooth,
  CloseCircle,
  Scan,
  Warning2,
  TickCircle,
  Setting2,
} from 'iconsax-react-nativejs';
import { fontScale, moderateScale } from '../common/responsive';
import BluetoothScaleService from '../services/BluetoothScaleService';
import BluetoothConnectionModal from './BluetoothConnectionModal';

// Responsive layout constants
const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 375;
const isTablet = width >= 768;

const BluetoothScaleModal = ({ 
  visible, 
  onClose, 
  onWeightReceived,
  onConnectionStatusChange,
  onConnectedDeviceChange,
  onListeningStatusChange,
  onLastWeightChange
}) => {
  const [devices, setDevices] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState(null); // Track which device is connecting
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [lastWeight, setLastWeight] = useState(null);
  const [showAllDevices, setShowAllDevices] = useState(false);
  const [virtualScaleEnabled, setVirtualScaleEnabled] = useState(false);
  
  // New unified modal state management
  const [connectionModal, setConnectionModal] = useState({
    visible: false,
    type: 'success', // 'success', 'error', 'warning'
    title: '',
    message: '',
    deviceName: '',
    suggestions: [],
    onRetry: null
  });

  // Ensure only one modal is visible at a time
  const showConnectionModal = (config) => {
    setConnectionModal({
      visible: true,
      type: config.type || 'success',
      title: config.title || '',
      message: config.message || '',
      deviceName: config.deviceName || '',
      suggestions: config.suggestions || [],
      onRetry: config.onRetry || null
    });
  };

  const hideConnectionModal = () => {
    setConnectionModal(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    if (visible) {
      setupBluetoothService();
      scanForDevices();
      
      // Check virtual scale status if in dev mode
      if (__DEV__) {
        const virtualControls = BluetoothScaleService.getVirtualScaleControls();
        if (virtualControls) {
          setVirtualScaleEnabled(virtualControls.isEnabled);
        }
      }
    }

    return () => {
      // Clean up when modal closes
      if (!visible) {
        try {
          if (BluetoothScaleService && typeof BluetoothScaleService.stopListening === 'function') {
            BluetoothScaleService.stopListening();
          }
        } catch (error) {
          console.error('Error calling stopListening in modal cleanup:', error);
        }
        
        // Clear connecting states on modal close
        setConnectingDeviceId(null);
        setLoading(false);
      }
    };
  }, [visible]);

  const setupBluetoothService = () => {
    try {
      if (!BluetoothScaleService || typeof BluetoothScaleService.setStatusCallback !== 'function') {
        console.error('Bluetooth service is not available in modal');
        return;
      }

      // Set up status callback
      BluetoothScaleService.setStatusCallback((status, message) => {
        console.log('📡 BluetoothScaleModal: Status callback received:', status, message);
        setConnectionStatus(status);
        
        if (onConnectionStatusChange) {
          onConnectionStatusChange(status);
        }
        
        if (status === 'connected') {
          // Clear connecting state when connection succeeds
          setConnectingDeviceId(null);
          setLoading(false);
          
          if (typeof BluetoothScaleService.getConnectionStatus === 'function') {
            const deviceStatus = BluetoothScaleService.getConnectionStatus();
            setConnectedDevice(deviceStatus.connectedDevice);
            
            if (onConnectedDeviceChange) {
              onConnectedDeviceChange(deviceStatus.connectedDevice);
            }
          }
          
        } else if (status === 'disconnected' || status === 'connection_failed') {
          // Clear connecting state on disconnect or failure
          setConnectingDeviceId(null);
          setLoading(false);
          setConnectedDevice(null);
          
          if (onConnectedDeviceChange) {
            onConnectedDeviceChange(null);
          }
          setIsListening(false);
          setLastWeight(null);
          
          if (onListeningStatusChange) {
            onListeningStatusChange(false);
          }
          if (onLastWeightChange) {
            onLastWeightChange(null);
          }
        } else if (status === 'error') {
          showConnectionModal({
            type: 'error',
            title: 'Bluetooth Error',
            message: message || 'An error occurred with the Bluetooth connection.',
            suggestions: [
              'Check if Bluetooth is enabled on your device',
              'Make sure the scale is turned on and nearby',
              'Try restarting the Bluetooth connection'
            ]
          });
        }
      });
      
    } catch (error) {
      console.error('Error setting up Bluetooth service in modal:', error);
      showConnectionModal({
        type: 'error',
        title: 'Setup Error',
        message: 'Failed to setup Bluetooth service.',
        suggestions: [
          'Restart the app and try again',
          'Check if Bluetooth permissions are granted',
          'Make sure Bluetooth is enabled on your device'
        ]
      });
    }
  };

  // Parse error and provide helpful suggestions
  const parseConnectionError = (error, deviceName = '') => {
    const errorMessage = error.message || error.toString();
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('socket might closed') || lowerError.includes('timeout') || lowerError.includes('read failed')) {
      return {
        title: 'Connection Timeout',
        message: 'Could not establish connection with the Bluetooth scale.',
        suggestions: [
          'Make sure the scale is turned ON',
          'Ensure the scale is in pairing/discoverable mode',
          'Move closer to the scale (within 3 feet)',
          'Check if the scale is already connected to another device',
          'Turn the scale OFF and ON again'
        ],
        deviceName
      };
    } else if (lowerError.includes('permission') || lowerError.includes('denied')) {
      return {
        title: 'Permission Required',
        message: 'Bluetooth permissions are required to connect to the scale.',
        suggestions: [
          'Grant Bluetooth permissions in app settings',
          'Allow location access (required for Bluetooth scanning)',
          'Restart the app after granting permissions'
        ],
        deviceName
      };
    } else if (lowerError.includes('not found') || lowerError.includes('unavailable')) {
      return {
        title: 'Device Not Found',
        message: 'The selected Bluetooth scale could not be found.',
        suggestions: [
          'Make sure the scale is turned ON',
          'Check if the scale is within range',
          'Try scanning for devices again',
          'Unpair and re-pair the device if necessary'
        ],
        deviceName
      };
    } else if (lowerError.includes('adapter') || lowerError.includes('bluetooth')) {
      return {
        title: 'Bluetooth Issue',
        message: 'There was a problem with the Bluetooth adapter.',
        suggestions: [
          'Turn Bluetooth OFF and ON again',
          'Restart the app',
          'Check if Bluetooth is enabled on your device',
          'Try restarting your device'
        ],
        deviceName
      };
    } else {
      return {
        title: 'Connection Failed',
        message: 'An unexpected error occurred while connecting to the scale.',
        suggestions: [
          'Make sure the scale is turned ON and nearby',
          'Try connecting again',
          'Restart the scale and try again',
          'Check if the scale works with other devices'
        ],
        deviceName
      };
    }
  };

  const showConnectionError = (error, deviceName = '') => {
    const errorInfo = parseConnectionError(error, deviceName);
    showConnectionModal({
      type: 'error',
      title: errorInfo.title,
      message: errorInfo.message,
      deviceName: errorInfo.deviceName,
      suggestions: errorInfo.suggestions,
      onRetry: () => {
        // Retry logic - reload devices and attempt auto-connect if it was an auto-connect failure
        setTimeout(() => {
          scanForDevices();
        }, 500);
      }
    });
  };

  const scanForDevices = async () => {
    setLoading(true);
    try {
      if (!BluetoothScaleService || typeof BluetoothScaleService.getAvailableScales !== 'function') {
        throw new Error('getAvailableScales method is not available on BluetoothScaleService');
      }
      
      const result = await BluetoothScaleService.getAvailableScales();
      
      if (Array.isArray(result)) {
        // console.log('Devices received (array format):', JSON.stringify(result, null, 2));
        try {
          setAllDevices(result);
          setDevices(result);
        } catch (error) {
          console.error('Error setting devices (array):', error);
        }
      } else {
        // console.log('Devices received (object format):', JSON.stringify(result, null, 2));
        const allDevs = result.allDevices || [];
        const scaleDevs = result.scaleDevices || [];
        
        // Debug log each device to identify problematic ones
        allDevs.forEach((device, index) => {
          if (!device || typeof device.name !== 'string' || typeof device.address !== 'string') {
            console.warn(`Problematic device at index ${index}:`, JSON.stringify(device));
          }
        });
        
        try {
          setAllDevices(allDevs);
          setDevices(scaleDevs);
        } catch (error) {
          console.error('Error setting devices (object):', error);
        }
      }
      
    } catch (error) {
      console.error('Error scanning for devices:', error);
      showConnectionModal({
        type: 'error',
        title: 'Scan Failed',
        message: 'Failed to scan for Bluetooth devices.',
        suggestions: [
          'Make sure Bluetooth is enabled',
          'Grant location permissions if requested',
          'Turn on nearby Bluetooth devices',
          'Try scanning again'
        ],
        onRetry: () => {
          setTimeout(() => {
            scanForDevices();
          }, 1000);
        }
      });
      setDevices([]);
      setAllDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const connectToDevice = async (device) => {
    setLoading(true);
    setConnectingDeviceId(device.id); // Track which device is connecting
    
    try {
      if (!BluetoothScaleService || typeof BluetoothScaleService.connectToScale !== 'function') {
        throw new Error('connectToScale method is not available on BluetoothScaleService');
      }
      
      // Always enable persistent connection by default
      BluetoothScaleService.enablePersistentConnection(true); // Enable with auto-reconnect
      console.log('🔗 Enabled persistent connection for device:', device.name || device.id);
      
      const success = await BluetoothScaleService.connectToScale(device.id);
      
      if (success) {
        // Show beautiful success modal
        setTimeout(() => {
          showConnectionModal({
            type: 'success',
            title: 'Connected Successfully!',
            message: `Your Bluetooth scale "${device.name || device.id}" is now connected with persistent connection enabled. The connection will automatically reconnect if lost.`,
            deviceName: device.name || device.id,
            onRetry: null,
            autoCloseDelay: 2500 // Auto-close success modal after 2.5 seconds
          });
          
          // Auto-close main modal after success modal shows
          setTimeout(() => {
            if (onClose) {
              console.log('🔄 Auto-closing Bluetooth modal after successful connection');
              onClose();
            }
          }, 3000); // Close main modal 3 seconds after success modal appears
        }, 300); // Short delay to ensure state updates
        
      } else {
        throw new Error('Connection failed');
      }
      
    } catch (error) {
      console.error('Connection error:', error);
      showConnectionError(error, device.name || device.id);
    } finally {
      setLoading(false);
      setConnectingDeviceId(null); // Clear connecting device
    }
  };

  const disconnectDevice = async () => {
    try {
      if (!BluetoothScaleService || typeof BluetoothScaleService.disconnect !== 'function') {
        throw new Error('disconnect method is not available on BluetoothScaleService');
      }
      
      await BluetoothScaleService.disconnect();
      
      showConnectionModal({
        type: 'success',
        title: 'Disconnected',
        message: 'Scale has been disconnected successfully.',
        deviceName: '',
        autoCloseDelay: 2000
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      showConnectionModal({
        type: 'error',
        title: 'Disconnect Failed',
        message: 'There was an issue disconnecting from the scale.',
        deviceName: '',
        suggestions: ['Try turning the scale off manually', 'Restart the app if issues persist']
      });
    }
  };

  const startListening = () => {
    try {
      if (!BluetoothScaleService || typeof BluetoothScaleService.startListening !== 'function') {
        Alert.alert('Error', 'Bluetooth service not available');
        return;
      }

      BluetoothScaleService.startListening((weight) => {
        setLastWeight(weight);
        
        if (onLastWeightChange) {
          onLastWeightChange(weight);
        }
        
        if (onWeightReceived) {
          onWeightReceived(weight);
        }
      });
      setIsListening(true);
      
      if (onListeningStatusChange) {
        onListeningStatusChange(true);
      }
    } catch (error) {
      console.error('Error starting listening from modal:', error);
      showConnectionModal({
        type: 'error',
        title: 'Listening Failed',
        message: 'Could not start listening for weight data.',
        suggestions: [
          'Make sure the scale is connected',
          'Check if the scale is sending data',
          'Try disconnecting and reconnecting'
        ]
      });
    }
  };

  const stopListening = () => {
    try {
      if (BluetoothScaleService && typeof BluetoothScaleService.stopListening === 'function') {
        BluetoothScaleService.stopListening();
        setIsListening(false);
        
        if (onListeningStatusChange) {
          onListeningStatusChange(false);
        }
        
      }
    } catch (error) {
      console.error('Error stopping listening in modal:', error);
    }
  };

  const requestWeight = async () => {
    try {
      if (!BluetoothScaleService || typeof BluetoothScaleService.requestWeight !== 'function') {
        throw new Error('requestWeight method is not available on BluetoothScaleService');
      }
      
      await BluetoothScaleService.requestWeight();
    } catch (error) {
      console.error('Error requesting weight:', error);
      showConnectionModal({
        type: 'error',
        title: 'Request Failed',
        message: 'Failed to request weight from the scale.',
        suggestions: [
          'Check if the scale is still connected',
          'Make sure the scale is powered on',
          'Try requesting weight again'
        ]
      });
    }
  };

  const tareScale = async () => {
    try {
      if (!BluetoothScaleService || typeof BluetoothScaleService.tareScale !== 'function') {
        throw new Error('tareScale method is not available on BluetoothScaleService');
      }
      
      await BluetoothScaleService.tareScale();
      showConnectionModal({
        type: 'success',
        title: 'Scale Tared',
        message: 'The scale has been successfully tared (zeroed).',
        autoCloseDelay: 2000
      });
    } catch (error) {
      console.error('Error taring scale:', error);
      showConnectionModal({
        type: 'error',
        title: 'Tare Failed',
        message: 'Failed to tare the scale.',
        suggestions: [
          'Make sure the scale is connected',
          'Try taring manually on the scale',
          'Check if the scale supports remote taring'
        ]
      });
    }
  };

  const autoConnect = async () => {
    setLoading(true);
    try {
      if (!BluetoothScaleService || typeof BluetoothScaleService.quickConnect !== 'function') {
        // Fallback to old method if quickConnect is not available
        if (typeof BluetoothScaleService.autoConnectToScale === 'function') {
          const device = await BluetoothScaleService.autoConnectToScale();
          
          showConnectionModal({
            type: 'success',
            title: 'Auto-Connected!',
            message: 'Successfully found and connected to your Bluetooth scale.',
            deviceName: device.name || device.address,
          });
        } else {
          throw new Error('Auto-connect methods are not available');
        }
      } else {
        // Use the new quickConnect method with better user feedback
        const result = await BluetoothScaleService.quickConnect();
        
        if (result.success) {
          showConnectionModal({
            type: 'success',
            title: result.reconnected ? 'Reconnected!' : 'Auto-Connected!',
            message: result.message,
            deviceName: result.device?.name || result.device?.address,
            autoCloseDelay: 2500 // Auto-close success modal after 2.5 seconds
          });
          
          // Auto-close main modal after success modal shows
          setTimeout(() => {
            if (onClose) {
              console.log('🔄 Auto-closing Bluetooth modal after auto-connect success');
              onClose();
            }
          }, 3000);
        } else {
          // Handle failure with suggestions
          showConnectionModal({
            type: 'error',
            title: 'Auto-Connect Failed',
            message: result.message || 'Could not automatically connect to a scale.',
            suggestions: result.suggestions || [
              'Make sure your scale is turned ON and nearby',
              'Check if the scale is already paired with your device',
              'Try manually selecting a device from the list below'
            ],
            onRetry: () => {
              setTimeout(() => {
                autoConnect();
              }, 1000);
            }
          });
          return; // Don't close modal on failure
        }
      }
      
    } catch (error) {
      console.error('Auto-connect error:', error);
      showConnectionModal({
        type: 'error',
        title: 'Auto-Connect Failed',
        message: error.message || 'Could not automatically connect to a scale.',
        suggestions: [
          'Make sure your scale is turned ON and nearby',
          'Check if the scale is already paired with your device',
          'Try manually selecting a device from the list below'
        ],
        onRetry: () => {
          setTimeout(() => {
            autoConnect();
          }, 1000);
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleVirtualScale = async () => {
    if (!__DEV__) return;
    
    try {
      const newState = !virtualScaleEnabled;
      const success = BluetoothScaleService.setVirtualScaleMode(newState);
      
      if (success) {
        setVirtualScaleEnabled(newState);
        
        if (newState) {
          showConnectionModal({
            type: 'success',
            title: '🧪 Virtual Scale Enabled',
            message: 'Virtual Bluetooth scale is now active for debugging. Weight data will be simulated automatically.',
          });
          
          // Auto-close main modal after enabling virtual scale
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          showConnectionModal({
            type: 'info',
            title: '🛑 Virtual Scale Disabled',
            message: 'Virtual Bluetooth scale has been disabled. You can now connect to real hardware.',
          });
        }
      }
    } catch (error) {
      console.error('Error toggling virtual scale:', error);
      showConnectionModal({
        type: 'error',
        title: 'Virtual Scale Error',
        message: 'Could not toggle virtual scale mode.',
      });
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#22C55E';
      case 'listening':
        return '#3B82F6';
      case 'disconnected':
        return '#6B7280';
      case 'error':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Bluetooth size={20} color={getStatusColor()} variant="Bold" />;
      case 'listening':
        return <Scan size={20} color={getStatusColor()} variant="Bold" />;
      case 'disconnected':
        return <CloseCircle size={20} color={getStatusColor()} variant="Bold" />;
      case 'error':
        return <Warning2 size={20} color={getStatusColor()} variant="Bold" />;
      default:
        return <Bluetooth size={20} color={getStatusColor()} variant="Bold" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return connectedDevice ? `Connected to ${connectedDevice.name || 'Scale'}` : 'Connected';
      case 'listening':
        return 'Listening for weight...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
      case 'scanning':
        return 'Scanning for devices...';
      case 'connecting':
        return connectingDeviceId ? 'Connecting...' : 'Connecting...';
      default:
        return 'Checking Bluetooth...';
    }
  };

  const renderDeviceItem = ({ item }) => {
    // Ensure item has all required properties to prevent rendering errors
    if (!item) {
      console.warn('Received null/undefined item in renderDeviceItem');
      return null;
    }
    
    try {
      const deviceId = String(item?.id || item?.address || 'unknown');
      const deviceName = String(item?.name || 'Unknown Device');
      const deviceAddress = String(item?.address || 'No Address');
      const deviceRSSI = item?.rssi;
      const isPaired = Boolean(item?.isPaired);
      
      // Ensure no undefined/null values in conditional rendering
      const isConnected = connectedDevice === deviceId;
      const isConnecting = connectingDeviceId === deviceId;
      const isDisabled = loading || isConnected || connectingDeviceId !== null; // Disable all when any device is connecting
      const showRSSI = deviceRSSI && typeof deviceRSSI === 'number' && deviceRSSI !== 0;
      
      return (
        <TouchableOpacity
          style={[
            styles.deviceItem,
            isConnected && styles.deviceItemConnected,
            isDisabled && styles.deviceItemDisabled,
          ]}
          onPress={() => connectToDevice(item)}
          disabled={isDisabled}>
          <View style={styles.deviceInfo}>
            <Bluetooth size={24} color="#3B82F6" variant="Bold" />
            <View style={styles.deviceDetails}>
              <View style={styles.deviceNameRow}>
                <Text style={styles.deviceName} numberOfLines={1} ellipsizeMode="tail">
                  {deviceName}
                </Text>
                {isPaired ? <Text style={styles.pairedBadge}>Paired</Text> : null}
              </View>
              <View style={styles.deviceMetaRow}>
                <Text style={styles.deviceAddress}>{deviceAddress}</Text>
                {showRSSI ? (
                  <Text style={styles.signalStrength}>
                    {deviceRSSI > -50 ? 'Strong' : deviceRSSI > -70 ? 'Good' : 'Weak'} ({deviceRSSI}dBm)
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
          {isConnected ? (
            <TickCircle size={24} color="#22C55E" variant="Bold" />
          ) : (
            <TouchableOpacity
              style={[
                styles.connectButton,
                connectingDeviceId === deviceId && styles.connectButtonConnecting
              ]}
              onPress={() => connectToDevice(item)}
              disabled={loading || connectingDeviceId === deviceId}>
              {connectingDeviceId === deviceId ? (
                <View style={styles.connectButtonLoading}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.connectButtonText}>Connecting...</Text>
                </View>
              ) : (
                <Text style={styles.connectButtonText}>Connect</Text>
              )}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    } catch (error) {
      console.error('Error rendering device item:', error, 'Item:', JSON.stringify(item));
      return null;
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Bluetooth Scale</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <CloseCircle size={24} color="#64748B" variant="Bold" />
            </TouchableOpacity>
          </View>

          {/* Fixed Content */}
          <View style={styles.fixedContent}>
            {/* Status Section */}
            <View style={styles.statusSection}>
              <View style={styles.statusHeader}>
                {(connectionStatus === 'scanning' || connectionStatus === 'connecting' || connectionStatus === 'disconnected') && connectionStatus !== 'error' ? (
                  <ActivityIndicator size="small" color={getStatusColor()} />
                ) : (
                  getStatusIcon()
                )}
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {getStatusText()}
                </Text>
              </View>
              
              {lastWeight !== null && (
                <View style={styles.weightDisplay}>
                  <Text style={styles.weightValue}>{lastWeight.toFixed(2)} kg</Text>
                  <Text style={styles.weightLabel}>Last Reading</Text>
                </View>
              )}
            </View>

            {/* Control buttons now live in HarvestScreen */}

            {/* Auto-Connect Button */}
            {connectionStatus === 'disconnected' && (
              <View style={styles.autoConnectSection}>
                <TouchableOpacity
                  style={[styles.controlButton, styles.primaryButton, { width: '100%' }]}
                  onPress={autoConnect}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Bluetooth size={16} color="#FFFFFF" variant="Bold" />
                      <Text style={styles.controlButtonText}>Auto-Connect to Scale</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Virtual Scale Button - Only show in development */}
            {__DEV__ && connectionStatus === 'disconnected' && (
              <View style={styles.autoConnectSection}>
                <TouchableOpacity
                  style={[styles.controlButton, virtualScaleEnabled ? styles.warningButton : styles.secondaryButton, { width: '100%' }]}
                  onPress={toggleVirtualScale}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Setting2 size={16} color="#FFFFFF" variant="Bold" />
                      <Text style={styles.controlButtonText}>
                        {virtualScaleEnabled ? '🛑 Disable Virtual Scale' : '🧪 Enable Virtual Scale (Debug)'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Device List Header */}
            <View style={styles.deviceSectionHeader}>
              <Text style={styles.sectionTitle}>
                {showAllDevices ? 'All Bluetooth Devices' : 'Nearby Scale Devices'}
              </Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  onPress={() => setShowAllDevices(!showAllDevices)}
                  disabled={loading || connectionStatus === 'scanning'}
                  style={[
                    styles.toggleButton, 
                    showAllDevices && styles.toggleButtonActive,
                    (loading || connectionStatus === 'scanning') && styles.toggleButtonDisabled
                  ]}>
                  <Text style={[
                    styles.toggleButtonText, 
                    showAllDevices && styles.toggleButtonTextActive,
                    (loading || connectionStatus === 'scanning') && styles.toggleButtonTextDisabled
                  ]}>
                    {showAllDevices ? 'Scales Only' : 'Show All'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={scanForDevices}
                  disabled={loading || connectionStatus === 'scanning'}
                  style={[
                    styles.refreshButton,
                    (loading || connectionStatus === 'scanning') && styles.refreshButtonDisabled
                  ]}>
                  {(loading || connectionStatus === 'scanning') ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <Text style={styles.refreshButtonText}>Scan Nearby</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Device List - Now directly in modal without ScrollView */}
          <View style={styles.deviceListSection}>
            {(loading || connectionStatus === 'scanning') ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Searching for devices...</Text>
              </View>
            ) : (devices.length === 0 && !showAllDevices) ? (
              <View style={styles.emptyContainer}>
                <Warning2 size={48} color="#9CA3AF" variant="Outline" />
                <Text style={styles.emptyText}>No scale devices found</Text>
                <Text style={styles.emptySubtext}>
                  Make sure your Bluetooth scale is nearby and powered on, or try "Show All" to see all devices
                </Text>
              </View>
            ) : (
              <FlatList
                data={(showAllDevices ? allDevices : devices).filter(item => item && (item.id || item.address))}
                renderItem={renderDeviceItem}
                keyExtractor={(item) => item?.id || item?.address || Math.random().toString()}
                style={styles.deviceListContainer}
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ paddingBottom: moderateScale(20) }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>

    {/* Unified Connection/Error/Success Modal */}
    <BluetoothConnectionModal
      visible={connectionModal.visible}
      type={connectionModal.type}
      title={connectionModal.title}
      message={connectionModal.message}
      deviceName={connectionModal.deviceName}
      suggestions={connectionModal.suggestions}
      onRetry={connectionModal.onRetry}
      onClose={hideConnectionModal}
      autoCloseDelay={connectionModal.type === 'success' ? 3000 : 0}
    />
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: moderateScale(isSmallDevice ? 12 : isTablet ? 32 : 20),
  },
  modalContent: {
    width: '100%',
    maxWidth: isTablet ? moderateScale(500) : isSmallDevice ? moderateScale(340) : moderateScale(400),
    height: isSmallDevice ? '90%' : '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(isSmallDevice ? 16 : 24),
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  scrollContent: {
    flex: 1,
  },
  fixedContent: {
    paddingHorizontal: moderateScale(isSmallDevice ? 12 : 16),
    paddingTop: moderateScale(8),
  },
  deviceListSection: {
    flex: 1,
    paddingHorizontal: moderateScale(isSmallDevice ? 12 : 16),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(isSmallDevice ? 16 : 20),
    paddingBottom: moderateScale(isSmallDevice ? 10 : 12),
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: fontScale(isSmallDevice ? 18 : 22),
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    margin: moderateScale(16),
    marginTop: moderateScale(12),
    marginBottom: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  statusText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    marginLeft: moderateScale(12),
    letterSpacing: -0.3,
  },
  weightDisplay: {
    alignItems: 'center',
    marginTop: moderateScale(16),
    padding: moderateScale(20),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    borderWidth: 2,
    borderColor: '#3B82F6',
    elevation: 3,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  weightValue: {
    fontSize: fontScale(32),
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1,
  },
  weightLabel: {
    fontSize: fontScale(13),
    color: '#64748B',
    marginTop: moderateScale(6),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  controlSection: {
    marginHorizontal: isSmallDevice ? moderateScale(12) : moderateScale(20),
    marginBottom: isSmallDevice ? moderateScale(12) : moderateScale(20),
  },
  autoConnectSection: {
    marginHorizontal: isSmallDevice ? moderateScale(12) : moderateScale(20),
    marginBottom: isSmallDevice ? moderateScale(12) : moderateScale(20),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: moderateScale(12),
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isSmallDevice ? moderateScale(10) : moderateScale(14),
    paddingHorizontal: isSmallDevice ? moderateScale(12) : moderateScale(18),
    borderRadius: moderateScale(12),
    marginHorizontal: moderateScale(6),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderWidth: 0,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
    borderWidth: 0,
  },
  warningButton: {
    backgroundColor: '#F59E0B',
    borderWidth: 0,
  },
  controlButtonText: {
    fontSize: isSmallDevice ? fontScale(12) : fontScale(14),
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: moderateScale(6),
    letterSpacing: 0.2,
  },
  deviceSection: {
    flex: 1,
  },
  deviceSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isSmallDevice ? moderateScale(12) : moderateScale(16),
    paddingBottom: moderateScale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButton: {
    paddingHorizontal: isSmallDevice ? moderateScale(8) : moderateScale(12),
    paddingVertical: isSmallDevice ? moderateScale(6) : moderateScale(8),
    backgroundColor: '#F1F5F9',
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: moderateScale(8),
  },
  toggleButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  toggleButtonText: {
    fontSize: isSmallDevice ? fontScale(10) : fontScale(12),
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  toggleButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  toggleButtonTextDisabled: {
    color: '#94A3B8',
  },
  sectionTitle: {
    fontSize: fontScale(14),
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  refreshButton: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(6),
    backgroundColor: '#EBF2FF',
    borderRadius: moderateScale(20),
    borderWidth: 1,
    borderColor: '#A9C5FF',
  },
  refreshButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  refreshButtonText: {
    fontSize: fontScale(14),
    color: '#3B82F6',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  deviceListContainer: {
    paddingHorizontal: moderateScale(isSmallDevice ? 2 : 4),
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: moderateScale(isSmallDevice ? 12 : 14),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(isSmallDevice ? 12 : 16),
    marginBottom: moderateScale(isSmallDevice ? 8 : 12),
    marginHorizontal: moderateScale(isSmallDevice ? 2 : 4),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    minHeight: moderateScale(isSmallDevice ? 60 : 70),
  },
  deviceItemConnected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    elevation: 4,
    shadowColor: '#10B981',
    shadowOpacity: 0.15,
  },
  deviceItemDisabled: {
    opacity: 0.6,
    backgroundColor: '#F8FAFC',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: moderateScale(8),
  },
  deviceDetails: {
    marginLeft: moderateScale(12),
    flex: 1,
  },
  deviceName: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  deviceAddress: {
    fontSize: isSmallDevice ? fontScale(11) : fontScale(13),
    color: '#64748B',
    marginTop: moderateScale(4),
    fontWeight: '500',
  },
  connectButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: isSmallDevice ? moderateScale(12) : moderateScale(20),
    paddingVertical: isSmallDevice ? moderateScale(8) : moderateScale(12),
    borderRadius: moderateScale(30),
    elevation: 2,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButtonConnecting: {
    backgroundColor: '#6B7280',
    shadowColor: '#6B7280',
  },
  connectButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  connectButtonText: {
    fontSize: isSmallDevice ? fontScale(12) : fontScale(14),
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: isSmallDevice ? moderateScale(32) : moderateScale(48),
    backgroundColor: '#F8FAFC',
    borderRadius: moderateScale(16),
    marginHorizontal: isSmallDevice ? moderateScale(4) : moderateScale(8),
  },
  loadingText: {
    fontSize: isSmallDevice ? fontScale(14) : fontScale(16),
    color: '#475569',
    marginTop: moderateScale(16),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: isSmallDevice ? moderateScale(32) : moderateScale(48),
    backgroundColor: '#F8FAFC',
    borderRadius: moderateScale(16),
    marginHorizontal: isSmallDevice ? moderateScale(4) : moderateScale(8),
    marginBottom: isSmallDevice ? moderateScale(20) : moderateScale(30),
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: isSmallDevice ? fontScale(16) : fontScale(14),
    fontWeight: '700',
    color: '#475569',
    marginTop: moderateScale(16),
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: isSmallDevice ? fontScale(12) : fontScale(14),
    color: '#64748B',
    marginTop: moderateScale(8),
    textAlign: 'center',
    lineHeight: isSmallDevice ? fontScale(14) : fontScale(18),
    paddingHorizontal: isSmallDevice ? moderateScale(12) : moderateScale(16),
  },
  // New styles for device pairing status and signal strength
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pairedBadge: {
    fontSize: fontScale(10),
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: moderateScale(10),
    fontWeight: '600',
    overflow: 'hidden',
  },
  deviceMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: moderateScale(4),
  },
  signalStrength: {
    fontSize: fontScale(10),
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default BluetoothScaleModal;
