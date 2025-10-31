import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, PermissionsAndroid, Platform, Alert } from 'react-native';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';

const WEIGHT_SERVICE_UUIDS = [
    '181d', // Weight Scale Service (official)
];
const WEIGHT_CHARACTERISTIC_UUIDS = [
    '2a9d', // Weight Measurement (official)
];

function decodeUtf8(bytes: number[] | Uint8Array): string {
    try {
        // @ts-ignore - TextDecoder might not be in types but exists in RN
        if (typeof TextDecoder !== 'undefined') {
            // @ts-ignore
            return new TextDecoder('utf-8').decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        }
    } catch {}
    // Fallback simple ASCII
    try {
        return String.fromCharCode(...(bytes as number[]));
    } catch {
        return '';
    }
}

function base64ToBytes(b64: string): Uint8Array | null {
    try {
        // Use global atob if available
        // @ts-ignore
        const atobFn = (global as any)?.atob || (typeof atob !== 'undefined' ? atob : null);
        if (atobFn) {
            const bin = atobFn(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i) & 0xff;
            return arr;
        }
    } catch {}
    try {
        // Fallback: Buffer if polyfilled
        // @ts-ignore
        if (typeof Buffer !== 'undefined') {
            // @ts-ignore
            return Buffer.from(b64, 'base64');
        }
    } catch {}
    return null;
}

function bytesToHex(bytes: Uint8Array) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

const ScaleTestScreen = () => {
    const ble = useMemo(() => new BleManager(), []);
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [devices, setDevices] = useState<Device[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [lastReading, setLastReading] = useState<string | null>(null);
    const notifySubRef = useRef<any>(null);
    const [noBleWeightService, setNoBleWeightService] = useState(false);

    useEffect(() => {
        return () => {
            try { notifySubRef.current?.remove?.(); } catch {}
            try { ble?.destroy?.(); } catch {}
        };
    }, [ble]);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;
        try {
            const result = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            ]);
            return Object.values(result).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
        } catch (e) {
            return false;
        }
    }, []);

    const scan = useCallback(async () => {
        console.log('[BLE] ========== SCAN STARTED ==========');
        const ok = await requestPermissions();
        if (!ok) {
            console.log('[BLE] SCAN: Permissions denied, aborting');
            Alert.alert('Permissions required', 'Bluetooth and Location permissions are required.');
            return;
        }
        console.log('[BLE] SCAN STEP 1: Permissions granted');
        
        setIsScanning(true);
        setDevices([]);
        console.log('[BLE] SCAN STEP 2: Starting device scan (10 seconds)...');
        
        const seen: Record<string, boolean> = {};
        let deviceCount = 0;
        
        const sub: any = ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
            if (error) {
                console.log('[BLE] SCAN ERROR:', (error as any)?.message || error);
                setIsScanning(false);
                try { (sub as any)?.remove?.(); } catch {}
                return;
            }
            if (!device) return;
            const key = (device.id || device.name || '').toString();
            if (!seen[key]) {
                seen[key] = true;
                deviceCount++;
                console.log(`[BLE] SCAN STEP 2: Found device #${deviceCount}:`, {
                    name: device.name || 'Unnamed',
                    id: device.id,
                    services: device.serviceUUIDs || [],
                    rssi: device.rssi,
                    isConnectable: device.isConnectable
                });
                setDevices(prev => [...prev, device]);
            }
        });
        
        // Stop scan after 15s (increased for better discovery)
        setTimeout(() => {
            try { (sub as any)?.remove?.(); } catch {}
            setIsScanning(false);
            console.log(`[BLE] SCAN STEP 3: Scan complete. Found ${deviceCount} device(s)`);
            console.log('[BLE] ========== SCAN COMPLETE ==========');
        }, 15000);
    }, [ble, requestPermissions]);

    const disconnect = useCallback(async () => {
        console.log('[BLE] ========== DISCONNECT STARTED ==========');
        try {
            console.log('[BLE] DISCONNECT STEP 1: Removing notification subscription...');
            notifySubRef.current?.remove?.();
            console.log('[BLE] DISCONNECT STEP 1: Subscription removed');
        } catch (e) {
            console.log('[BLE] DISCONNECT STEP 1: Remove subscription error (ignored):', e);
        }
        notifySubRef.current = null;
        
        if (connectedDevice) {
            try {
                console.log('[BLE] DISCONNECT STEP 2: Cancelling device connection...');
                await connectedDevice.cancelConnection();
                console.log('[BLE] DISCONNECT STEP 2: Connection cancelled');
            } catch (e) {
                console.log('[BLE] DISCONNECT STEP 2: Cancel connection error (ignored):', e);
            }
            setConnectedDevice(null);
        }
        console.log('[BLE] ========== DISCONNECT COMPLETE ==========');
    }, [connectedDevice]);

    const connect = useCallback(async (device: Device) => {
        console.log('[BLE] ========== CONNECT STARTED ==========');
        console.log('[BLE] CONNECT: Target device:', device.name || 'Unnamed', 'id:', device.id);
        setIsConnecting(true);
        try {
            console.log('[BLE] CONNECT STEP 1: Initiating connection...');
            const d = await ble.connectToDevice(device.id, { autoConnect: false });
            console.log('[BLE] CONNECT STEP 1: ✓ Connection established');
            
            console.log('[BLE] CONNECT STEP 2: Discovering all services and characteristics...');
            await d.discoverAllServicesAndCharacteristics();
            console.log('[BLE] CONNECT STEP 2: ✓ Discovery complete');
            
            setConnectedDevice(d);
            setNoBleWeightService(false);

            // Log all services and characteristics
            console.log('[BLE] CONNECT STEP 3: Enumerating services and characteristics...');
            const services = await d.services();
            console.log(`[BLE] CONNECT STEP 3: Found ${services.length} service(s)`);
            
            for (let i = 0; i < services.length; i++) {
                const s = services[i];
                try {
                    const chars = await d.characteristicsForService(s.uuid);
                    console.log(`[BLE] CONNECT STEP 3: SERVICE #${i + 1}/${services.length} - UUID: ${s.uuid}`);
                    console.log(`[BLE] CONNECT STEP 3: SERVICE #${i + 1} has ${chars.length} characteristic(s)`);
                    
                    chars.forEach((c, j) => {
                        console.log(`  [BLE] CONNECT STEP 3: CHAR #${j + 1}/${chars.length} - UUID: ${c.uuid}`);
                        console.log(`  [BLE] CONNECT STEP 3: CHAR #${j + 1} properties:`, {
                            isReadable: c.isReadable,
                            isNotifiable: c.isNotifiable,
                            isIndicatable: c.isIndicatable,
                            isWritableWithResponse: c.isWritableWithResponse,
                            isWritableWithoutResponse: c.isWritableWithoutResponse,
                        });
                    });
                } catch (err) {
                    console.log(`[BLE] CONNECT STEP 3: ERROR enumerating service ${s.uuid}:`, (err as any)?.message || err);
                }
            }
            console.log('[BLE] CONNECT STEP 3: Service enumeration complete');

            // Try official weight service first
            console.log('[BLE] CONNECT STEP 4: Looking for official weight service (0x181d) and characteristic (0x2a9d)...');
            let characteristic: Characteristic | null = null;
            const candidates: Array<{ service: string; char: Characteristic; reason: string }> = [];
            
            try {
                const services = await d.services();
                for (const s of services) {
                    const chars = await d.characteristicsForService(s.uuid);
                    for (const c of chars) {
                        const su = (s.uuid || '').toLowerCase().replace(/-/g, '');
                        const cu = (c.uuid || '').toLowerCase().replace(/-/g, '');
                        
                        // Skip Generic Access service (0x1800) and its common characteristics (2A00, 2A01)
                        if (su.endsWith('1800') || cu.endsWith('2a00') || cu.endsWith('2a01')) {
                            console.log(`[BLE] CONNECT STEP 4: Skipping Generic Access service/char: ${s.uuid}/${c.uuid}`);
                            continue;
                        }
                        
                        // Check for official weight service/characteristic
                        if (WEIGHT_SERVICE_UUIDS.some(wsu => su.endsWith(wsu)) && 
                            WEIGHT_CHARACTERISTIC_UUIDS.some(wcu => cu.endsWith(wcu))) {
                            if (c.isNotifiable || c.isReadable) {
                                characteristic = c;
                                console.log(`[BLE] CONNECT STEP 4: ✓✓✓ FOUND OFFICIAL WEIGHT SERVICE/CHAR!`);
                                console.log(`[BLE] CONNECT STEP 4: Service: ${s.uuid}, Characteristic: ${c.uuid}`);
                                console.log(`[BLE] CONNECT STEP 4: Notifiable: ${c.isNotifiable}, Readable: ${c.isReadable}`);
                                break;
                            } else {
                                console.log(`[BLE] CONNECT STEP 4: Found weight service/char but not notifiable/readable: ${s.uuid}/${c.uuid}`);
                            }
                        }
                        
                        // Collect candidates
                        if (c.isNotifiable || c.isReadable) {
                            candidates.push({
                                service: s.uuid,
                                char: c,
                                reason: c.isNotifiable ? 'Notifiable' : 'Readable'
                            });
                        }
                    }
                    if (characteristic) break;
                }
            } catch (err) {
                console.log('[BLE] CONNECT STEP 4: Error searching for weight service:', (err as any)?.message || err);
            }

            // Fallback: any notifiable/readable characteristic
            if (!characteristic) {
                console.log('[BLE] CONNECT STEP 4: Official weight service not found. Trying fallback candidates...');
                console.log(`[BLE] CONNECT STEP 4: Found ${candidates.length} candidate characteristic(s)`);
                
                // Prefer notifiable over readable
                const notifiable = candidates.filter(c => c.char.isNotifiable);
                if (notifiable.length > 0) {
                    characteristic = notifiable[0].char;
                    console.log(`[BLE] CONNECT STEP 4: ✓ Using notifiable characteristic: ${notifiable[0].service}/${notifiable[0].char.uuid}`);
                } else if (candidates.length > 0) {
                    characteristic = candidates[0].char;
                    console.log(`[BLE] CONNECT STEP 4: ✓ Using readable characteristic: ${candidates[0].service}/${candidates[0].char.uuid}`);
                }
            }

            if (!characteristic) {
                console.log('[BLE] CONNECT STEP 4: ✗ No suitable characteristic found');
                setNoBleWeightService(true);
                Alert.alert('No BLE weight service', 'Connected, but only Generic Access (0x1800) was found. Your scale likely does not expose weight over BLE.');
                return;
            }

            // Helper function to parse weight from bytes
            const parseWeightData = (bytes: Uint8Array | null, source: string) => {
                if (!bytes || bytes.length === 0) {
                    console.log(`[BLE] PARSE [${source}]: No bytes to parse`);
                    return false;
                }
                
                try {
                    console.log(`[BLE] PARSE [${source}]: Bytes length: ${bytes.length}`);
                    console.log(`[BLE] PARSE [${source}]: Bytes (hex): ${bytesToHex(bytes)}`);
                    console.log(`[BLE] PARSE [${source}]: Bytes (decimal): ${Array.from(bytes).join(', ')}`);
                    
                    // Try UTF-8 decode
                    const asText = decodeUtf8(bytes);
                    console.log(`[BLE] PARSE [${source}]: As UTF-8 text: ${JSON.stringify(asText)}`);
                    
                    // Skip device name frames
                    if (/^xh\d+\s*$/i.test(asText)) {
                        console.log(`[BLE] PARSE [${source}]: Skipping device name frame`);
                        return false;
                    }
                    
                    // Try multiple number patterns
                    let match = asText.match(/([-+]?[0-9]+(?:[.,][0-9]+)?)/);
                    if (!match) {
                        // Try weight patterns like W=45.23, Weight: 45.23, etc.
                        match = asText.match(/[wW](?:eight)?[=:]\s*([-+]?[0-9]+(?:[.,][0-9]+)?)/);
                    }
                    if (!match) {
                        // Try parsing from raw bytes (some scales send binary)
                        // Common binary formats: 2-byte little-endian, 4-byte float, etc.
                        if (bytes.length >= 2) {
                            // Try as 2-byte unsigned little-endian (common for scales)
                            const val16 = bytes[0] | (bytes[1] << 8);
                            if (val16 > 0 && val16 < 100000) { // Reasonable weight range
                                const weight = (val16 / 100.0).toFixed(2); // Assuming 0.01kg resolution
                                console.log(`[BLE] PARSE [${source}]: ✓✓✓ Parsed from binary (2-byte LE): ${weight}`);
                                setLastReading(weight);
                                return true;
                            }
                        }
                        if (bytes.length >= 4) {
                            // Try as 4-byte float
                            try {
                                const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                                const val = view.getFloat32(0, true); // Little-endian
                                if (!isNaN(val) && isFinite(val) && val >= -1000 && val <= 100000) {
                                console.log(`[BLE] PARSE [${source}]: ✓✓✓ Parsed from binary (4-byte float): ${val.toFixed(2)}`);
                                    setLastReading(val.toFixed(2));
                                    return true;
                                }
                            } catch {}
                        }
                    }
                    
                    if (match) {
                        const val = parseFloat(match[1].replace(',', '.'));
                        if (!isNaN(val) && isFinite(val)) {
                            console.log(`[BLE] PARSE [${source}]: ✓✓✓ VALID WEIGHT PARSED: ${val.toFixed(2)}`);
                            setLastReading(val.toFixed(2));
                            console.log(`[BLE] PARSE [${source}]: UI Updated with reading: ${val.toFixed(2)}`);
                            return true;
                        } else {
                            console.log(`[BLE] PARSE [${source}]: Parsed NaN/Infinity from: ${match[1]}`);
                        }
                    } else {
                        console.log(`[BLE] PARSE [${source}]: No number pattern found in: ${JSON.stringify(asText)}`);
                    }
                } catch (err) {
                    console.log(`[BLE] PARSE [${source}]: Parse error:`, err);
                }
                return false;
            };

            // Subscribe to notifications if possible, else read interval
            console.log('[BLE] CONNECT STEP 5: Setting up data reading...');
            if (characteristic.isNotifiable) {
                console.log('[BLE] CONNECT STEP 5: Using NOTIFICATION method (characteristic is notifiable)');
                console.log(`[BLE] CONNECT STEP 5: Service UUID: ${characteristic.serviceUUID}`);
                console.log(`[BLE] CONNECT STEP 5: Characteristic UUID: ${characteristic.uuid}`);
                
                try {
                    notifySubRef.current = d.monitorCharacteristicForService(
                        characteristic.serviceUUID!,
                        characteristic.uuid,
                        (error, c) => {
                            if (error) {
                                console.log('[BLE] NOTIFY ERROR:', error?.message || error);
                                return;
                            }
                            
                            console.log('[BLE] NOTIFY: ✓✓✓ NOTIFICATION RECEIVED!');
                            const deviceName = d.name || d.id;
                            const rawB64 = c?.value;
                            console.log(`[BLE] NOTIFY: Base64 value: ${rawB64 ? rawB64.substring(0, 50) + '...' : 'null'}`);
                            
                            const bytes = rawB64 ? base64ToBytes(rawB64) : null;
                            parseWeightData(bytes, 'NOTIFY');
                            
                            console.log(`[BLE] NOTIFY: Full notification object:`, {
                                uuid: c?.uuid,
                                serviceUUID: c?.serviceUUID,
                                value: rawB64 ? `${rawB64.substring(0, 30)}...` : null
                            });
                        }
                    );
                    console.log('[BLE] CONNECT STEP 5: ✓ Notification subscription started');
                } catch (notifyErr) {
                    console.log('[BLE] CONNECT STEP 5: ✗ Notification setup error:', (notifyErr as any)?.message || notifyErr);
                    // Fall back to polling if notify fails
                    console.log('[BLE] CONNECT STEP 5: Falling back to polling method...');
                    characteristic = { ...characteristic, isNotifiable: false, isReadable: true } as Characteristic;
                }
            }
            
            if (!characteristic.isNotifiable && characteristic.isReadable) {
                console.log('[BLE] CONNECT STEP 5: Using POLLING method (characteristic is readable)');
                console.log(`[BLE] CONNECT STEP 5: Service UUID: ${characteristic.serviceUUID}`);
                console.log(`[BLE] CONNECT STEP 5: Characteristic UUID: ${characteristic.uuid}`);
                console.log('[BLE] CONNECT STEP 5: Polling every 250ms...');
                
                let pollCount = 0;
                const interval = setInterval(async () => {
                    pollCount++;
                    try {
                        const c = await d.readCharacteristicForService(characteristic!.serviceUUID!, characteristic!.uuid);
                        console.log(`[BLE] POLL #${pollCount}: ✓ Read successful`);
                        
                        const deviceName = d.name || d.id;
                        const rawB64 = c?.value;
                        console.log(`[BLE] POLL #${pollCount}: Base64 value: ${rawB64 ? rawB64.substring(0, 50) + '...' : 'null'}`);
                        
                        const bytes = rawB64 ? base64ToBytes(rawB64) : null;
                        parseWeightData(bytes, `POLL #${pollCount}`);
                        
                        if (pollCount % 20 === 0) {
                            console.log(`[BLE] POLL #${pollCount}: Still polling (no data yet, this is OK)`);
                        }
                    } catch (err) {
                        const errMsg = (err as any)?.message || String(err);
                        console.log(`[BLE] POLL #${pollCount}: ERROR:`, errMsg);
                        if (errMsg?.includes('disconnected')) {
                            clearInterval(interval);
                            console.log('[BLE] POLL: Device disconnected, stopping poll');
                        }
                    }
                }, 250);
                notifySubRef.current = { remove: () => {
                    clearInterval(interval);
                    console.log('[BLE] POLL: Polling stopped');
                }};
                console.log('[BLE] CONNECT STEP 5: ✓ Polling started');
            }
            
            console.log('[BLE] ========== CONNECT COMPLETE ==========');
        } catch (e) {
            console.log('[BLE] ========== CONNECT ERROR ==========');
            const errMsg = (e as any)?.message || String(e);
            console.log('[BLE] CONNECT ERROR:', errMsg);
            console.log('[BLE] CONNECT ERROR stack:', (e as any)?.stack);
            Alert.alert('Connection failed', errMsg);
        } finally {
            setIsConnecting(false);
            console.log('[BLE] CONNECT: Finally block executed, isConnecting set to false');
        }
    }, [ble]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Scale Test (BLE)</Text>

            <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Status:</Text>
                {connectedDevice ? (
                    <Text style={[styles.statusValue, { color: '#16a34a' }]}>Connected to {connectedDevice?.name || connectedDevice?.id}</Text>
                ) : (
                    <Text style={[styles.statusValue, { color: '#ef4444' }]}>Not Connected</Text>
                )}
                {isScanning && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <ActivityIndicator size="small" color="#3b82f6" />
                        <Text style={{ marginLeft: 6, color: '#3b82f6' }}>Scanning...</Text>
                    </View>
                )}
                {isConnecting && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <ActivityIndicator size="small" color="#f59e0b" />
                        <Text style={{ marginLeft: 6, color: '#f59e0b' }}>Connecting...</Text>
                    </View>
                )}
            </View>

            <View style={styles.dataCard}>
                <Text style={styles.statusLabel}>Last Reading</Text>
                <Text style={styles.reading}>{lastReading || '--'}</Text>
            </View>

            <View style={styles.buttonsRow}>
                <TouchableOpacity style={[styles.button, { backgroundColor: '#3b82f6' }]} onPress={scan} disabled={isScanning}>
                    <Text style={styles.buttonText}>{isScanning ? 'Scanning...' : 'Scan'}</Text>
                </TouchableOpacity>
                {connectedDevice ? (
                    <TouchableOpacity style={[styles.button, { backgroundColor: '#ef4444' }]} onPress={disconnect}>
                        <Text style={styles.buttonText}>Disconnect</Text>
                    </TouchableOpacity>
                ) : null}
                {connectedDevice ? (
                    <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981' }]} onPress={() => setLastReading(null)}>
                        <Text style={styles.buttonText}>Clear</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <FlatList
                data={devices}
                keyExtractor={(item) => item.id}
                style={{ marginTop: 12 }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.deviceRow}
                        onPress={() => connect(item)}
                        disabled={isConnecting}
                    >
                        <Text style={styles.deviceName}>{item.name || 'Unnamed'}</Text>
                        <Text style={styles.deviceId}>{item.id}</Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={!isScanning ? (
                    <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 8 }}>No devices yet. Tap Scan.</Text>
                ) : null}
            />
        </View>
    );
};

export default ScaleTestScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#fff' },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
    statusCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    statusLabel: { fontSize: 12, color: '#6b7280' },
    statusValue: { fontSize: 14, fontWeight: '600', marginTop: 4 },
    dataCard: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginBottom: 16 },
    reading: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#111827', marginTop: 6 },
    buttonsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
    buttonText: { color: '#fff', fontWeight: '700' },
    deviceRow: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
    deviceName: { fontWeight: '600', color: '#111827' },
    deviceId: { color: '#6b7280', fontSize: 12, marginTop: 2 },
});


