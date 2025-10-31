import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ScrollView, Alert, Platform, PermissionsAndroid, NativeEventEmitter, NativeModules } from 'react-native';
import BleManager from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

type DeviceItem = { id: string; name?: string; rssi?: number; advertising?: any };

const BLEManagerScaleScreen = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [status, setStatus] = useState<string>('idle');
    const [statusMsg, setStatusMsg] = useState<string>('');
    const [devices, setDevices] = useState<DeviceItem[]>([]);
    const [connectedPeripheral, setConnectedPeripheral] = useState<string | null>(null);
    const [connectedName, setConnectedName] = useState<string>('');
    const [lastReading, setLastReading] = useState<string | null>(null);
    const [services, setServices] = useState<any[]>([]);
    const [characteristics, setCharacteristics] = useState<any[]>([]);
    const mountedRef = useRef(true);
    const [logs, setLogs] = useState<string[]>([]);
    const subscriptionRef = useRef<any>(null);
    const discoverSubscriptionRef = useRef<any>(null);
    const updateSubscriptionRef = useRef<any>(null);

    const log = (message: string, obj?: any) => {
        const line = obj !== undefined ? `${message} ${typeof obj === 'string' ? obj : JSON.stringify(obj)}` : message;
        console.log('[BLE]', line);
        setLogs(prev => [line, ...prev].slice(0, 100));
    };

    async function requestPermissions() {
        if (Platform.OS !== 'android') return true;
        try {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);
            const ok = Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
            if (!ok) Alert.alert('Permissions required', 'Please grant Bluetooth permissions.');
            return ok;
        } catch (e) {
            log('Permission error:', String((e as any)?.message || e));
            return false;
        }
    }

    useEffect(() => {
        mountedRef.current = true;
        initBLE();
        return () => {
            mountedRef.current = false;
            try {
                if (discoverSubscriptionRef.current) {
                    discoverSubscriptionRef.current.remove();
                }
                if (updateSubscriptionRef.current) {
                    updateSubscriptionRef.current.remove();
                }
                if (connectedPeripheral) {
                    BleManager.disconnect(connectedPeripheral).catch(() => {});
                }
            } catch {}
        };
    }, []);

    const initBLE = async () => {
        try {
            const perms = await requestPermissions();
            if (!perms) {
                log('Permissions not granted');
                return;
            }
            await BleManager.start({ showAlert: false });
            log('BLE Manager initialized');
            setStatus('ready');
            setStatusMsg('BLE ready');
        } catch (e: any) {
            log('Init error:', e?.message || e);
            setStatus('error');
            setStatusMsg(String(e?.message || e));
        }
    };

    const scan = async () => {
        setIsScanning(true);
        setStatus('scanning');
        setStatusMsg('Scanning for BLE devices');
        setDevices([]);
        try {
            const perms = await requestPermissions();
            if (!perms) throw new Error('Bluetooth permissions denied');

            const state = await BleManager.checkState();
            log('Bluetooth state:', state);
            if (state !== 'on') {
                throw new Error('Bluetooth not enabled (state: ' + state + ')');
            }

            // Remove old listener if exists
            if (discoverSubscriptionRef.current) {
                discoverSubscriptionRef.current.remove();
            }
            
            log('Setting up discovery listener...');
            
            // Set up discovery listener using NativeEventEmitter
            discoverSubscriptionRef.current = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', (peripheral: any) => {
                if (!mountedRef.current) return;
                log('Discovered peripheral:', {
                    id: peripheral.id,
                    name: peripheral.name || 'Unnamed',
                    rssi: peripheral.rssi,
                    advertising: peripheral.advertising
                });
                setDevices(prev => {
                    const existing = prev.find(d => d.id === peripheral.id);
                    if (existing) {
                        // Update existing device (rssi might change)
                        return prev.map(d => d.id === peripheral.id ? {
                            ...d,
                            rssi: peripheral.rssi,
                            advertising: peripheral.advertising
                        } : d);
                    }
                    return [...prev, {
                        id: peripheral.id,
                        name: peripheral.name,
                        rssi: peripheral.rssi,
                        advertising: peripheral.advertising
                    }];
                });
            });

            // Also listen for scan stop event
            const stopScanListener = bleManagerEmitter.addListener('BleManagerStopScan', () => {
                log('Scan stopped by system');
            });

            log('Starting BLE scan (duration: 10 seconds)...');
            
            // Scan for 10 seconds, all services
            await BleManager.scan([], 10);
            log('Scan command sent successfully');
            
            // Also get already connected peripherals
            try {
                const connected = await BleManager.getConnectedPeripherals([]);
                log('Already connected peripherals:', connected.length);
                connected.forEach((p: any) => {
                    setDevices(prev => {
                        if (!prev.find(d => d.id === p.id)) {
                            return [...prev, {
                                id: p.id,
                                name: p.name,
                                rssi: p.rssi || 0
                            }];
                        }
                        return prev;
                    });
                });
            } catch (e: any) {
                log('Error getting connected peripherals:', e?.message || e);
            }
            
            setTimeout(() => {
                setIsScanning(false);
                setStatus('scan_complete');
                setStatusMsg(`Scan complete. Found ${devices.length} device(s)`);
                log(`Scan finished. Total devices found: ${devices.length}`);
                stopScanListener.remove();
            }, 11000); // Slightly longer than scan duration
        } catch (e: any) {
            setIsScanning(false);
            setStatus('scan_error');
            setStatusMsg(String(e?.message || e));
            log('Scan error:', e?.message || e);
            log('Error stack:', e?.stack || 'No stack trace');
        }
    };

    const connect = async (peripheralId: string) => {
        try {
            setStatus('connecting');
            setStatusMsg(`Connecting to ${peripheralId}`);
            log('Connect requested:', peripheralId);

            await BleManager.connect(peripheralId);
            log('Connected to:', peripheralId);

            // Wait a bit for connection to stabilize
            await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));

            const peripheralInfo = await BleManager.getConnectedPeripherals([]);
            const device = peripheralInfo.find(p => p.id === peripheralId);
            if (device) {
                setConnectedName(device.name || 'Unknown');
            }

            setConnectedPeripheral(peripheralId);
            setStatus('connected');
            setStatusMsg('Connected, retrieving services...');
            log('Connection established');

            // Retrieve services
            const servs = await BleManager.retrieveServices(peripheralId);
            log('Services:', JSON.stringify(servs));
            setServices(servs.services || []);
            
            // Extract characteristics
            const chars: any[] = [];
            (servs.services || []).forEach((service: any) => {
                (service.characteristics || []).forEach((char: any) => {
                    chars.push({ ...char, service: service.uuid });
                });
            });
            setCharacteristics(chars);
            log(`Found ${chars.length} characteristics`);

            // Remove old update listener if exists
            if (updateSubscriptionRef.current) {
                updateSubscriptionRef.current.remove();
            }
            
            // Set up notification listener for data using NativeEventEmitter
            updateSubscriptionRef.current = bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', (data: any) => {
                if (data.peripheral === peripheralId) {
                    log('Data received:', JSON.stringify(data));
                    handleIncomingData(data.value);
                }
            });

            // Try to start notifications on notify/indicate characteristics
            for (const char of chars) {
                if (char.properties?.notify || char.properties?.indicate) {
                    try {
                        await BleManager.startNotification(peripheralId, char.service, char.uuid);
                        log(`Started notification on ${char.uuid}`);
                    } catch (e: any) {
                        log(`Failed to start notification on ${char.uuid}:`, e?.message || e);
                    }
                }
            }

            setStatus('connected');
            setStatusMsg('Connected and listening');
        } catch (e: any) {
            setStatus('connection_failed');
            setStatusMsg(String(e?.message || e));
            log('Connect error:', e?.message || e);
            setConnectedPeripheral(null);
        }
    };

    const handleIncomingData = (value: any) => {
        if (!mountedRef.current) return;
        
        let dataStr = '';
        if (typeof value === 'string') {
            dataStr = value;
        } else if (Array.isArray(value)) {
            // Convert byte array to string
            dataStr = String.fromCharCode(...value.filter((b: number) => b !== 0));
        } else if (value?.data) {
            dataStr = String(value.data);
        }

        const trimmed = dataStr.trim();
        log('Parsed data:', trimmed);

        // Try to extract weight value
        const match = trimmed.match(/(-?\d+(?:[\.,]\d+)?)/);
        if (match) {
            const weight = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(weight)) {
                setLastReading(`${weight} kg`);
                setStatus('weight');
                setStatusMsg('');
            }
        }
    };

    const readCharacteristic = async (serviceUuid: string, characteristicUuid: string) => {
        if (!connectedPeripheral) {
            log('No device connected');
            return;
        }
        try {
            const data = await BleManager.read(connectedPeripheral, serviceUuid, characteristicUuid);
            log(`Read from ${characteristicUuid}:`, JSON.stringify(data));
            handleIncomingData(data);
        } catch (e: any) {
            log(`Read error for ${characteristicUuid}:`, e?.message || e);
        }
    };

    const writeCharacteristic = async (serviceUuid: string, characteristicUuid: string, data: string) => {
        if (!connectedPeripheral) {
            log('No device connected');
            return;
        }
        try {
            const bytes = Array.from(data).map(c => c.charCodeAt(0));
            await BleManager.write(connectedPeripheral, serviceUuid, characteristicUuid, bytes);
            log(`Wrote to ${characteristicUuid}:`, data);
        } catch (e: any) {
            log(`Write error for ${characteristicUuid}:`, e?.message || e);
        }
    };

    const disconnect = async () => {
        try {
            if (connectedPeripheral) {
                setStatus('disconnecting');
                setStatusMsg('Disconnecting...');
                await BleManager.disconnect(connectedPeripheral);
                log('Disconnected');
            }
            setConnectedPeripheral(null);
            setConnectedName('');
            setServices([]);
            setCharacteristics([]);
            setStatus('disconnected');
            setStatusMsg('Disconnected');
        } catch (e: any) {
            log('Disconnect error:', e?.message || e);
        }
    };

    return (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>BLE Manager Scale Test</Text>

            <View style={styles.statusCard}>
                <Text style={styles.statusRow}>Status: <Text style={styles.statusVal}>{status}</Text></Text>
                {!!statusMsg && <Text style={styles.statusMsg}>{statusMsg}</Text>}
                {connectedPeripheral ? (
                    <Text style={styles.statusRow}>Connected: {connectedName || 'Unknown'} ({connectedPeripheral})</Text>
                ) : (
                    <Text style={styles.statusRow}>Connected: None</Text>
                )}
            </View>

            <View style={styles.dataCard}>
                <Text style={styles.statusRow}>Last Reading</Text>
                <Text style={styles.reading}>{lastReading || '--'}</Text>
            </View>

            <View style={styles.buttonsRow}>
                <TouchableOpacity style={[styles.button, { backgroundColor: '#3b82f6' }]} onPress={scan} disabled={isScanning}>
                    <Text style={styles.buttonText}>{isScanning ? 'Scanning...' : 'Scan BLE'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, { backgroundColor: '#ef4444' }]} onPress={disconnect}>
                    <Text style={styles.buttonText}>Disconnect</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.button, { backgroundColor: '#10b981' }]} 
                    onPress={async () => {
                        try {
                            log('Getting connected peripherals...');
                            const connected = await BleManager.getConnectedPeripherals([]);
                            log('Connected peripherals:', JSON.stringify(connected));
                            Alert.alert('Connected Devices', `${connected.length} device(s) connected:\n${connected.map((p: any) => `${p.name || 'Unknown'} (${p.id})`).join('\n') || 'None'}`);
                        } catch (e: any) {
                            log('Error getting connected:', e?.message || e);
                        }
                    }}
                >
                    <Text style={styles.buttonText}>Check Connected</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={devices}
                keyExtractor={(item) => item.id}
                style={{ marginTop: 12 }}
                nestedScrollEnabled
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.deviceRow} onPress={() => connect(item.id)}>
                        <Text style={styles.deviceName}>{item.name || 'Unnamed'}</Text>
                        <Text style={styles.deviceId}>{item.id}</Text>
                        {item.rssi !== undefined && <Text style={styles.deviceRssi}>RSSI: {item.rssi} dBm</Text>}
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    isScanning ? (
                        <View style={{ padding: 16, alignItems: 'center' }}>
                            <Text style={{ textAlign: 'center', color: '#3b82f6', marginBottom: 8 }}>Scanning for BLE devices...</Text>
                            <Text style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
                                Make sure your BLE scale is on and in pairing mode.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ padding: 16, alignItems: 'center' }}>
                            <Text style={{ textAlign: 'center', color: '#6b7280', marginBottom: 8 }}>No BLE devices found.</Text>
                            <Text style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
                                ⚠️ Note: This screen only finds Bluetooth Low Energy (BLE) devices.{'\n'}
                                Classic Bluetooth devices (like CF100) won't appear here.{'\n'}
                                Check the logs for discovery events.
                            </Text>
                        </View>
                    )
                }
            />

            {characteristics.length > 0 && (
                <View style={{ marginTop: 12 }}>
                    <Text style={{ fontWeight: '600', marginBottom: 6 }}>Characteristics ({characteristics.length})</Text>
                    <FlatList
                        data={characteristics}
                        keyExtractor={(item, idx) => `${item.service}-${item.uuid}-${idx}`}
                        nestedScrollEnabled
                        renderItem={({ item }) => (
                            <View style={styles.charRow}>
                                <Text style={styles.charUuid}>{item.uuid.substring(0, 8)}...</Text>
                                <Text style={styles.charProps}>{JSON.stringify(item.properties)}</Text>
                                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                                    {(item.properties?.read) && (
                                        <TouchableOpacity
                                            style={[styles.smallButton, { backgroundColor: '#3b82f6', marginRight: 4 }]}
                                            onPress={() => readCharacteristic(item.service, item.uuid)}
                                        >
                                            <Text style={styles.smallButtonText}>Read</Text>
                                        </TouchableOpacity>
                                    )}
                                    {(item.properties?.notify || item.properties?.indicate) && (
                                        <TouchableOpacity
                                            style={[styles.smallButton, { backgroundColor: '#10b981' }]}
                                            onPress={async () => {
                                                try {
                                                    await BleManager.startNotification(connectedPeripheral!, item.service, item.uuid);
                                                    log(`Started notification on ${item.uuid}`);
                                                } catch (e: any) {
                                                    log(`Notification error:`, e?.message || e);
                                                }
                                            }}
                                        >
                                            <Text style={styles.smallButtonText}>Notify</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                        style={{ maxHeight: 200 }}
                    />
                </View>
            )}

            <View style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: '600', marginBottom: 6 }}>Logs (latest first)</Text>
                <FlatList
                    data={logs}
                    keyExtractor={(item, idx) => String(idx)}
                    renderItem={({ item }) => (
                        <Text style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{item}</Text>
                    )}
                    style={{ maxHeight: 180 }}
                    nestedScrollEnabled
                />
            </View>
        </ScrollView>
    );
};

export default BLEManagerScaleScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#fff' },
    scroll: { flex: 1, backgroundColor: '#fff' },
    contentContainer: { padding: 16, paddingBottom: 24 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
    statusCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    statusRow: { color: '#374151' },
    statusVal: { fontWeight: '600' },
    statusMsg: { color: '#6b7280', marginTop: 4 },
    dataCard: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 16 },
    reading: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#111827', marginTop: 6 },
    buttonsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
    buttonText: { color: '#fff', fontWeight: '700' },
    deviceRow: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
    deviceName: { fontWeight: '600', color: '#111827' },
    deviceId: { color: '#6b7280', fontSize: 12, marginTop: 2 },
    deviceRssi: { color: '#6b7280', fontSize: 11, marginTop: 2 },
    charRow: { padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 4 },
    charUuid: { fontSize: 10, fontFamily: 'monospace', color: '#111827' },
    charProps: { fontSize: 9, color: '#6b7280', marginTop: 2 },
    smallButton: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    smallButtonText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }
});

