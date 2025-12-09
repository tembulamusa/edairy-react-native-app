import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { BleManager, Device as BLEDevice, Characteristic } from "react-native-ble-plx";
import { Platform, PermissionsAndroid, Alert } from "react-native";

type BLEDeviceInfo = {
    id: string;
    address: string;
    name?: string;
    serviceUUIDs?: string[];
    rssi?: number;
};

const WEIGHT_SERVICE_UUIDS = [
    '181d', // Weight Scale Service (official)
    'fee0', // Xiaomi custom service
    'fee1', // Xiaomi custom service
];
const WEIGHT_CHARACTERISTIC_UUIDS = [
    '2a9d', // Weight Measurement (official)
    '00002a9d-0000-1000-8000-00805f9b34fb', // Standard weight measurement
    // Xiaomi/Huawei scale characteristics
    '2a9e', // Weight Scale Feature
    '2a9b', // Body Composition Measurement
    '2a9c', // Body Composition Feature
    // Generic data characteristics that might contain weight
    '2a19', // Battery Level (some scales send weight here)
    'ffe1', 'ffe2', 'ffe3', 'ffe4', // Xiaomi custom characteristics
];

// Known scale device profiles
const SCALE_DEVICE_PROFILES = {
    'xh2507024006': {
        name: 'Xiaomi/Huawei Scale XH2507024006',
        services: ['fee0', 'fee1', '180f', '180a'],
        characteristics: ['2a9d', '2a19'], // Weight measurement, battery level
        manufacturerId: 0x0157, // Xiaomi
        connectionParams: {
            mtu: 512,
            timeout: 15000
        }
    },
    // Add more device profiles here as needed
};

// Helper functions for BLE data parsing
function decodeUtf8(bytes: number[] | Uint8Array): string {
    try {
        // @ts-ignore - TextDecoder might not be in types but exists in RN
        if (typeof TextDecoder !== 'undefined') {
            // @ts-ignore
            return new TextDecoder('utf-8').decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        }
    } catch { }
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
    } catch { }
    try {
        // Fallback: Buffer if polyfilled
        // @ts-ignore
        if (typeof Buffer !== 'undefined') {
            // @ts-ignore
            return Buffer.from(b64, 'base64');
        }
    } catch { }
    return null;
}

function bytesToHex(bytes: Uint8Array) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
}


type UseBLEServiceProps = {
    deviceType?: "scale" | "printer";
};

type UseBLEServiceReturn = {
    devices: BLEDeviceInfo[];
    connectedDevice: BLEDeviceInfo | null;
    isScanning: boolean;
    isConnecting: boolean;
    lastMessage: string | null;
    scanForDevices: () => Promise<void>;
    connectToDevice: (id: string) => Promise<BLEDeviceInfo | null>;
    disconnect: () => Promise<void>;
    connectionFailed: boolean;
    lastConnectionAttempt: string | null;
};

function useBLEService({
    deviceType = "scale",
}: UseBLEServiceProps = {}): UseBLEServiceReturn {
    const ble = useMemo(() => new BleManager(), []);
    const [devices, setDevices] = useState<BLEDeviceInfo[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<BLEDeviceInfo | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [lastMessage, setLastMessage] = useState<string | null>(null);
    const [connectionFailed, setConnectionFailed] = useState(false);
    const [lastConnectionAttempt, setLastConnectionAttempt] = useState<string | null>(null);

    const notifySubRef = useRef<any>(null);
    const manualDisconnectRef = useRef<boolean>(false);
    const autoConnectHasRunRef = useRef<boolean>(false);
    const connectionMonitorRef = useRef<any>(null);

    // Cleanup BLE
    const cleanupBLE = useCallback(() => {
        try { notifySubRef.current?.remove?.(); } catch { }
        notifySubRef.current = null;

        if (connectionMonitorRef.current) {
            clearInterval(connectionMonitorRef.current);
            connectionMonitorRef.current = null;
        }
    }, []);

    // Monitor BLE state changes
    useEffect(() => {
        const subscription = ble.onStateChange((state) => {
            console.log('[BLE] State changed to:', state);
            if (state !== 'PoweredOn') {
                console.log('[BLE] BLE turned off, cleaning up connections');
                cleanupBLE();
                setConnectedDevice(null);
                setLastMessage(null);
            }
        }, true);

        return () => {
            subscription?.remove?.();
        };
    }, [ble, cleanupBLE]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupBLE();
            try { ble?.destroy?.(); } catch { }
        };
    }, [ble, cleanupBLE]);

    // Check if BLE is enabled
    const checkBLEEnabled = useCallback(async (): Promise<boolean> => {
        try {
            const state = await ble.state();
            return state === 'PoweredOn';
        } catch (error) {
            console.warn('[BLE] Error checking BLE state:', error);
            return false;
        }
    }, [ble]);

    // Request BLE permissions
    const requestBLEPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;
        try {
            console.log('[BLE] Requesting Bluetooth permissions...');

            // Determine which permissions to request based on Android version
            const permissionsToRequest = [];

            if (Platform.Version >= 31) { // Android 12+
                permissionsToRequest.push(
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
            } else {
                permissionsToRequest.push(
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
                );
            }

            const result = await PermissionsAndroid?.requestMultiple?.(permissionsToRequest);

            console.log('[BLE] Permission results:', result);

            // Check if all required permissions are granted
            const allGranted = Object.values(result).every(v => v === PermissionsAndroid.RESULTS.GRANTED);

            if (!allGranted) {
                const deniedPermissions = Object.entries(result)
                    .filter(([_, status]) => status !== PermissionsAndroid.RESULTS.GRANTED)
                    .map(([permission, _]) => permission);

                console.warn('[BLE] Denied permissions:', deniedPermissions);

                Alert.alert(
                    'Permissions Required',
                    `Bluetooth permissions are required to connect to scale devices. Please grant the following permissions:\n\n${deniedPermissions.join('\n')}`,
                    [
                        {
                            text: 'Open Settings',
                            onPress: () => {
                                // Try to open app settings
                                try {
                                    // This would require react-native-permissions or similar
                                    console.log('Please go to app settings and enable Bluetooth permissions');
                                } catch (e) {
                                    console.error('Could not open settings:', e);
                                }
                            }
                        },
                        { text: 'Cancel', style: 'cancel' }
                    ]
                );
            }

            return allGranted;
        } catch (e) {
            console.error('[BLE] Error requesting permissions:', e);
            Alert.alert(
                'Permission Error',
                'Failed to request Bluetooth permissions. Please check your device settings.',
                [{ text: 'OK' }]
            );
            return false;
        }
    }, []);

    // Scan for BLE devices
    const scanForDevices = useCallback(async (): Promise<void> => {
        console.log('[BLE] ========== BLE SCAN STARTED ==========');

        try {
            // Check if BLE is enabled
            const bleEnabled = await checkBLEEnabled();
            if (!bleEnabled) {
                console.log('[BLE] SCAN: BLE is not enabled');
                Alert.alert(
                    'Bluetooth Disabled',
                    'Please enable Bluetooth to scan for devices. Go to Settings > Bluetooth and turn it on.',
                    [
                        {
                            text: 'Try Again',
                            onPress: () => scanForDevices() // Retry after user enables Bluetooth
                        },
                        { text: 'Cancel', style: 'cancel' }
                    ]
                );
                return;
            }

            const hasPermission = await requestBLEPermissions();
            if (!hasPermission) {
                console.log('[BLE] SCAN: No BLE permissions, aborting');
                Alert.alert(
                    'Permissions Required',
                    'Bluetooth permissions are required to scan for devices.',
                    [{ text: 'OK' }]
                );
                return;
            }

            setIsScanning(true);
            setDevices([]);

            console.log('[BLE] SCAN STEP 1: Starting BLE scan...');
            let deviceCount = 0;

            // Stop any existing scan
            try { await ble.stopDeviceScan(); } catch { }

            // Start scan for weight scale service
            const scanPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.log('[BLE] SCAN: Timeout reached, stopping scan');
                    try { ble.stopDeviceScan(); } catch { }
                    resolve();
                }, 10000); // 10 second scan

                try {
                    // Scan for all BLE devices, we'll filter by name later
                    ble.startDeviceScan(
                        null, // Remove UUID filtering to find all devices
                        {
                            allowDuplicates: false,
                            scanMode: 'LowLatency',
                        },
                        (error, scannedDevice) => {
                            if (error) {
                                console.error('[BLE] SCAN: Device scan error:', error);
                                clearTimeout(timeout);

                                // Handle specific scanning errors
                                if (error.message && error.message.includes('cannot start scanning operation')) {
                                    Alert.alert(
                                        'Scanning Failed',
                                        'Unable to start Bluetooth scanning. Please ensure Bluetooth is enabled and try again.',
                                        [{ text: 'OK' }]
                                    );
                                }

                                reject(error);
                                return;
                            }

                            if (scannedDevice) {
                                deviceCount++;
                                console.log(`[BLE] SCAN: Found device ${deviceCount}: ${scannedDevice.name || 'Unknown'} (${scannedDevice.id})`);

                                setDevices(prev => {
                                    const exists = prev.find(d => d.id === scannedDevice.id);
                                    if (exists) return prev;

                                    // Enhanced scale detection with specific device recognition
                                    const deviceName = (scannedDevice.name || '').toLowerCase();
                                    const deviceId = scannedDevice.id.toLowerCase();
                                    const deviceAddress = (scannedDevice as any).localName?.toLowerCase() || '';

                                    // Known scale devices by ID/name - comprehensive list
                                    const knownScaleDevices = [
                                        // Specific device IDs mentioned by user
                                        'h05', 'cf', 'xh250', 'xh2507024006',
                                        // Known scale brands with "scale" in name
                                        'beurer scale', 'seca scale', 'omron scale',
                                        'tanita scale', 'withings scale',
                                        // Add more known scale device IDs/names here
                                    ];

                                    // STRICT scale device patterns - regex for specific models
                                    const scaleDevicePatterns = [
                                        /^xh\d{1,}/i,  // XH250, XH2, XH2, etc. (at least 1 digit)
                                        /^h\d{2,}/i,   // H05, etc.
                                        /^cf/i,        // CF model
                                    ];

                                    // Known scale manufacturers by company identifier
                                    const scaleManufacturers = [
                                        0x0157, // Xiaomi (MI)
                                        0x038F, // Huawei
                                        0x0499, // Beurer
                                        0x02E2, // Seca
                                        0x0323, // Tanita
                                        0x0334, // Omron
                                    ];

                                    // STRICT scale detection - only show confirmed scale devices
                                    const mightBeScale = deviceType === "scale" && (
                                        // 1. Exact known scale device names/IDs
                                        knownScaleDevices.some(knownDevice =>
                                            deviceId.toLowerCase().includes(knownDevice.toLowerCase()) ||
                                            deviceName.toLowerCase().includes(knownDevice.toLowerCase())
                                        ) ||
                                        // 2. Specific device pattern matching (H05, CF, XH250, etc.)
                                        scaleDevicePatterns.some(pattern =>
                                            pattern.test(deviceName) || pattern.test(deviceId)
                                        ) ||
                                        // 3. Check for XH anywhere in name (case-insensitive)
                                        deviceName.toLowerCase().includes('xh') ||
                                        // 4. Check for CF anywhere in name (case-insensitive)
                                        deviceName.toLowerCase().includes('cf') ||
                                        // 5. Device profile matching (for known scale models)
                                        Object.keys(SCALE_DEVICE_PROFILES).some(profileKey =>
                                            deviceId.toLowerCase().includes(profileKey.toLowerCase()) ||
                                            deviceName.toLowerCase().includes(profileKey.toLowerCase())
                                        ) ||
                                        // 6. Official weight scale service UUID (very strict - only official scales)
                                        scannedDevice.serviceUUIDs?.some(uuid =>
                                            WEIGHT_SERVICE_UUIDS.includes(uuid.toLowerCase()) ||
                                            uuid.toLowerCase().includes('181d') // Official weight scale service
                                        )
                                    );

                                    console.log(`[BLE] SCAN DEBUG: Final mightBeScale result: ${mightBeScale}`);

                                    // STRICT filtering: For scale devices, only show confirmed scales
                                    if (deviceType === "scale" && !mightBeScale) {
                                        console.log(`[BLE] SCAN: 🚫 FILTERED OUT (not a confirmed scale): "${deviceName}" (ID: ${deviceId})`);
                                        console.log(`[BLE] SCAN:   - Service UUIDs: ${scannedDevice.serviceUUIDs?.join(', ') || 'none'}`);
                                        console.log(`[BLE] SCAN:   - RSSI: ${scannedDevice.rssi}`);
                                        return prev;
                                    }

                                    if (deviceType === "scale" && mightBeScale) {
                                        console.log(`[BLE] SCAN: ✅ SCALE DETECTED: "${deviceName}" (ID: ${deviceId})`);
                                        if (deviceName.toLowerCase().includes('xh')) {
                                            console.log(`[BLE] SCAN: 🎯 XH SERIES SCALE: "${deviceName}"`);
                                        }
                                        if (deviceName.toLowerCase().includes('cf')) {
                                            console.log(`[BLE] SCAN: 🎯 CF MODEL SCALE: "${deviceName}"`);
                                        }
                                    }

                                    console.log(`[BLE] SCAN: Added device to list: ${deviceName}`);

                                    // Special logging for known devices like XH2507024006
                                    if (deviceId.includes('xh2507024006') || deviceName.includes('xh2507024006')) {
                                        console.log(`[BLE] 🎯 FOUND KNOWN SCALE: XH2507024006`);
                                        console.log(`[BLE] Device details:`, {
                                            id: scannedDevice.id,
                                            name: scannedDevice.name,
                                            rssi: scannedDevice.rssi,
                                            serviceUUIDs: scannedDevice.serviceUUIDs,
                                            manufacturerData: (scannedDevice as any).manufacturerData,
                                            isConnectable: (scannedDevice as any).isConnectable
                                        });
                                    }

                                    const deviceInfo: BLEDeviceInfo = {
                                        id: scannedDevice.id,
                                        address: scannedDevice.id, // BLE uses ID as address
                                        name: scannedDevice.name || `BLE Device ${scannedDevice.id.slice(-4)}`,
                                        serviceUUIDs: scannedDevice.serviceUUIDs,
                                        rssi: scannedDevice.rssi,
                                    };

                                    return [...prev, deviceInfo];
                                });
                            }
                        }
                    );
                } catch (scanError) {
                    console.error('[BLE] SCAN: Error starting device scan:', scanError);
                    clearTimeout(timeout);

                    if (scanError.message && scanError.message.includes('cannot start scanning operation')) {
                        Alert.alert(
                            'Scanning Failed',
                            'Unable to start Bluetooth scanning. Please ensure Bluetooth is enabled and no other app is scanning.',
                            [{ text: 'OK' }]
                        );
                    }

                    reject(scanError);
                    return;
                }
            });

            await scanPromise;

        } catch (error) {
            console.error('[BLE] SCAN: Error during scan:', error);
        } finally {
            setIsScanning(false);
            try { await ble.stopDeviceScan(); } catch { }
        }

        console.log(`[BLE] ========== BLE SCAN COMPLETED ==========`);
        console.log(`[BLE] Total devices found: ${deviceCount}`);
        console.log(`[BLE] Scales shown: ${devices.length}`);
    }, [ble, deviceType, requestBLEPermissions]);

    // Connect to BLE device
    const connectToDevice = useCallback(async (deviceId: string): Promise<BLEDeviceInfo | null> => {
        console.log(`[BLE] CONNECT: Starting connection to ${deviceId}`);
        setIsConnecting(true);
        setConnectionFailed(false);
        setLastConnectionAttempt(deviceId);
        manualDisconnectRef.current = false;

        // Find device in our device list
        const deviceInfo = devices.find(d => d.id === deviceId);
        if (!deviceInfo) {
            console.error(`Device ${deviceId} not found in device list`);
            setConnectionFailed(true);
            setIsConnecting(false);
            return null;
        }

        // Helper function to parse weight from bytes (exact copy from useBluetoothService)
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
                            try {
                                setLastMessage(weight); // Store as weight in kgs (0.01 precision)
                            } catch (setErr) {
                                console.error(`[BLE] PARSE [${source}]: Error setting last message:`, setErr);
                            }
                            return true;
                        }
                    }
                    if (bytes.length >= 4) {
                        // Try as 4-byte float
                        try {
                            // Check if bytes has a valid buffer before accessing it
                            if (bytes.buffer && bytes.byteOffset !== undefined && bytes.byteLength !== undefined) {
                                const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                                const val = view.getFloat32(0, true); // Little-endian
                                if (!isNaN(val) && isFinite(val) && val >= -1000 && val <= 100000) {
                                    console.log(`[BLE] PARSE [${source}]: ✓✓✓ Parsed from binary (4-byte float): ${val.toFixed(2)}`);
                                    try {
                                        setLastMessage(val.toFixed(2)); // Store as weight in kgs (0.01 precision)
                                    } catch (setErr) {
                                        console.error(`[BLE] PARSE [${source}]: Error setting last message:`, setErr);
                                    }
                                    return true;
                                }
                            }
                        } catch (viewErr) {
                            console.log(`[BLE] PARSE [${source}]: Error creating DataView:`, viewErr);
                        }
                    }
                }

                if (match) {
                    const val = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(val) && isFinite(val)) {
                        console.log(`[BLE] PARSE [${source}]: ✓✓✓ VALID WEIGHT PARSED: ${val.toFixed(2)}`);
                        try {
                            setLastMessage(val.toFixed(2)); // Store as weight in kgs (0.01 precision)
                            console.log(`[BLE] PARSE [${source}]: UI Updated with reading: ${val.toFixed(2)}`);
                        } catch (setErr) {
                            console.error(`[BLE] PARSE [${source}]: Error setting last message:`, setErr);
                        }
                        return true;
                    } else {
                        console.log(`[BLE] PARSE [${source}]: Parsed NaN/Infinity from: ${match[1]}`);
                    }
                } else {
                    console.log(`[BLE] PARSE [${source}]: No number pattern found in: ${JSON.stringify(asText)}`);
                }
            } catch (err) {
                console.error(`[BLE] PARSE [${source}]: Parse error:`, err);
            }
            return false;
        };

        // Get device-specific connection parameters
        const deviceProfile = Object.values(SCALE_DEVICE_PROFILES).find(profile =>
            deviceId.includes(Object.keys(SCALE_DEVICE_PROFILES).find(key =>
                deviceId.includes(key.toLowerCase())
            ) || '') ||
            deviceInfo.name?.includes(Object.keys(SCALE_DEVICE_PROFILES).find(key =>
                deviceInfo.name?.includes(key.toLowerCase())
            ) || '')
        );

        console.log(`[BLE] CONNECT: Device profile found:`, deviceProfile ? 'YES' : 'NO');
        if (deviceProfile) {
            console.log(`[BLE] CONNECT: Using profile for ${Object.keys(SCALE_DEVICE_PROFILES).find(key => deviceId.includes(key.toLowerCase()))}`);
        }

        const connectionParams = deviceProfile?.connectionParams || {
            requestMTU: 512,
            timeout: 15000,
        };

        // Connect to the device with device-specific parameters
        console.log(`[BLE] CONNECT: Connecting to BLE device with params:`, connectionParams);
        let bleDevice;
        try {
            bleDevice = await ble?.connectToDevice?.(deviceId, connectionParams);
        } catch (connectError) {
            console.error(`[BLE] CONNECT: Failed to connect to device ${deviceId}:`, connectError);
            setConnectionFailed(true);
            setIsConnecting(false);
            const errMsg = (connectError as any)?.message || String(connectError);
            Alert.alert('Connection failed', errMsg);
            return null;
        }

        console.log(`[BLE] CONNECT: Discovering services...`);
        try {
            await bleDevice.discoverAllServicesAndCharacteristics();
        } catch (discoverError) {
            console.error(`[BLE] CONNECT: Failed to discover services for device ${deviceId}:`, discoverError);
            setConnectionFailed(true);
            setIsConnecting(false);
            const errMsg = (discoverError as any)?.message || String(discoverError);
            Alert.alert('Discovery failed', `Failed to discover device services: ${errMsg}`);
            return null;
        }

        // For scale devices, set up weight characteristic monitoring
        if (deviceType === "scale") {
            console.log(`[BLE] CONNECT: Setting up weight scale monitoring for device: ${deviceInfo.name} (${deviceId})`);

            // Special handling for known devices
            if (deviceId.includes('xh2507024006') || deviceInfo.name?.includes('xh2507024006')) {
                console.log(`[BLE] CONNECT: 🎯 Setting up monitoring for XH2507024006 device`);
            }

            // Find weight characteristic
            let services;
            try {
                services = await bleDevice.services();
                console.log(`[BLE] CONNECT: Found ${services.length} services`);
            } catch (servicesError) {
                console.error(`[BLE] CONNECT: Failed to get services for device ${deviceId}:`, servicesError);
                setConnectionFailed(true);
                setIsConnecting(false);
                const errMsg = (servicesError as any)?.message || String(servicesError);
                Alert.alert('Service discovery failed', `Failed to get device services: ${errMsg}`);
                return null;
            }
            let weightCharacteristic: Characteristic | null = null;

            // First try: Look in standard weight scale services
            for (const service of services) {
                if (WEIGHT_SERVICE_UUIDS.includes(service.uuid.toLowerCase())) {
                    console.log(`[BLE] CONNECT: Checking service ${service.uuid}`);
                    const characteristics = await service.characteristics();
                    console.log(`[BLE] CONNECT: Service ${service.uuid} has ${characteristics.length} characteristics`);

                    for (const char of characteristics) {
                        console.log(`[BLE] CONNECT: Characteristic ${char.uuid} (properties: ${char.properties?.join(', ')})`);
                        if (WEIGHT_CHARACTERISTIC_UUIDS.includes(char.uuid.toLowerCase())) {
                            weightCharacteristic = char;
                            console.log(`[BLE] CONNECT: ✅ Found standard weight characteristic: ${char.uuid}`);
                            break;
                        }
                    }
                    if (weightCharacteristic) break;
                }
            }

            // Second try: If no standard characteristic found, look for any notify/indicate characteristic
            // that might contain weight data (fallback for custom scale implementations)
            if (!weightCharacteristic) {
                console.log(`[BLE] CONNECT: No standard weight characteristic found, looking for notify characteristics...`);

                for (const service of services) {
                    const characteristics = await service.characteristics();
                    for (const char of characteristics) {
                        // Look for characteristics that support notifications or indications
                        // These are likely to contain dynamic data like weight
                        if (char.isNotifiable || char.isIndicatable) {
                            console.log(`[BLE] CONNECT: Found notify/indicate characteristic: ${char.uuid} in service ${service.uuid}`);
                            // For XH2507024006 or similar devices, try the first notify characteristic
                            if (!weightCharacteristic && (deviceId.includes('xh2507024006') || deviceInfo.name?.includes('xh2507024006'))) {
                                weightCharacteristic = char;
                                console.log(`[BLE] CONNECT: 🎯 Using notify characteristic for XH2507024006: ${char.uuid}`);
                                break;
                            }
                            // For other devices, prefer characteristics that look like they might contain weight
                            if (!weightCharacteristic && (char.uuid.includes('ffe') || char.uuid.includes('2a'))) {
                                weightCharacteristic = char;
                                console.log(`[BLE] CONNECT: Using likely weight characteristic: ${char.uuid}`);
                            }
                        }
                    }
                    if (weightCharacteristic) break;
                }
            }

            if (weightCharacteristic) {
                console.log(`[BLE] CONNECT: ✅ Found weight characteristic: ${weightCharacteristic.uuid}`);
                console.log(`[BLE] CONNECT: Properties: ${weightCharacteristic.properties?.join(', ')}`);
                console.log(`[BLE] CONNECT: Setting up notifications for weight monitoring...`);

                if (deviceId.includes('xh2507024006') || deviceInfo.name?.includes('xh2507024006')) {
                    console.log(`[BLE] CONNECT: 🎯 Starting weight monitoring for XH2507024006`);
                }

                console.log(`[BLE SERVICE] 🔄 STARTING WEIGHT MONITORING on characteristic: ${weightCharacteristic.uuid}`);
                // Monitor weight changes (exact same approach as useBluetoothService)
                try {
                    notifySubRef.current = bleDevice.monitorCharacteristicForService(
                        weightCharacteristic.serviceUUID!,
                        weightCharacteristic.uuid,
                        (error, char) => {
                            console.log('[BLE] NOTIFY: 📡 NOTIFICATION CALLBACK TRIGGERED');
                            try {
                                if (error) {
                                    console.log('[BLE] NOTIFY ERROR:', error?.message || error);
                                    return;
                                }

                                if (!char) {
                                    console.log('[BLE] NOTIFY: No characteristic data received');
                                    return;
                                }

                                console.log('[BLE] NOTIFY: ✓✓✓ NOTIFICATION RECEIVED!');
                                const rawB64 = char?.value;
                                console.log(`[BLE] NOTIFY: Base64 value: ${rawB64 ? rawB64.substring(0, 50) + '...' : 'null'}`);

                                try {
                                    const bytes = rawB64 ? base64ToBytes(rawB64) : null;
                                    if (bytes) {
                                        parseWeightData(bytes, 'NOTIFY');
                                    }
                                } catch (parseErr) {
                                    console.error('[BLE] NOTIFY: Error parsing weight data:', parseErr);
                                }

                                console.log(`[BLE] NOTIFY: Full notification object:`, {
                                    uuid: char?.uuid,
                                    serviceUUID: char?.serviceUUID,
                                    value: rawB64 ? `${rawB64.substring(0, 30)}...` : null
                                });
                            } catch (callbackErr) {
                                console.error('[BLE] NOTIFY: Error in notification callback:', callbackErr);
                            }
                        }
                    );
                    console.log('[BLE] CONNECT: ✓ Notification subscription started');
                } catch (notifyErr) {
                    console.log('[BLE] CONNECT: ✗ Notification setup error:', (notifyErr as any)?.message || notifyErr);
                    // Fall back to polling if notify fails
                    console.log('[BLE] CONNECT: Falling back to polling method...');
                    weightCharacteristic = { ...weightCharacteristic, isNotifiable: false, isReadable: true };
                }

                // Set up polling if notifications failed or characteristic is not notifiable
                if (!weightCharacteristic.isNotifiable && weightCharacteristic.isReadable) {
                    console.log('[BLE] CONNECT: Using POLLING method (characteristic is readable)');
                    console.log(`[BLE] CONNECT: Service UUID: ${weightCharacteristic.serviceUUID}`);
                    console.log(`[BLE] CONNECT: Characteristic UUID: ${weightCharacteristic.uuid}`);
                    console.log('[BLE] CONNECT: Polling every 250ms...');

                    let pollCount = 0;
                    let isPollingActive = true;
                    const interval = setInterval(async () => {
                        if (!isPollingActive) {
                            clearInterval(interval);
                            return;
                        }

                        pollCount++;
                        try {
                            // Check if device is still connected before reading
                            if (!bleDevice || !(bleDevice as any).isConnected) {
                                console.log(`[BLE] POLL #${pollCount}: Device not connected, stopping poll`);
                                isPollingActive = false;
                                clearInterval(interval);
                                return;
                            }

                            const c = await bleDevice.readCharacteristicForService(weightCharacteristic!.serviceUUID!, weightCharacteristic!.uuid);
                            console.log(`[BLE] POLL #${pollCount}: ✓ Read successful`);

                            const rawB64 = c?.value;
                            console.log(`[BLE] POLL #${pollCount}: Base64 value: ${rawB64 ? rawB64.substring(0, 50) + '...' : 'null'}`);

                            try {
                                const bytes = rawB64 ? base64ToBytes(rawB64) : null;
                                if (bytes) {
                                    parseWeightData(bytes, `POLL #${pollCount}`);
                                }
                            } catch (parseErr) {
                                console.error(`[BLE] POLL #${pollCount}: Error parsing weight data:`, parseErr);
                            }

                            if (pollCount % 20 === 0) {
                                console.log(`[BLE] POLL #${pollCount}: Still polling (no data yet, this is OK)`);
                            }
                        } catch (err) {
                            const errMsg = (err as any)?.message || String(err);
                            console.log(`[BLE] POLL #${pollCount}: ERROR:`, errMsg);
                            if (errMsg?.includes('disconnected') || errMsg?.includes('not connected')) {
                                isPollingActive = false;
                                clearInterval(interval);
                                console.log('[BLE] POLL: Device disconnected, stopping poll');
                            }
                        }
                    }, 250);

                    // Store interval cleanup in notifySubRef (exact match with ScaleTestScreen)
                    notifySubRef.current = {
                        remove: () => {
                            isPollingActive = false;
                            clearInterval(interval);
                            console.log('[BLE] POLL: Polling stopped');
                        }
                    };
                    console.log('[BLE] CONNECT: ✓ Polling started');
                }
            } else {
                console.warn('[BLE] CONNECT: No weight characteristic found - device may not send weight data via BLE');
                console.warn('[BLE] CONNECT: Available services and characteristics:');

                // Log all available services and characteristics for debugging
                for (const service of services) {
                    console.warn(`[BLE] CONNECT: Service: ${service.uuid}`);
                    try {
                        const characteristics = await service.characteristics();
                        for (const char of characteristics) {
                            console.warn(`[BLE] CONNECT:   Characteristic: ${char.uuid} (${char.properties?.join(', ')})`);
                        }
                    } catch (e) {
                        console.warn(`[BLE] CONNECT:   Could not read characteristics for service ${service.uuid}`);
                    }
                }
            }
        }

        // Update connected device state
        const connectedDeviceInfo: BLEDeviceInfo = {
            id: bleDevice.id,
            address: bleDevice.id,
            name: bleDevice.name || deviceInfo.name,
            serviceUUIDs: bleDevice.serviceUUIDs,
            rssi: bleDevice.rssi
        };

        setConnectedDevice(connectedDeviceInfo);

        // Monitor connection status to handle disconnections gracefully
        connectionMonitorRef.current = setInterval(async () => {
            try {
                if (connectedDeviceInfo && !manualDisconnectRef.current) {
                    const isStillConnected = await bleDevice.isConnected();
                    if (!isStillConnected) {
                        console.log('[BLE] MONITOR: Device disconnected unexpectedly');
                        cleanupBLE();
                        setConnectedDevice(null);
                        setLastMessage(null);
                    }
                }
            } catch (error) {
                console.error('[BLE] MONITOR: Error checking connection status:', error);
                // If we can't check the connection, assume it's disconnected
                cleanupBLE();
                setConnectedDevice(null);
                setLastMessage(null);
            }
        }, 2000); // Check every 2 seconds

        console.log(`[BLE] CONNECT: ✓ Successfully connected to ${connectedDeviceInfo.name}`);
        setIsConnecting(false);
        return connectedDeviceInfo;
    }, [ble, devices, deviceType]);

    // Disconnect from BLE device
    const disconnect = useCallback(async (): Promise<void> => {
        console.log('[BLE] DISCONNECT: Starting disconnect...');
        manualDisconnectRef.current = true;

        try {
            if (connectedDevice) {
                await ble.cancelDeviceConnection(connectedDevice.id);
                console.log('[BLE] DISCONNECT: ✓ Disconnected from device');
            }
        } catch (error) {
            console.error('[BLE] DISCONNECT: Error during disconnect:', error);
        } finally {
            cleanupBLE();
            setConnectedDevice(null);
            setLastMessage(null);
        }
    }, [ble, connectedDevice, cleanupBLE]);

    return {
        devices,
        connectedDevice,
        isScanning,
        isConnecting,
        lastMessage,
        scanForDevices,
        connectToDevice,
        disconnect,
        connectionFailed,
        lastConnectionAttempt,
    };
}

export default useBLEService;
