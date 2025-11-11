import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { BleManager, Device as BLEDevice, Characteristic } from "react-native-ble-plx";
import RNBluetoothClassic, { BluetoothDevice as ClassicBluetoothDevice, BluetoothEventSubscription } from "react-native-bluetooth-classic";
import { setItem, getItem } from "../components/utils/local-storage";
import { Platform, PermissionsAndroid, Alert } from "react-native";
import filterBluetoothDevices from "../components/utils/device-filter";

type DeviceType = "scale" | "printer";

// Unified device type - supports both BLE and Classic
type UnifiedDevice = {
    id: string;
    address: string;
    name?: string;
    type: 'ble' | 'classic';
    bleDevice?: BLEDevice;
    classicDevice?: ClassicBluetoothDevice;
    serviceUUIDs?: string[];
    rssi?: number;
};

const WEIGHT_SERVICE_UUIDS = [
    '181d', // Weight Scale Service (official)
];
const WEIGHT_CHARACTERISTIC_UUIDS = [
    '2a9d', // Weight Measurement (official)
];

// Helper functions for BLE data parsing (exact copy from ScaleTestScreen)
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

type UseBluetoothServiceProps = {
    deviceType?: DeviceType;
};

type UseBluetoothServiceReturn = {
    devices: UnifiedDevice[];
    connectedDevice: UnifiedDevice | null;
    isScanning: boolean;
    isConnecting: boolean;
    lastMessage: string | null; // Weight in kgs (0.01 precision)
    scanForDevices: () => Promise<void>;
    connectToDevice: (id: string) => Promise<UnifiedDevice | null>;
    disconnect: () => Promise<void>;
    connectionFailed: boolean;
    lastConnectionAttempt: string | null;
    printText?: (text: string) => Promise<void>;
    printRaw?: (bytes: Uint8Array | number[]) => Promise<void>;
};

export default function useBluetoothService({
    deviceType = "scale",
}: UseBluetoothServiceProps = {}): UseBluetoothServiceReturn {
    // ========== BLE STATE (PRIMARY) ==========
    const ble = useMemo(() => new BleManager(), []);
    const [bleDevices, setBleDevices] = useState<BLEDevice[]>([]);
    const notifySubRef = useRef<any>(null); // BLE notification subscription

    // ========== CLASSIC BLUETOOTH STATE (SECONDARY - SEPARATE) ==========
    const [classicDevices, setClassicDevices] = useState<ClassicBluetoothDevice[]>([]);
    const classicSubscriptionRef = useRef<BluetoothEventSubscription | null>(null);
    const classicReadIntervalRef = useRef<any>(null);

    // ========== UNIFIED STATE ==========
    const [devices, setDevices] = useState<UnifiedDevice[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<UnifiedDevice | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [lastMessage, setLastMessage] = useState<string | null>(null); // Weight in kgs
    const [connectionFailed, setConnectionFailed] = useState(false);
    const [lastConnectionAttempt, setLastConnectionAttempt] = useState<string | null>(null);

    // Track if user manually disconnected to prevent auto-reconnect
    const manualDisconnectRef = useRef<boolean>(false);
    const autoConnectHasRunRef = useRef<boolean>(false);

    // 🧹 Cleanup BLE
    const cleanupBLE = useCallback(() => {
        try { notifySubRef.current?.remove?.(); } catch {}
        notifySubRef.current = null;
    }, []);

    // 🧹 Cleanup Classic Bluetooth (separate function)
    const cleanupClassic = useCallback(() => {
        try {
            classicSubscriptionRef.current?.remove?.();
        } catch {}
        classicSubscriptionRef.current = null;

        if (classicReadIntervalRef.current) {
            clearInterval(classicReadIntervalRef.current);
            classicReadIntervalRef.current = null;
        }
    }, []);

    // 🧹 Cleanup all on unmount
    useEffect(() => {
        return () => {
            cleanupBLE();
            cleanupClassic();
            try { ble?.destroy?.(); } catch {}
        };
    }, [ble, cleanupBLE, cleanupClassic]);

    // 🔒 Request permissions for BLE
    const requestBLEPermissions = useCallback(async (): Promise<boolean> => {
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

    // 🔒 Ensure Bluetooth is enabled for Classic
    const ensureClassicBluetoothEnabled = useCallback(async (): Promise<boolean> => {
        try {
            const enabled = await RNBluetoothClassic.isBluetoothEnabled();
            if (!enabled) {
                if (Platform.OS === "android") {
                    const result = await RNBluetoothClassic.requestBluetoothEnabled();
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

    // 🔍 Scan for Classic Bluetooth devices (SEPARATE FUNCTION)
    const scanClassicDevices = useCallback(async (): Promise<void> => {
        console.log('[CLASSIC] ========== CLASSIC SCAN STARTED ==========');
        
        try {
            const enabled = await ensureClassicBluetoothEnabled();
            if (!enabled) {
                console.log('[CLASSIC] SCAN: Bluetooth not enabled, aborting');
                return;
            }

            console.log('[CLASSIC] SCAN STEP 1: Starting Classic Bluetooth scan...');
            
            let classicDeviceMap: Record<string, ClassicBluetoothDevice> = {};
            
            try {
                // Get bonded devices
                const bonded = await RNBluetoothClassic.getBondedDevices();
                
                // Try to discover devices
                let discovered: any[] = [];
                try {
                    discovered = (await (RNBluetoothClassic as any).startDiscovery?.()) || [];
                } catch (e) {
                    console.warn("[CLASSIC] SCAN: Classic discovery failed:", e);
                } finally {
                    await (RNBluetoothClassic as any).cancelDiscovery?.();
                }

                const allClassic = [...bonded, ...discovered];
                const unique: Record<string, any> = {};
                allClassic.forEach((d) => {
                    const key = (d?.address || d?.id || "").toLowerCase();
                    if (key && !unique[key]) unique[key] = d;
                });

                // Filter devices based on deviceType
                const filtered = await filterBluetoothDevices(Object.values(unique), deviceType);
                setClassicDevices(filtered);
                
                filtered.forEach((d) => {
                    classicDeviceMap[(d.address || d.id || "").toLowerCase()] = d;
                });
                
                console.log(`[CLASSIC] SCAN: Found ${filtered.length} Classic device(s)`);
            } catch (error) {
                console.error("[CLASSIC] SCAN: Classic scan error:", error);
            }

            // Add Classic devices to unified list
            setDevices(prev => {
                const existingIds = new Set(prev.map(d => d.id.toLowerCase()));
                const newClassicDevices: UnifiedDevice[] = [];
                
                Object.values(classicDeviceMap).forEach((d) => {
                    const deviceId = (d.address || d.id || "").toLowerCase();
                    if (!existingIds.has(deviceId)) {
                        newClassicDevices.push({
                            id: d.address || d.id || '',
                            address: d.address || d.id || '',
                            name: d.name,
                            type: 'classic',
                            classicDevice: d,
                        });
                        existingIds.add(deviceId);
                    }
                });
                
                return [...prev, ...newClassicDevices];
            });
            
            console.log('[CLASSIC] ========== CLASSIC SCAN COMPLETE ==========');
        } catch (error) {
            console.error('[CLASSIC] SCAN: Error:', error);
        }
    }, [deviceType, ensureClassicBluetoothEnabled]);

    // Helper function to check if BLE device is a scale
    const isBLEScaleDevice = useCallback((device: BLEDevice): boolean => {
        // Check if device has Weight Scale Service (0x181d)
        const hasWeightService = device.serviceUUIDs?.some(serviceUUID => {
            // Check for weight scale service UUID (can be in various formats)
            const normalized = serviceUUID.toLowerCase().replace(/-/g, '');
            return normalized.includes('181d') || WEIGHT_SERVICE_UUIDS.some(wsu => normalized.includes(wsu.toLowerCase().replace(/-/g, '')));
        });
        
        if (hasWeightService) {
            console.log(`[BLE] SCAN FILTER: ✓ Device has Weight Scale Service: ${device.name || device.id}`);
            return true;
        }
        
        // Check device name for scale keywords (only if deviceType is 'scale')
        if (deviceType === 'scale') {
            const scaleKeywords = [
                'scale', 'weight', 'weigh', 'weighing', 'balance', 'gram', 'kg', 'lb',
                'digital', 'precision', 'measure',
                'crane', 'hanging', 'hook', 'ocs', 'ocs-', 'dyna', 'dynamometer', 'kern', 'sf-', 'yh', 'yw',
                'hc-05', 'hc-06', 'hc05', 'hc06', 'esp32', 'arduino', 'at-', 'linvor', 'jdy', 'zs-040'
            ];
            
            const deviceName = (device.name || '').toLowerCase();
            const nameMatch = scaleKeywords.some(keyword => deviceName.includes(keyword));
            
            // Check for XH-series scales (e.g., "xh2507024006")
            const xhSeriesMatch = /^xh[0-9]+/i.test(device.name || '');
            
            // Check for OCS series
            const ocsSeriesMatch = /^(ocs-?|oc-)/i.test(device.name || '');
            
            if (nameMatch || xhSeriesMatch || ocsSeriesMatch) {
                console.log(`[BLE] SCAN FILTER: ✓ Device name matches scale pattern: ${device.name || device.id}`);
                return true;
            }
        }
        
        return false;
    }, [deviceType]);

    // 🔍 Scan for BLE devices (PRIMARY - filtered for scale devices only)
    const scanBLEDevices = useCallback(async (): Promise<void> => {
        console.log('[BLE] ========== BLE SCAN STARTED ==========');
        const ok = await requestBLEPermissions();
        if (!ok) {
            console.log('[BLE] SCAN: Permissions denied, aborting');
            Alert.alert('Permissions required', 'Bluetooth and Location permissions are required.');
            return;
        }
        console.log('[BLE] SCAN STEP 1: Permissions granted');
        
        console.log('[BLE] SCAN STEP 2: Starting BLE device scan (15 seconds)...');
        console.log('[BLE] SCAN FILTER: Only scanning for scale devices...');
        
        const seen: Record<string, boolean> = {};
        let deviceCount = 0;
        let filteredCount = 0;
        
        const sub: any = ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
            if (error) {
                console.log('[BLE] SCAN ERROR:', (error as any)?.message || error);
                try { (sub as any)?.remove?.(); } catch {}
                return;
            }
            if (!device) return;
            const key = (device.id || device.name || '').toString();
            if (!seen[key]) {
                seen[key] = true;
                deviceCount++;
                
                // Filter: Only include scale devices
                if (deviceType === 'scale' && !isBLEScaleDevice(device)) {
                    console.log(`[BLE] SCAN FILTER: ✗ Excluding non-scale device: ${device.name || 'Unnamed'} (${device.id})`);
                    return;
                }
                
                filteredCount++;
                console.log(`[BLE] SCAN STEP 2: Found scale device #${filteredCount}:`, {
                    name: device.name || 'Unnamed',
                    id: device.id,
                    services: device.serviceUUIDs || [],
                    rssi: device.rssi,
                    isConnectable: device.isConnectable
                });
                
                // Add to BLE devices list
                setBleDevices(prev => [...prev, device]);
                
                // Add to unified devices list
                const unifiedDevice: UnifiedDevice = {
                    id: device.id,
                    address: device.id,
                    name: device.name || undefined,
                    type: 'ble',
                    bleDevice: device,
                    serviceUUIDs: device.serviceUUIDs || undefined,
                    rssi: device.rssi || undefined,
                };
                setDevices(prev => {
                    // Avoid duplicates
                    if (prev.some(d => d.id.toLowerCase() === device.id.toLowerCase())) {
                        return prev;
                    }
                    return [...prev, unifiedDevice];
                });
            }
        });
        
        // Stop scan after 15s (matching ScaleTestScreen)
        setTimeout(() => {
            try { (sub as any)?.remove?.(); } catch {}
            console.log(`[BLE] SCAN STEP 3: BLE scan complete. Found ${deviceCount} total device(s), ${filteredCount} scale device(s)`);
            console.log('[BLE] ========== BLE SCAN COMPLETE ==========');
        }, 15000);
    }, [ble, requestBLEPermissions, deviceType, isBLEScaleDevice]);

    // 🔍 Unified scan - scans both BLE (primary) and Classic (secondary)
    const scanForDevices = useCallback(async () => {
        console.log('[UNIFIED] ========== UNIFIED SCAN STARTED ==========');
        
        setIsScanning(true);
        setDevices([]);
        setBleDevices([]);
        setClassicDevices([]);

        if (deviceType === "printer") {
            console.log('[UNIFIED] SCAN: Printer mode detected, scanning Classic devices only');
            await scanClassicDevices();
            setIsScanning(false);
            console.log('[UNIFIED] ========== PRINTER SCAN COMPLETE ==========');
            return;
        }

        // Scan BLE first (primary)
        await scanBLEDevices();
        
        // Scan Classic second (secondary) - run in parallel after a short delay
        setTimeout(() => {
            scanClassicDevices().finally(() => {
                setIsScanning(false);
                console.log('[UNIFIED] ========== UNIFIED SCAN COMPLETE ==========');
            });
        }, 500);
        
        // Also stop scanning flag after BLE scan completes
        setTimeout(() => {
            setIsScanning(false);
        }, 15500); // Slightly longer than BLE scan
    }, [deviceType, scanBLEDevices, scanClassicDevices]);

    // 🔗 Connect to Classic Bluetooth device (SEPARATE FUNCTION - SECONDARY)
    const connectClassicDevice = useCallback(async (
        id: string,
        device: ClassicBluetoothDevice
    ): Promise<UnifiedDevice | null> => {
        console.log('[CLASSIC] ========== CLASSIC CONNECT STARTED ==========');
        console.log('[CLASSIC] CONNECT: Target device:', device.name || 'Unnamed', 'address:', device.address || id);
        setIsConnecting(true);
        setConnectionFailed(false);
        setLastConnectionAttempt(new Date().toISOString());
        
        try {
            const enabled = await ensureClassicBluetoothEnabled();
            if (!enabled) {
                setIsConnecting(false);
                return null;
            }

            await RNBluetoothClassic.cancelDiscovery().catch(() => {});

            // Check if device is paired
            const bonded = await RNBluetoothClassic.getBondedDevices();
            if (!bonded.some((b) => b.address === id)) {
                Alert.alert("Device not paired", "Please pair your scale manually in Bluetooth settings first.");
                setIsConnecting(false);
                return null;
            }

            console.log('[CLASSIC] CONNECT STEP 1: Connecting to Classic device...');
            let classicDevice = await RNBluetoothClassic.connectToDevice(id);

            // Wait until socket fully opens
            for (let i = 0; i < 5; i++) {
                const connected = await classicDevice.isConnected();
                if (connected) {
                    console.log('[CLASSIC] CONNECT STEP 1: ✓ Verified connection established');
                    break;
                }
                console.log(`[CLASSIC] CONNECT: ⏳ Waiting for socket open... (${i + 1}/5)`);
                await new Promise<void>((r) => setTimeout(r, 500));
            }

            const stillConnected = await classicDevice.isConnected();
            if (!stillConnected) {
                throw new Error("Failed to establish stable RFCOMM connection");
            }

            console.log('[CLASSIC] CONNECT STEP 1: ✓ Device connected:', classicDevice.name || classicDevice.address);

            // Store device info permanently with type 'classic'
            const deviceInfo = {
                id: classicDevice.address || id,
                address: classicDevice.address || id,
                name: classicDevice.name || undefined,
                type: 'classic' as const,
                address_or_id: classicDevice.address || id,
                saved_at: new Date().toISOString()
            };
            await setItem(`last_device_${deviceType}`, deviceInfo);
            console.log('[CLASSIC] CONNECT: Device saved permanently:', deviceInfo);

            // Setup event listener for data
            try {
                classicDevice?.onDataReceived((event) => {
                    console.log('[CLASSIC] DATA: Incoming data:', event?.data);
                    const raw = String(event?.data || "").trim();
                    if (!raw) return;

                    // Skip device name frames
                    if (/^xh\d+\s*$/i.test(raw)) {
                        console.log('[CLASSIC] DATA: Skipping device name frame');
                        return;
                    }

                    // Try to parse weight from data
                    const parseScaleData = (rawData: string) => {
                        const s = String(rawData).trim();
                        // Try format: "CODE1,CODE2: 45.23 KG" or "45.23 KG"
                        const re = /^([A-Z]{1,4})(?:,([A-Z]{1,4}))?[\s:,-]*([0-9]+(?:[.,][0-9]+)?)\s*KG/i;
                        const m = s.match(re);
                        if (m) {
                            const weight = parseFloat(m[3].replace(",", "."));
                            return weight.toFixed(2);
                        }
                        const fallback = s.match(/([0-9]+(?:[.,][0-9]+)?)\s*KG/i);
                        if (fallback) {
                            const num = parseFloat(fallback[1].replace(",", "."));
                            return num.toFixed(2);
                        }
                        // Try any number
                        const numberOnly = s.match(/([-+]?[0-9]+(?:[.,][0-9]+)?)/);
                        if (numberOnly) {
                            const n = parseFloat(numberOnly[1].replace(",", "."));
                            if (!isNaN(n) && isFinite(n) && n > 0) {
                                return n.toFixed(2);
                            }
                        }
                        return null;
                    };

                    const weightString = parseScaleData(raw);
                    if (weightString) {
                        console.log(`[CLASSIC] DATA: ✓✓✓ VALID WEIGHT PARSED: ${weightString}`);
                        setLastMessage(weightString);
                    }
                });
                console.log('[CLASSIC] CONNECT: Device listener set successfully');
            } catch (err) {
                console.warn('[CLASSIC] CONNECT: Failed to attach read listener:', err);
            }

            // Start polling (Classic scales usually need polling)
            console.log('[CLASSIC] CONNECT: Starting polling (100ms interval)...');
            const pollInterval = setInterval(async () => {
                try {
                    if (!classicDevice || !(await classicDevice.isConnected())) {
                        console.log('[CLASSIC] POLL: Device disconnected, stopping poll');
                        clearInterval(pollInterval);
                        return;
                    }

                    const data = await (classicDevice as any).read?.();
                    if (data) {
                        console.log('[CLASSIC] POLL: Read result:', JSON.stringify(data));
                        const raw = String(data || "").trim();
                        if (raw && !/^xh\d+\s*$/i.test(raw)) {
                            const numberOnly = raw.match(/([-+]?[0-9]+(?:[.,][0-9]+)?)/);
                            if (numberOnly) {
                                const n = parseFloat(numberOnly[1].replace(",", "."));
                                if (!isNaN(n) && isFinite(n) && n > 0) {
                                    setLastMessage(n.toFixed(2));
                                }
                            }
                        }
                    }
                } catch (error) {
                    if ((error as any)?.message?.includes('not connected')) {
                        console.log('[CLASSIC] POLL: Device disconnected during poll');
                        clearInterval(pollInterval);
                    }
                }
            }, 100);

            classicReadIntervalRef.current = pollInterval;
            console.log('[CLASSIC] CONNECT: ✓ Polling started');

            // Send wake-up commands for scales
            if (deviceType === "scale") {
                try {
                    const triggers = ['\r\n', 'W\r\n', 'P\r\n'];
                    for (const cmd of triggers) {
                        await (classicDevice as any).write?.(cmd);
                        await new Promise<void>(r => setTimeout(() => r(), 200));
                    }
                    console.log('[CLASSIC] CONNECT: Wake-up commands sent');
                } catch (writeError) {
                    console.warn('[CLASSIC] CONNECT: Scale commands failed:', writeError);
                }
            }

            const unifiedDevice: UnifiedDevice = {
                id: classicDevice.address || id,
                address: classicDevice.address || id,
                name: classicDevice.name || undefined,
                type: 'classic',
                classicDevice,
            };

            setConnectedDevice(unifiedDevice);
            setConnectionFailed(false);
            manualDisconnectRef.current = false;

            console.log('[CLASSIC] ========== CLASSIC CONNECT COMPLETE ==========');
            setIsConnecting(false);
            return unifiedDevice;
        } catch (e) {
            console.log('[CLASSIC] ========== CLASSIC CONNECT ERROR ==========');
            const errMsg = (e as any)?.message || String(e);
            console.log('[CLASSIC] CONNECT ERROR:', errMsg);
            console.log('[CLASSIC] CONNECT ERROR stack:', (e as any)?.stack);
            
            Alert.alert('Classic Bluetooth Connection Failed', errMsg);
            setConnectionFailed(true);
            setIsConnecting(false);
            setConnectedDevice(null);
            return null;
        }
    }, [deviceType, ensureClassicBluetoothEnabled]);

    // 🔌 Disconnect (handles both BLE and Classic)
    const disconnect = useCallback(async () => {
        console.log('[UNIFIED] ========== DISCONNECT STARTED ==========');
        
        // Mark as manual disconnect to prevent auto-reconnect
        manualDisconnectRef.current = true;
        
        if (connectedDevice) {
            if (connectedDevice.type === 'ble' && connectedDevice.bleDevice) {
                // BLE disconnect
                try {
                    console.log('[UNIFIED] DISCONNECT: Removing BLE notification subscription...');
                    notifySubRef.current?.remove?.();
                    console.log('[UNIFIED] DISCONNECT: BLE subscription removed');
                } catch (e) {
                    console.log('[UNIFIED] DISCONNECT: Remove subscription error (ignored):', e);
                }
                notifySubRef.current = null;
                
                try {
                    console.log('[UNIFIED] DISCONNECT: Cancelling BLE device connection...');
                    await connectedDevice.bleDevice.cancelConnection();
                    console.log('[UNIFIED] DISCONNECT: BLE connection cancelled');
                } catch (e) {
                    console.log('[UNIFIED] DISCONNECT: Cancel BLE connection error (ignored):', e);
                }
            } else if (connectedDevice.type === 'classic' && connectedDevice.classicDevice) {
                // Classic disconnect
                try {
                    console.log('[UNIFIED] DISCONNECT: Removing Classic subscription...');
                    classicSubscriptionRef.current?.remove?.();
                    console.log('[UNIFIED] DISCONNECT: Classic subscription removed');
                } catch (e) {
                    console.log('[UNIFIED] DISCONNECT: Remove Classic subscription error (ignored):', e);
                }
                classicSubscriptionRef.current = null;
                
                if (classicReadIntervalRef.current) {
                    clearInterval(classicReadIntervalRef.current);
                    classicReadIntervalRef.current = null;
                }
                
                try {
                    console.log('[UNIFIED] DISCONNECT: Disconnecting Classic device...');
                    await connectedDevice.classicDevice.disconnect();
                    console.log('[UNIFIED] DISCONNECT: Classic device disconnected');
                } catch (e) {
                    console.log('[UNIFIED] DISCONNECT: Classic disconnect error (ignored):', e);
                }
            }
        }
        
        cleanupBLE();
        cleanupClassic();
        setConnectedDevice(null);
        setIsConnecting(false);
        setConnectionFailed(false);
        console.log('[UNIFIED] ========== DISCONNECT COMPLETE ==========');
    }, [connectedDevice, cleanupBLE, cleanupClassic]);

    // 🔗 Connect to BLE device (EXACT COPY from ScaleTestScreen - this is the critical part)
    const connect = useCallback(async (device: BLEDevice): Promise<UnifiedDevice | null> => {
        console.log('[BLE] ========== CONNECT STARTED ==========');
        console.log('[BLE] CONNECT: Target device:', device.name || 'Unnamed', 'id:', device.id);
        setIsConnecting(true);
        setConnectionFailed(false);
        setLastConnectionAttempt(new Date().toISOString());
        
        try {
            console.log('[BLE] CONNECT STEP 1: Initiating connection...');
            const d = await ble.connectToDevice(device.id, { autoConnect: false });
            console.log('[BLE] CONNECT STEP 1: ✓ Connection established');
            
            console.log('[BLE] CONNECT STEP 2: Discovering all services and characteristics...');
            await d.discoverAllServicesAndCharacteristics();
            console.log('[BLE] CONNECT STEP 2: ✓ Discovery complete');
            
            // Store device info permanently (save forever)
            const deviceInfo = {
                id: device.id,
                address: device.id,
                name: d.name || undefined,
                type: 'ble' as const, // Always BLE for BLE-only mode
                address_or_id: device.id,
                saved_at: new Date().toISOString() // Timestamp for tracking
            };
            await setItem(`last_device_${deviceType}`, deviceInfo);
            console.log('[BLE] CONNECT: Device saved permanently:', deviceInfo);

            // Create unified device and set connected device EARLY (like ScaleTestScreen)
            const unifiedDevice: UnifiedDevice = {
                id: device.id,
                address: device.id,
                name: d.name || undefined,
                type: 'ble',
                bleDevice: d,
                serviceUUIDs: d.serviceUUIDs || undefined,
            };
            setConnectedDevice(unifiedDevice);

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
                setIsConnecting(false);
                setConnectedDevice(null);
                Alert.alert('No BLE weight service', 'Connected, but only Generic Access (0x1800) was found. Your scale likely does not expose weight over BLE.');
                return null;
            }

            // Helper function to parse weight from bytes (exact copy from ScaleTestScreen)
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
                                setLastMessage(weight); // Store as weight in kgs (0.01 precision)
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
                                    setLastMessage(val.toFixed(2)); // Store as weight in kgs (0.01 precision)
                                    return true;
                                }
                            } catch {}
                        }
                    }
                    
                    if (match) {
                        const val = parseFloat(match[1].replace(',', '.'));
                        if (!isNaN(val) && isFinite(val)) {
                            console.log(`[BLE] PARSE [${source}]: ✓✓✓ VALID WEIGHT PARSED: ${val.toFixed(2)}`);
                            setLastMessage(val.toFixed(2)); // Store as weight in kgs (0.01 precision)
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

            // Subscribe to notifications if possible, else read interval (exact copy from ScaleTestScreen)
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
                // IMPORTANT: Store interval cleanup in notifySubRef (exact match with ScaleTestScreen)
                notifySubRef.current = { remove: () => {
                    clearInterval(interval);
                    console.log('[BLE] POLL: Polling stopped');
                }};
                console.log('[BLE] CONNECT STEP 5: ✓ Polling started');
            }

            // Reset manual disconnect flag when connecting successfully
            manualDisconnectRef.current = false;
            setConnectionFailed(false);
            
            console.log('[BLE] ========== CONNECT COMPLETE ==========');
            setIsConnecting(false);
            return unifiedDevice;
        } catch (e) {
            console.log('[BLE] ========== CONNECT ERROR ==========');
            const errMsg = (e as any)?.message || String(e);
            console.log('[BLE] CONNECT ERROR:', errMsg);
            console.log('[BLE] CONNECT ERROR stack:', (e as any)?.stack);
            
            Alert.alert('Connection failed', errMsg);
            setConnectionFailed(true);
            setIsConnecting(false);
            
            // Clear connected device on error
            setConnectedDevice(null);
            return null;
        }
    }, [deviceType, ble]);

    // 🔗 Connect to device wrapper (tries BLE first, then Classic as fallback)
    const connectToDevice = useCallback(
        async (id: string): Promise<UnifiedDevice | null> => {
            console.log(`[UNIFIED] ========== CONNECT WRAPPER STARTED ==========`);
            console.log(`[UNIFIED] CONNECT: Target device ID: ${id}`);
            
            // Check if already connected to this device
            if (connectedDevice && connectedDevice.id.toLowerCase() === id.toLowerCase()) {
                try {
                    let stillConnected = false;
                    if (connectedDevice.type === 'ble' && connectedDevice.bleDevice) {
                        stillConnected = (connectedDevice.bleDevice as any).isConnected === true;
                    } else if (connectedDevice.type === 'classic' && connectedDevice.classicDevice) {
                        stillConnected = await connectedDevice.classicDevice.isConnected();
                    }
                    if (stillConnected) {
                        console.log(`[UNIFIED] CONNECT: Already connected to ${id}, skipping connection`);
                        return connectedDevice;
                    }
                } catch {}
            }
            
            // Cleanup before attempting new connection
            cleanupBLE();
            cleanupClassic();
            setConnectedDevice(null);

            try {
                // ========== TRY BLE FIRST (PRIMARY) - ALWAYS PRIORITY ==========
                // First check BLE devices list directly (most reliable)
                const bleDev = bleDevices.find(d => d.id.toLowerCase() === id.toLowerCase());
                
                // Then check unified devices list for BLE type
                const unifiedBleDev = devices.find(d => 
                    d.id.toLowerCase() === id.toLowerCase() && d.type === 'ble'
                );
                
                // If BLE device found, connect via BLE (don't even check Classic)
                if (bleDev || unifiedBleDev?.bleDevice) {
                    const deviceToConnect = bleDev || unifiedBleDev?.bleDevice;
                    if (deviceToConnect) {
                        console.log("[UNIFIED] CONNECT: ✓ Found BLE device - connecting via BLE (PRIMARY)...");
                        try {
                            const hasPermissions = await requestBLEPermissions();
                            if (!hasPermissions) {
                                console.log("[UNIFIED] CONNECT: BLE permissions denied, trying Classic fallback...");
                                throw new Error("BLE permissions denied");
                            }
                            const result = await connect(deviceToConnect);
                            if (result) {
                                console.log("[UNIFIED] CONNECT: ✓✓✓ BLE connection successful");
                                return result;
                            }
                            // If BLE connection returns null, continue to Classic fallback
                            console.log("[UNIFIED] CONNECT: BLE connection returned null, trying Classic fallback...");
                        } catch (bleErr) {
                            console.log("[UNIFIED] CONNECT: BLE connection failed, trying Classic fallback...", (bleErr as any)?.message);
                            // Fall through to Classic fallback only if BLE explicitly failed
                        }
                    }
                } else {
                    console.log("[UNIFIED] CONNECT: No BLE device found for ID:", id);
                }

                // ========== TRY CLASSIC AS FALLBACK (SECONDARY) - ONLY IF NO BLE ==========
                // Only try Classic if BLE device was NOT found
                if (!bleDev && !unifiedBleDev) {
                    console.log("[UNIFIED] CONNECT: No BLE device found, trying Classic as fallback...");
                    const classicDev = classicDevices.find(d => 
                        (d.address || d.id || '').toLowerCase() === id.toLowerCase()
                    );
                    const unifiedClassicDev = devices.find(d => 
                        d.id.toLowerCase() === id.toLowerCase() && d.type === 'classic'
                    );
                    
                    if (classicDev || unifiedClassicDev?.classicDevice) {
                        const deviceToConnect = classicDev || unifiedClassicDev?.classicDevice;
                        if (deviceToConnect) {
                            console.log("[UNIFIED] CONNECT: Found Classic device, connecting via Classic (FALLBACK)...");
                            try {
                                const result = await connectClassicDevice(id, deviceToConnect);
                                if (result) {
                                    console.log("[UNIFIED] CONNECT: ✓✓✓ Classic connection successful");
                                    return result;
                                }
                            } catch (classicErr) {
                                console.log("[UNIFIED] CONNECT: Classic connection also failed...", (classicErr as any)?.message);
                            }
                        }
                    }
                }

                // No device found
                Alert.alert("Device not found", "Device not found in scanned devices. Please scan again.");
                return null;
            } catch (err) {
                const error = err as any;
                const errMsg = error?.reason || error?.message || error?.error || String(error || 'Unknown error occurred');
                
                console.error("[UNIFIED] CONNECT: Connection error:", errMsg);
                
                Alert.alert(
                    'Connection Failed',
                    errMsg || 'Unknown error occurred. Please check the device and try again.',
                    [{ text: 'OK' }]
                );
                
                setConnectionFailed(true);
                return null;
            }
        },
        [devices, bleDevices, classicDevices, connectedDevice, connect, connectClassicDevice, requestBLEPermissions, cleanupBLE, cleanupClassic]
    );

    // 🧾 Printer helpers (Classic only for now)
    async function printText(text: string) {
        if (deviceType !== "printer" || !connectedDevice || connectedDevice.type !== 'classic') {
            console.warn("[PRINT] Print text only supported for Classic printers");
            return;
        }
        try {
            const formatted = `${text}\n\n`;
            const bytes = new Uint8Array(formatted.split('').map(c => c.charCodeAt(0)));
            await (connectedDevice.classicDevice as any)?.write?.(bytes);
            console.log("[PRINT] Printed text:", text);
        } catch (error) {
            console.error("[PRINT] Print error:", error);
        }
    }

    async function printRaw(bytes: Uint8Array | number[]) {
        if (deviceType !== "printer" || !connectedDevice || connectedDevice.type !== 'classic') {
            console.warn("[PRINT] Print raw only supported for Classic printers");
            return;
        }
        try {
            await (connectedDevice.classicDevice as any)?.write?.(bytes);
        } catch (e) {
            console.error("[PRINT] Print raw error:", e);
        }
    }

    // ♻️ Auto-connect to last device on mount (for scales only)
    useEffect(() => {
        if (deviceType !== 'scale') return;
        
        // Skip auto-connect if user manually disconnected
        if (manualDisconnectRef.current) {
            console.log('[BLE] AUTO-CONNECT: Manual disconnect detected, skipping auto-connect');
            return;
        }
        
        // Only run auto-connect once on mount (not on every connectedDevice change)
        if (autoConnectHasRunRef.current) {
            return;
        }
        
        const autoConnect = async () => {
            try {
                // Mark as run
                autoConnectHasRunRef.current = true;
                
                // Check if already connected - skip auto-connect
                if (connectedDevice) {
                    try {
                        let stillConnected = false;
                        if (connectedDevice.type === 'ble' && connectedDevice.bleDevice) {
                            stillConnected = (connectedDevice.bleDevice as any).isConnected === true;
                        } else if (connectedDevice.type === 'classic' && connectedDevice.classicDevice) {
                            stillConnected = await connectedDevice.classicDevice.isConnected();
                        }
                        if (stillConnected) {
                            console.log('[UNIFIED] AUTO-CONNECT: Already connected to device, skipping auto-connect');
                            return;
                        }
                    } catch {}
                }
                
                // Safely retrieve last device
                let deviceData: any = null;
                try {
                    const lastDevice = await getItem(`last_device_${deviceType}`);
                    if (lastDevice) {
                        deviceData = typeof lastDevice === 'string' ? JSON.parse(lastDevice) : lastDevice;
                        console.log('[UNIFIED] AUTO-CONNECT: Last device found:', deviceData);
                        console.log('[UNIFIED] AUTO-CONNECT: Device type:', deviceData.type || 'unknown');
                    } else {
                        console.log('[UNIFIED] AUTO-CONNECT: No last device found in storage');
                        return;
                    }
                } catch (parseError) {
                    console.error('[UNIFIED] AUTO-CONNECT: Error parsing stored device:', parseError);
                    return;
                }
                
                // Wait a bit for scan to complete if it's running
                await new Promise<void>(r => setTimeout(() => r(), 2000));
                
                // Use id as primary identifier
                const deviceId = deviceData.id || deviceData.address || deviceData.address_or_id;
                if (!deviceId) {
                    console.log('[UNIFIED] AUTO-CONNECT: No valid device ID found');
                    return;
                }
                
                // Check if device is available in scanned devices (BLE or Classic)
                const deviceAvailableBLE = devices.some(d =>
                    d.id.toLowerCase() === deviceId.toLowerCase() && d.type === 'ble'
                ) || bleDevices.some(d =>
                    d.id.toLowerCase() === deviceId.toLowerCase()
                );
                
                const deviceAvailableClassic = devices.some(d =>
                    d.id.toLowerCase() === deviceId.toLowerCase() && d.type === 'classic'
                ) || classicDevices.some(d =>
                    (d.address || d.id || '').toLowerCase() === deviceId.toLowerCase()
                );
                
                const deviceAvailable = deviceAvailableBLE || deviceAvailableClassic;
                
                if (!deviceAvailable) {
                    console.log('[UNIFIED] AUTO-CONNECT: Device not available in scanned devices, showing as disconnected');
                    console.log('[UNIFIED] AUTO-CONNECT: Available devices - BLE:', bleDevices.length, 'Classic:', classicDevices.length);
                    // Don't try to connect if device is not available, just show as disconnected
                    return;
                }
                
                // Reconnect based on stored type - try BLE first, then Classic
                const storedType = deviceData.type || 'ble';
                console.log('[UNIFIED] AUTO-CONNECT: Stored type is', storedType, '- attempting connection to:', deviceId);
                
                if (storedType === 'ble' && deviceAvailableBLE) {
                    console.log('[UNIFIED] AUTO-CONNECT: Attempting BLE connection...');
                    await connectToDevice(deviceId);
                } else if (storedType === 'classic' && deviceAvailableClassic) {
                    console.log('[UNIFIED] AUTO-CONNECT: Attempting Classic connection...');
                    await connectToDevice(deviceId);
                } else {
                    console.log('[UNIFIED] AUTO-CONNECT: Device type', storedType, 'but device not available in that type, skipping connection');
                }
            } catch (error) {
                console.error('[BLE] AUTO-CONNECT: Failed:', error);
                // Don't crash, just log the error
            }
        };
        
        // Delay auto-connect slightly to allow component to mount
        // Only run once on mount, not on dependency changes
        const timeout = setTimeout(() => {
            autoConnect();
        }, 1000);
        return () => clearTimeout(timeout);
    }, [deviceType]); // Only depend on deviceType, run once on mount

    return {
        devices,
        connectedDevice,
        isScanning,
        isConnecting,
        lastMessage, // Weight in kgs (0.01 precision)
        scanForDevices,
        connectToDevice,
        disconnect,
        connectionFailed,
        lastConnectionAttempt,
        printText: deviceType === "printer" ? printText : undefined,
        printRaw: deviceType === "printer" ? printRaw : undefined,
    };
}
