import { useEffect, useState, useCallback } from "react";
import RNBluetoothClassic, {
    BluetoothDevice,
    BluetoothEventSubscription,
} from "react-native-bluetooth-classic";
import filterBluetoothDevices from "../components/utils/device-filter";
import { setItem, getItem } from "../components/utils/local-storage";
import { Platform, PermissionsAndroid, Alert } from "react-native";

type UseBluetoothClassicProps = {
    deviceType?: "scale" | "printer";
};

type UseBluetoothClassicReturn = {
    devices: BluetoothDevice[];
    connectedDevice: BluetoothDevice | null;
    isScanning: boolean;
    isConnecting: boolean;
    lastMessage: string | null;
    scanForDevices: () => Promise<void>;
    connectToDevice: (id: string) => Promise<BluetoothDevice | null>;
    disconnect: () => Promise<void>;
    connectionFailed: boolean;
    lastConnectionAttempt: string | null;
    printText?: (text: string) => Promise<void>;
    printRaw?: (bytes: Uint8Array | number[]) => Promise<void>;
};

export default function useBluetoothClassic({
    deviceType = "scale",
}: UseBluetoothClassicProps = {}): UseBluetoothClassicReturn {
    const [devices, setDevices] = useState<BluetoothDevice[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [lastMessage, setLastMessage] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<BluetoothEventSubscription | null>(null);
    const [connectionFailed, setConnectionFailed] = useState(false);
    const [lastConnectionAttempt, setLastConnectionAttempt] = useState<string | null>(null);
    const [readIntervalRef, setReadIntervalRef] = useState<any>(null);

    // 🔒 Request permissions
    async function requestBluetoothPermissions() {
        if (Platform.OS === "android") {
            try {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);
                const allGranted = Object.values(granted).every(
                    (p) => p === PermissionsAndroid.RESULTS.GRANTED
                );

                if (!allGranted) {
                    Alert.alert(
                        "Bluetooth Permission Required",
                        "Bluetooth permissions are required to scan and connect."
                    );
                }
                return allGranted;
            } catch (error) {
                console.error("Permission request error:", error);
                return false;
            }
        }
        return true;
    }

    // ⚙️ Ensure Bluetooth is enabled
    async function ensureBluetoothEnabled() {
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
            console.warn("Bluetooth enable check failed:", error);
            return false;
        }
    }

    // 🧹 Cleanup
    function cleanup() {
        try {
            subscription?.remove?.();
        } catch { }
        setSubscription(null);

        if (readIntervalRef) {
            clearInterval(readIntervalRef);
            setReadIntervalRef(null);
        }
    }

    // 🔍 Scan for devices
    const scanForDevices = useCallback(async () => {
        console.log("🔍 Starting device scan...");
        const hasPermissions = await requestBluetoothPermissions();
        if (!hasPermissions) return;

        const enabled = await ensureBluetoothEnabled();
        if (!enabled) return;

        try {
            setIsScanning(true);

            const bonded = await RNBluetoothClassic.getBondedDevices();

            let discovered: any[] = [];
            try {
                discovered = (await (RNBluetoothClassic as any).startDiscovery?.()) || [];
            } catch (e) {
                console.warn("Discovery failed:", e);
            } finally {
                await (RNBluetoothClassic as any).cancelDiscovery?.();
            }

            const refreshedBonded = await RNBluetoothClassic.getBondedDevices();
            const all = [...refreshedBonded, ...discovered];

            const unique: Record<string, any> = {};
            all.forEach((d) => {
                const key = (d?.address || d?.id || "").toLowerCase();
                if (key && !unique[key]) unique[key] = d;
            });

            const filtered = await filterBluetoothDevices(Object.values(unique), deviceType);
            setDevices(filtered);
        } catch (error) {
            console.error("❌ Scan error:", error);
        } finally {
            setIsScanning(false);
        }
    }, [deviceType]);

    // 🔗 Connect to device
    const connectToDevice = useCallback(
        async (id: string): Promise<BluetoothDevice | null> => {
            console.log(`🔌 connectToDevice called for ${deviceType} with id: ${id}`);
            
            const hasPermissions = await requestBluetoothPermissions();
            if (!hasPermissions) return null;

            const enabled = await ensureBluetoothEnabled();
            if (!enabled) return null;

            setIsConnecting(true);
            setConnectionFailed(false);
            setLastConnectionAttempt(new Date().toISOString());

            // Cleanup before attempting new connection
            cleanup();
            setConnectedDevice(null);

            try {
                await RNBluetoothClassic.cancelDiscovery().catch(() => { });

                // 🧩 Check if device is paired
                const bonded = await RNBluetoothClassic.getBondedDevices();
                if (!bonded.some((b) => b.address === id)) {
                    Alert.alert("Device not paired", "Please pair your scale manually in Bluetooth settings first.");
                    setIsConnecting(false);
                    return null;
                }

                console.log("🔗 Connecting →", id);
                let device = await RNBluetoothClassic.connectToDevice(id);

                // 🕓 Wait until socket fully opens
                for (let i = 0; i < 5; i++) {
                    const connected = await device.isConnected();
                    if (connected) {
                        console.log("✅ Verified connection established");
                        break;
                    }
                    console.log(`⏳ Waiting for socket open... (${i + 1}/5)`);
                    await new Promise<void>((r) => setTimeout(r, 500));
                }

                const stillConnected = await device.isConnected();
                if (!stillConnected) throw new Error("Failed to establish stable RFCOMM connection");

                console.log("✅ Device connected:", device.name || device.address);
                console.log("🔍 Device methods available:", Object.keys(device));
                console.log("🔍 Device has read method:", !!(device as any).read);
                console.log("🔍 Device has onDataReceived method:", !!(device as any).onDataReceived);
                console.log("🔍 Device has write method:", !!(device as any).write);
                setConnectedDevice(device);
                await setItem(`last_device_${deviceType}`, device);

                // 📤 Send commands to trigger scale data
                if (deviceType === "scale") {
                    try {


                        // Test immediate read after commands
                        console.log("🧪 Testing immediate read after commands...");
                        try {
                            const testData = await (device as any).read?.();
                            console.log("🧪 Immediate read result:", JSON.stringify(testData));
                            if (testData) {
                                handleIncomingData(testData);
                            }
                        } catch (testError) {
                            console.log("🧪 Immediate read failed:", testError);
                        }
                    } catch (writeError) {
                        console.warn("⚠️ Scale commands failed:", writeError);
                    }
                }

                // 🧭 Setup read subscriptions safely
                try {

                    // const sub = device.onDataReceived((event) => handleIncomingData(event));
                    // setSubscription(sub);
                    device?.onDataReceived((event) => {
                        console.log('Incoming data:', event?.data);
                    });
                    // const subscription = RNBluetoothClassic?.onDeviceRead((event) => {
                    //     console.log('Data from any device:', event?.data);
                    // });
                    console.log("🧭 Device listener set successfully");
                } catch (err) {
                    console.warn("⚠️ Failed to attach read listener:", err);
                }

                // 🔄 Start polling as fallback (more reliable for scales)
                console.log("🔄 Starting polling fallback...");
                const pollInterval = setInterval(async () => {
                    try {
                        if (!device || !(await device.isConnected())) {
                            console.log("❌ Device disconnected, stopping poll");
                            clearInterval(pollInterval);
                            return;
                        }

                        // Try to read data
                        const data = await (device as any).read?.();
                        if (data) {
                            console.log("📖 Polling read result:", JSON.stringify(data));
                            handleIncomingData(data);
                        }
                    } catch (error) {
                        // Don't log every polling error to avoid spam
                        if ((error as any)?.message?.includes('not connected')) {
                            console.log("❌ Device disconnected during poll");
                            clearInterval(pollInterval);
                        }
                    }
                }, 100); // Poll every 100ms

                setReadIntervalRef(pollInterval);
                console.log("✅ Polling started");

                setConnectionFailed(false);
                return device;
            } catch (err) {
                console.error("❌ Connection error:", err);
                setConnectionFailed(true);
                return null;
            } finally {
                setIsConnecting(false);
            }
        },
        [deviceType]
    );

    // 📩 Handle incoming data
    function handleIncomingData(event: any) {
        try {
            console.log("🔔 Data received event:", JSON.stringify(event));
            console.log("🔔 Event type:", typeof event);
            console.log("🔔 Event keys:", Object.keys(event || {}));

            let raw = "";
            if (event?.data) raw = String(event.data).trim();
            else if (typeof event === "string") raw = event.trim();
            else raw = String(event || "").trim();

            console.log("📩 Raw data extracted:", JSON.stringify(raw));

            if (!raw) {
                console.log("⚠️ Empty data, ignoring");
                return;
            }

            const parsed = parseScaleData(raw);
            console.log("🔍 Parsed result:", parsed);

            if (parsed && parsed.weight !== null) {
                setLastMessage(parsed.weightString);
                console.log("✅✅✅ SUCCESS: Weight updated:", parsed.weightString);
                return;
            }

            const numberOnly = raw.match(/([-+]?[0-9]+(?:[.,][0-9]+)?)/);
            if (numberOnly) {
                const n = parseFloat(numberOnly[1].replace(",", "."));
                if (!isNaN(n)) {
                    setLastMessage(n.toFixed(2));
                    console.log("✅✅✅ SUCCESS: Fallback numeric:", n.toFixed(2));
                }
            } else {
                console.log("❌ No numbers found in data:", raw);
            }
        } catch (error) {
            console.warn("❌ Data handling error:", error);
        }
    }

    // 🧾 Printer helpers
    async function printText(text: string) {
        if (deviceType !== "printer" || !connectedDevice) return;
        try {
            const formatted = `${text}\n\n`;
            const bytes = new Uint8Array(formatted.split('').map(c => c.charCodeAt(0)));
            await (connectedDevice as any).write(bytes);
            console.log("🖨️ Printed text:", text);
        } catch (error) {
            console.error("❌ Print error:", error);
        }
    }

    async function printRaw(bytes: Uint8Array | number[]) {
        if (deviceType !== "printer" || !connectedDevice) return;
        try {
            await (connectedDevice as any).write(bytes);
        } catch (e) {
            console.error("Print raw error:", e);
        }
    }

    // 🔌 Disconnect
    const disconnect = useCallback(async () => {
        if (connectedDevice) {
            try {
                await connectedDevice.disconnect();
            } catch { }
            cleanup();
            setConnectedDevice(null);
            setIsConnecting(false);
            setConnectionFailed(false);
        }
    }, [connectedDevice]);

    // ♻️ Auto reconnect - removed because it conflicts with separate scale/printer instances

    // 🧹 Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
            connectedDevice?.disconnect?.();
        };
    }, [connectedDevice]);

    // ⚖️ Parse scale data
    function parseScaleData(raw: string) {
        if (!raw) return null;
        const s = String(raw).trim();
        const re = /^([A-Z]{1,4})(?:,([A-Z]{1,4}))?[\s:,-]*([0-9]+(?:[.,][0-9]+)?)\s*KG/i;
        const m = s.match(re);
        if (m) {
            const weight = parseFloat(m[3].replace(",", "."));
            return { weightString: weight.toFixed(2), weight };
        }
        const fallback = s.match(/([0-9]+(?:[.,][0-9]+)?)\s*KG/i);
        if (fallback) {
            const num = parseFloat(fallback[1].replace(",", "."));
            return { weightString: num.toFixed(2), weight: num };
        }
        return null;
    }

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
