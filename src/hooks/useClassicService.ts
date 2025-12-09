import { useEffect, useState, useCallback, useRef } from "react";
import RNBluetoothClassic, { BluetoothDevice as ClassicBluetoothDevice, BluetoothEventSubscription } from "react-native-bluetooth-classic";
import { Platform, Alert, PermissionsAndroid } from "react-native";

type ClassicDeviceInfo = {
    id: string;
    address: string;
    name?: string;
    rssi?: number;
};

type UseClassicServiceProps = {
    deviceType?: "scale" | "printer";
};

type UseClassicServiceReturn = {
    devices: ClassicDeviceInfo[];
    connectedDevice: ClassicDeviceInfo | null;
    isScanning: boolean;
    isConnecting: boolean;
    lastMessage: string | null;
    scanForDevices: () => Promise<void>;
    connectToDevice: (id: string) => Promise<ClassicDeviceInfo | null>;
    disconnect: () => Promise<void>;
    connectionFailed: boolean;
    lastConnectionAttempt: string | null;
    printText?: (text: string) => Promise<void>;
    printRaw?: (bytes: Uint8Array | number[]) => Promise<void>;
};

function useClassicService({
    deviceType = "scale",
}: UseClassicServiceProps = {}): UseClassicServiceReturn {
    const [devices, setDevices] = useState<ClassicDeviceInfo[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<ClassicDeviceInfo | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [lastMessage, setLastMessage] = useState<string | null>(null);
    const [connectionFailed, setConnectionFailed] = useState(false);
    const [lastConnectionAttempt, setLastConnectionAttempt] = useState<string | null>(null);

    const subscriptionRef = useRef<BluetoothEventSubscription | null>(null);
    const readIntervalRef = useRef<any>(null);
    const connectionMonitorRef = useRef<any>(null);
    const manualDisconnectRef = useRef<boolean>(false);
    const autoConnectHasRunRef = useRef<boolean>(false);

    // Cleanup Classic Bluetooth
    const cleanupClassic = useCallback(() => {
        try {
            subscriptionRef.current?.remove?.();
        } catch { }
        subscriptionRef.current = null;

        if (readIntervalRef.current) {
            clearInterval(readIntervalRef.current);
            readIntervalRef.current = null;
        }

        if (connectionMonitorRef.current) {
            clearInterval(connectionMonitorRef.current);
            connectionMonitorRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupClassic();
        };
    }, [cleanupClassic]);

    // Request Classic Bluetooth permissions
    const requestClassicPermissions = useCallback(async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;
        try {
            console.log('[CLASSIC] Requesting Classic Bluetooth permissions...');

            const permissionsToRequest = Platform.Version >= 31
                ? [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]
                : [
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
                ];

            const result = await PermissionsAndroid?.requestMultiple?.(permissionsToRequest);
            console.log('[CLASSIC] Permission results:', result);

            const allGranted = Object.values(result).every(v => v === PermissionsAndroid.RESULTS.GRANTED);

            if (!allGranted) {
                Alert.alert(
                    'Permissions Required',
                    'Location permissions are required for Classic Bluetooth device discovery.',
                    [{ text: 'OK' }]
                );
            }

            return allGranted;
        } catch (e) {
            console.error('[CLASSIC] Error requesting permissions:', e);
            return false;
        }
    }, []);

    // Ensure Bluetooth is enabled
    const ensureBluetoothEnabled = useCallback(async (): Promise<boolean> => {
        try {
            const enabled = RNBluetoothClassic?.isBluetoothEnabled
                ? await RNBluetoothClassic.isBluetoothEnabled()
                : false;
            if (!enabled) {
                if (Platform.OS === "android") {
                    const result = await RNBluetoothClassic?.requestBluetoothEnabled();
                    if (!result) {
                        Alert.alert("Bluetooth Disabled", "Please enable Bluetooth first.");
                        return false;
                    }
                }
            }
            return true;
        } catch (error) {
            console.warn("Classic Bluetooth enable check failed:", error);
            return false;
        }
    }, []);

    // Scan for Classic Bluetooth devices
    const scanForDevices = useCallback(async (): Promise<void> => {
        console.log('[CLASSIC] ========== CLASSIC SCAN STARTED ==========');

        try {
            const permissionsGranted = await requestClassicPermissions();
            if (!permissionsGranted) {
                console.log('[CLASSIC] SCAN: Permissions not granted, aborting');
                return;
            }

            const enabled = await ensureBluetoothEnabled();
            if (!enabled) {
                console.log('[CLASSIC] SCAN: Bluetooth not enabled, aborting');
                return;
            }

            setIsScanning(true);
            setDevices([]);

            console.log('[CLASSIC] SCAN STEP 1: Starting Classic Bluetooth scan...');

            let deviceMap: Record<string, ClassicBluetoothDevice> = {};

            try {
                // Get paired devices first
                const pairedDevices = await RNBluetoothClassic.getBondedDevices();
                console.log(`[CLASSIC] SCAN: Found ${pairedDevices.length} paired devices`);

                for (const device of pairedDevices) {
                    deviceMap[device.address] = device;
                    console.log(`[CLASSIC] SCAN: Paired device: ${device.name} (${device.address})`);
                }

                // Try to discover new devices (if supported by the library)
                try {
                    console.log(`[CLASSIC] SCAN: Attempting to discover unpaired devices...`);
                    // Note: RNBluetoothClassic may not support device discovery
                    // This depends on the library implementation
                } catch (discoveryError) {
                    console.log(`[CLASSIC] SCAN: Device discovery not available:`, discoveryError);
                }

                // Convert to our device format
                let classicDevices: ClassicDeviceInfo[] = Object.values(deviceMap).map(device => ({
                    id: device.address,
                    address: device.address,
                    name: device.name || `Classic Device ${device.address.slice(-4)}`,
                    rssi: device.rssi,
                }));

                // Enhanced scale detection for Classic Bluetooth
                if (deviceType === "scale") {
                    classicDevices = classicDevices.filter(device => {
                        const deviceName = (device.name || '').toLowerCase();
                        const deviceAddress = device.address.toLowerCase();

                        // STRICT scale device filtering - only confirmed scales
                        const knownScaleDevices = [
                            // Specific device IDs mentioned by user
                            'h05', 'cf', 'xh250', 'xh2507024006',
                            // Known scale brands
                            'beurer scale', 'seca scale', 'omron scale',
                            'tanita scale', 'withings scale',
                        ];

                        // STRICT scale device patterns
                        const scaleDevicePatterns = [
                            /^xh\d{1,}/i,  // XH250, XH25, XH2, etc. (at least 1 digit)
                            /^h\d{2,}/i,   // H05, etc.
                            /^cf/i,        // CF model
                        ];

                        const mightBeScale =
                            // Exact known scale device matches
                            knownScaleDevices.some(knownDevice =>
                                deviceName.includes(knownDevice.toLowerCase()) ||
                                deviceAddress.includes(knownDevice.toLowerCase())
                            ) ||
                            // Specific device pattern matching (name or address)
                            scaleDevicePatterns.some(pattern =>
                                pattern.test(deviceName) || pattern.test(deviceAddress)
                            ) ||
                            // Check for XH anywhere in name (case-insensitive)
                            deviceName.includes('xh') ||
                            // Check for CF anywhere in name (case-insensitive)
                            deviceName.includes('cf') ||
                            // Must contain "scale" in the name (very strict)
                            deviceName.includes('scale');

                        if (mightBeScale) {
                            console.log(`[CLASSIC] SCAN: ✅ SCALE DETECTED: "${deviceName}" (${deviceAddress})`);
                        } else {
                            console.log(`[CLASSIC] SCAN: 🚫 FILTERED OUT (not a confirmed scale): "${deviceName}" (${deviceAddress})`);
                        }
                        return mightBeScale;
                    });
                }

                console.log(`[CLASSIC] SCAN: Final device list: ${classicDevices.length} devices`);
                setDevices(classicDevices);

            } catch (pairedError) {
                console.error('[CLASSIC] SCAN: Error getting paired devices:', pairedError);
            }

        } catch (error) {
            console.error('[CLASSIC] SCAN: Error during scan:', error);
        } finally {
            setIsScanning(false);
        }

        console.log('[CLASSIC] ========== CLASSIC SCAN COMPLETED ==========');
        console.log(`[CLASSIC] Scales shown: ${classicDevices.length}`);
    }, [ensureBluetoothEnabled]);

    // Connect to Classic Bluetooth device
    const connectToDevice = useCallback(async (deviceId: string): Promise<ClassicDeviceInfo | null> => {
        console.log(`[CLASSIC] CONNECT: Starting connection to ${deviceId}`);
        setIsConnecting(true);
        setConnectionFailed(false);
        setLastConnectionAttempt(deviceId);
        manualDisconnectRef.current = false;

        try {
            // Find device in our device list
            const deviceInfo = devices.find(d => d.id === deviceId);
            if (!deviceInfo) {
                throw new Error(`Device ${deviceId} not found in device list`);
            }

            // Connect to the device
            console.log(`[CLASSIC] CONNECT: Connecting to Classic Bluetooth device...`);
            const classicDevice = await RNBluetoothClassic.connectToDevice(deviceId, {
                delimiter: '\r\n', // Common delimiter for serial devices
            });

            console.log(`[CLASSIC] CONNECT: Connected, setting up data monitoring...`);

            // Set up data monitoring for scale devices
            if (deviceType === "scale") {
                // Set up read interval for continuous data reading
                readIntervalRef.current = setInterval(async () => {
                    try {
                        if (classicDevice && await classicDevice.isConnected()) {
                            const data = await classicDevice.read();
                            if (data) {
                                const message = data.trim();
                                console.log(`[CLASSIC] READ: Received data: "${message}"`);

                                // Parse weight data (assuming format like "123.45 kg" or just "123.45")
                                const weightMatch = message.match(/(\d+\.?\d*)/);
                                if (weightMatch) {
                                    const weight = parseFloat(weightMatch[1]);
                                    if (!isNaN(weight)) {
                                        const weightStr = weight.toFixed(2);
                                        console.log(`[CLASSIC] READ: Parsed weight: ${weightStr} kg`);
                                        setLastMessage(weightStr);
                                    }
                                }
                            }
                        }
                    } catch (readError) {
                        console.error('[CLASSIC] READ: Error reading data:', readError);
                    }
                }, 500); // Read every 500ms
            }

            // Update connected device state
            const connectedDeviceInfo: ClassicDeviceInfo = {
                id: classicDevice.address,
                address: classicDevice.address,
                name: classicDevice.name || deviceInfo.name,
                rssi: classicDevice.rssi,
            };

            setConnectedDevice(connectedDeviceInfo);

            // Monitor connection status to handle disconnections gracefully
            connectionMonitorRef.current = setInterval(async () => {
                try {
                    if (connectedDeviceInfo && !manualDisconnectRef.current) {
                        const isStillConnected = await classicDevice.isConnected();
                        if (!isStillConnected) {
                            console.log('[CLASSIC] MONITOR: Device disconnected unexpectedly');
                            cleanupClassic();
                            setConnectedDevice(null);
                            setLastMessage(null);
                        }
                    }
                } catch (error) {
                    console.error('[CLASSIC] MONITOR: Error checking connection status:', error);
                    // If we can't check the connection, assume it's disconnected
                    cleanupClassic();
                    setConnectedDevice(null);
                    setLastMessage(null);
                }
            }, 2000); // Check every 2 seconds

            console.log(`[CLASSIC] CONNECT: ✓ Successfully connected to ${connectedDeviceInfo.name}`);
            return connectedDeviceInfo;

        } catch (error) {
            console.error(`[CLASSIC] CONNECT: Error connecting to device ${deviceId}:`, error);
            setConnectionFailed(true);

            // Provide helpful error messages
            if (error.message && error.message.includes('Device is already connected')) {
                Alert.alert(
                    'Device Already Connected',
                    'This device is already connected to another app or device. Please disconnect it first and try again.',
                    [{ text: 'OK' }]
                );
            } else if (error.message && (error.message.includes('Device not found') || error.message.includes('not available'))) {
                Alert.alert(
                    'Device Not Found',
                    'The device could not be found. Make sure it\'s turned on, paired, and in range.',
                    [{ text: 'OK' }]
                );
            }

            return null;
        } finally {
            setIsConnecting(false);
        }
    }, [devices, deviceType]);

    // Disconnect from Classic Bluetooth device
    const disconnect = useCallback(async (): Promise<void> => {
        console.log('[CLASSIC] DISCONNECT: Starting disconnect...');
        manualDisconnectRef.current = true;

        try {
            if (connectedDevice) {
                await RNBluetoothClassic.disconnectFromDevice(connectedDevice.id);
                console.log('[CLASSIC] DISCONNECT: ✓ Disconnected from device');
            }
        } catch (error) {
            console.error('[CLASSIC] DISCONNECT: Error during disconnect:', error);
        } finally {
            cleanupClassic();
            setConnectedDevice(null);
            setLastMessage(null);
        }
    }, [connectedDevice, cleanupClassic]);

    // Print functions for printers
    const printText = useCallback(async (text: string): Promise<void> => {
        if (!connectedDevice) {
            throw new Error('No printer connected');
        }

        try {
            console.log('[CLASSIC] PRINT: Sending text to printer...');
            await RNBluetoothClassic.writeToDevice(connectedDevice.id, text);
            console.log('[CLASSIC] PRINT: ✓ Text sent to printer');
        } catch (error) {
            console.error('[CLASSIC] PRINT: Error printing text:', error);
            throw error;
        }
    }, [connectedDevice]);

    const printRaw = useCallback(async (bytes: Uint8Array | number[]): Promise<void> => {
        if (!connectedDevice) {
            throw new Error('No printer connected');
        }

        try {
            console.log('[CLASSIC] PRINT: Sending raw bytes to printer...');
            const data = Array.isArray(bytes) ? bytes : Array.from(bytes);
            await RNBluetoothClassic.writeToDevice(connectedDevice.id, data);
            console.log('[CLASSIC] PRINT: ✓ Raw bytes sent to printer');
        } catch (error) {
            console.error('[CLASSIC] PRINT: Error printing raw bytes:', error);
            throw error;
        }
    }, [connectedDevice]);

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
        printText: deviceType === "printer" ? printText : undefined,
        printRaw: deviceType === "printer" ? printRaw : undefined,
    };
}

export default useClassicService;
