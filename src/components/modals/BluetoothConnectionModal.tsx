import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {
  TickCircle,
  CloseCircle,
  Warning2,
  Bluetooth,
} from 'iconsax-react-nativejs';
import { BluetoothDevice } from 'react-native-bluetooth-classic';

interface BluetoothConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  type?: 'success' | 'error' | 'warning' | 'device-list';
  title?: string;
  message?: string;
  deviceName?: string;
  autoCloseDelay?: number;
  showCloseButton?: boolean;
  onRetry?: (() => void) | null;
  suggestions?: string[];
  scanForDevices: () => Promise<void>;
  connectToDevice: (id: string) => Promise<BluetoothDevice | null>;
  isScanning: boolean;
  isConnecting: boolean;
  devices: BluetoothDevice[];
  deviceType: 'scale' | 'printer';
  connectedDevice: BluetoothDevice | null;
  disconnect?: (id?: string) => Promise<void> | void;
}

const BluetoothConnectionModal: React.FC<BluetoothConnectionModalProps> = ({
  visible,
  onClose,
  type = 'device-list',
  title = 'Select Bluetooth Device',
  message,
  deviceName,
  autoCloseDelay = 3000,
  showCloseButton = true,
  onRetry = null,
  suggestions = [],
  scanForDevices,
  connectToDevice,
  disconnect,
  isScanning,
  isConnecting,
  devices,
  deviceType,
  connectedDevice,
}) => {
  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [scaleAnim] = React.useState(new Animated.Value(0.3));
  const [connectingId, setConnectingId] = React.useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = React.useState<string | null>(null);
  const [modalStatus, setModalStatus] = React.useState<'success' | 'error' | null>(null);
  const [modalMessage, setModalMessage] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
      ]).start();

      if (type === 'success' && autoCloseDelay > 0) {
        const timer = setTimeout(() => handleClose(), autoCloseDelay);
        return () => clearTimeout(timer);
      }
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.3);
    }
  }, [visible, type, autoCloseDelay]);

  React.useEffect(() => {
    if (visible && type === 'device-list') {
      scanForDevices();
    }
  }, [visible, type]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.3, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      onClose && onClose();
    });
  };

  const handleConnect = async (device: BluetoothDevice) => {
    const id = device.address || device.id;
    console.log('Attempt connect', id);
    setConnectingId(id);
    setModalStatus(null);
    setModalMessage('');
    try {
      const result = await connectToDevice(id);
      if (result) {
        setModalStatus('success');
        setModalMessage(`Connected to ${device.name || 'device'}`);
        setTimeout(() => handleClose(), 1500);
      } else {
        setModalStatus('error');
        setModalMessage('Connection failed. Ensure device is powered and nearby.');
      }
    } catch (err: any) {
      console.error('Connect error', err);
      setModalStatus('error');
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('timeout')) {
        setModalMessage('Connection timed out. Try again.');
      } else if (msg.toLowerCase().includes('permission')) {
        setModalMessage('Bluetooth permission denied. Grant permissions and try again.');
      } else {
        setModalMessage(`Connection failed: ${msg}`);
      }
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (device: BluetoothDevice) => {
    if (!disconnect) {
      console.warn('Disconnect function not provided');
      setModalStatus('error');
      setModalMessage('Disconnect operation not available');
      return;
    }
    const id = device.address || device.id;
    console.log('Attempt disconnect', id);
    setDisconnectingId(id);
    setModalStatus(null);
    setModalMessage('');
    try {
      // call with id if implementation supports it
      await disconnect(id);
      setModalStatus('success');
      setModalMessage(`Disconnected from ${device.name || 'device'}`);
    } catch (err: any) {
      console.error('Disconnect error', err);
      setModalStatus('error');
      setModalMessage(err?.message || 'Failed to disconnect');
    } finally {
      setDisconnectingId(null);
    }
  };

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: <TickCircle size={48} color="#22C55E" variant="Bold" />,
          backgroundColor: '#F0FDF4',
          borderColor: '#22C55E',
          titleColor: '#16A34A',
        };
      case 'error':
        return {
          icon: <CloseCircle size={48} color="#EF4444" variant="Bold" />,
          backgroundColor: '#FEF2F2',
          borderColor: '#EF4444',
          titleColor: '#DC2626',
        };
      case 'warning':
        return {
          icon: <Warning2 size={48} color="#F59E0B" variant="Bold" />,
          backgroundColor: '#FFFBEB',
          borderColor: '#F59E0B',
          titleColor: '#D97706',
        };
      case 'device-list':
      default:
        return {
          icon: <Bluetooth size={48} color="#3B82F6" variant="Bold" />,
          backgroundColor: '#EBF2FF',
          borderColor: '#3B82F6',
          titleColor: '#1D4ED8',
        };
    }
  };

  const config = getTypeConfig();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.modalContent, { backgroundColor: config.backgroundColor, borderColor: config.borderColor, transform: [{ scale: scaleAnim }] }]}>
          {showCloseButton && (
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <CloseCircle size={20} color="#64748B" variant="Bold" />
            </TouchableOpacity>
          )}

          <View style={styles.iconContainer}>{config.icon}</View>

          <Text style={[styles.title, { color: config.titleColor }]}>{title}</Text>

          {deviceName && (
            <View style={styles.deviceContainer}>
              <Bluetooth size={16} color="#64748B" variant="Bold" />
              <Text style={styles.deviceName}>{deviceName}</Text>
            </View>
          )}

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {type === 'device-list' && (
            <View style={styles.deviceListContainer}>
              {isScanning ? (
                <View style={styles.scanningContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.scanningText}>Scanning for {deviceType} devices...</Text>
                </View>
              ) : devices?.length === 0 ? (
                <Text style={styles.noDevicesText}>No {deviceType} devices found</Text>
              ) : (
                <FlatList
                  data={devices}
                  keyExtractor={(item) => item.address || item.id}
                  style={styles.devicesList}
                  renderItem={({ item }) => {
                    const id = item.address || item.id;
                    const isConnecting = connectingId === id || isConnecting;
                    const isDisconnecting = disconnectingId === id;
                    const isBusy = isConnecting || isDisconnecting;
                    const isConnected = connectedDevice && (connectedDevice.address === item.address || connectedDevice.id === item.id);

                    return (
                      <View style={styles.deviceItem}>
                        <View style={styles.deviceInfo}>
                          <Text style={styles.deviceName}>{item.name || 'Unnamed Device'}</Text>
                          <Text style={styles.deviceAddress}>{item.address || item.id}</Text>
                        </View>

                        <TouchableOpacity
                          disabled={isBusy}
                          style={[
                            styles.connectButton,
                            isConnected && styles.connectedButton,
                            isBusy && styles.disabledButton,
                          ]}
                          onPress={() => {
                            if (isConnected) {
                              handleDisconnect(item);
                            } else {
                              handleConnect(item);
                            }
                          }}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.connectButtonText}>
                              {isConnected ? 'Disconnect' : 'Connect'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              )}

              {modalStatus === 'error' && (
                <View style={styles.statusContainer}>
                  <Text style={styles.errorText}>{modalMessage}</Text>
                </View>
              )}
              {modalStatus === 'success' && (
                <View style={styles.statusContainer}>
                  <Text style={styles.successText}>{modalMessage}</Text>
                </View>
              )}

              <TouchableOpacity style={[styles.scanButton, isScanning && styles.disabledButton]} onPress={() => scanForDevices()} disabled={isScanning}>
                <Text style={styles.scanButtonText}>{isScanning ? 'Scanning...' : 'Scan Again'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 720,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 10,
  },
  iconContainer: { marginTop: 8, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  deviceContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  deviceName: { marginLeft: 8, fontSize: 14, color: '#374151', fontWeight: '600' },
  message: { textAlign: 'center', color: '#374151', marginBottom: 10 },
  deviceListContainer: { width: '100%', marginTop: 6, alignItems: 'center' },
  scanningContainer: { alignItems: 'center', justifyContent: 'center', padding: 12 },
  scanningText: { marginTop: 8, color: '#3B82F6' },
  noDevicesText: { color: '#64748B', padding: 12 },
  devicesList: { width: '100%', maxHeight: 260 },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#e6e9ef',
  },
  deviceInfo: { flex: 1, paddingRight: 8 },
  deviceAddress: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  connectButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedButton: { backgroundColor: '#ef4444' },
  disabledButton: { opacity: 0.6 },
  connectButtonText: { color: '#fff', fontWeight: '600' },
  statusContainer: { marginTop: 8, paddingHorizontal: 8 },
  errorText: { color: '#b91c1c', fontWeight: '600' },
  successText: { color: '#15803d', fontWeight: '600' },
  scanButton: {
    marginTop: 12,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  scanButtonText: { color: '#1e3a8a', fontWeight: '700' },
});

export default BluetoothConnectionModal;