import { useEffect, useState, useCallback } from "react";
import RNBluetoothClassic, {
    BluetoothDevice,
    BluetoothEventSubscription,
} from "react-native-bluetooth-classic";

type UseBluetoothClassicReturn = {
    devices: BluetoothDevice[];
    connectedDevice: BluetoothDevice | null;
    isScanning: boolean;
    lastMessage: string | null;
    scanForDevices: () => Promise<void>;
    connectToDevice: (id: string) => Promise<BluetoothDevice | null>;
    disconnect: () => Promise<void>;
};

export default function useBluetoothClassic(): UseBluetoothClassicReturn {
    const [devices, setDevices] = useState<BluetoothDevice[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [lastMessage, setLastMessage] = useState<string | null>(null);

    const [subscription, setSubscription] = useState<BluetoothEventSubscription | null>(null);

    /**
     * Scan for paired devices
     */
    const scanForDevices = useCallback(async () => {
        try {
            setIsScanning(true);
            const bonded = await RNBluetoothClassic.getBondedDevices();
            setDevices(bonded);
        } catch (error) {
            console.error("Scan error:", error);
        } finally {
            setIsScanning(false);
        }
    }, []);

    /**
     * Connect to a device
     */
    const connectToDevice = useCallback(
        async (id: string): Promise<BluetoothDevice | null> => {
            try {
                const device = await RNBluetoothClassic.connectToDevice(id);
                setConnectedDevice(device);

                // Cleanup previous subscription
                subscription?.remove();

                // Listen for incoming data
                const sub = device.onDataReceived((event) => {
                    const raw = event?.data ?? "";
                    console.log("📩 Received:", raw);

                    // ✅ Only parse when it contains "ST,GS"
                    if (raw.startsWith("ST,GS")) {
                        const parsed = parseScaleData(raw);
                        if (parsed && parsed.weight !== null) {
                            setLastMessage(parsed.weightString); // e.g. "0.20"
                            console.log("⚖️ Parsed scale:", parsed);
                        } else {
                            console.warn("Could not parse weight from:", raw);
                        }
                    } else {
                        console.log("⏭️ Ignored non-stable reading:", raw);
                    }
                });

                setSubscription(sub);

                return device; // ✅ return connected device
            } catch (error) {
                console.error("Connection error:", error);
                return null;
            }
        },
        [subscription]
    );

    /**
     * Disconnect
     */
    const disconnect = useCallback(async () => {
        if (connectedDevice) {
            await connectedDevice.disconnect();
            subscription?.remove();
            setSubscription(null);
            setConnectedDevice(null);
        }
    }, [connectedDevice, subscription]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            subscription?.remove();
            if (connectedDevice) {
                connectedDevice.disconnect();
            }
        };
    }, [subscription, connectedDevice]);

    return {
        devices,
        connectedDevice,
        isScanning,
        lastMessage,
        scanForDevices,
        connectToDevice,
        disconnect,
    };

    // inside your hook file (useBluetoothClassic.ts)
    function parseScaleData(raw: string) {
        if (!raw) return null;
        const s = String(raw).trim();

        // Primary pattern: captures "ST" and optional second token "GS" then weight like 0.20 followed by KG
        // Examples matched: "ST,GS 0.20KG", "UT,GS 15.50KG", "ST GS 3.5KG", "GS:0.20KG"
        const re = /^([A-Z]{1,4})(?:,([A-Z]{1,4}))?[\s:,-]*([0-9]+(?:[.,][0-9]+)?)\s*KG/i;
        const m = s.match(re);

        if (m) {
            const status1 = (m[1] || "").toUpperCase();
            const status2 = (m[2] || null)?.toUpperCase() ?? null;
            // normalize decimal comma -> dot
            const weightStr = (m[3] || "").replace(",", ".");
            const weightNum = parseFloat(weightStr);
            return {
                status1,
                status2,
                weightString: isNaN(weightNum) ? null : weightNum.toFixed(2), // "0.20"
                weight: isNaN(weightNum) ? null : weightNum,                 // 0.2 (number)
            };
        }

        // Fallback: find any "<number> KG" in the string
        const fallback = s.match(/([0-9]+(?:[.,][0-9]+)?)\s*KG/i);
        if (fallback) {
            const num = parseFloat(fallback[1].replace(",", "."));
            if (!isNaN(num)) {
                return {
                    status1: null,
                    status2: null,
                    weightString: num.toFixed(2),
                    weight: num,
                };
            }
        }

        return null;
    }

}
