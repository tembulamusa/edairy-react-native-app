import RNBluetoothClassic from "react-native-bluetooth-classic";
import filterBluetoothDevices from "../components/utils/device-filter";

export function isInnerPrinterDevice(
    name?: string | null,
    id?: string | null
): boolean {
    const normalizedName = String(name || "").toLowerCase();
    const normalizedId = String(id || "").toLowerCase();

    return (
        normalizedName.includes("innerprinter") ||
        normalizedName.includes("inner") ||
        normalizedId.includes("inner")
    );
}

export async function findFirstClassicInnerPrinter(): Promise<any | null> {
    try {
        const bonded = await RNBluetoothClassic.getBondedDevices();
        const bondedPrinters = await filterBluetoothDevices(bonded || [], "printer");
        const bondedInner = bondedPrinters.find((device) =>
            isInnerPrinterDevice(device.name, device.address || device.id)
        );

        if (bondedInner) {
            console.log(
                "[INNER-PRINTER] Found bonded InnerPrinter:",
                bondedInner.name || bondedInner.address
            );
            return bondedInner;
        }

        let discovered: any[] = [];
        try {
            discovered = (await (RNBluetoothClassic as any).startDiscovery?.()) || [];
        } catch (discoveryError) {
            console.warn("[INNER-PRINTER] Classic discovery failed:", discoveryError);
        } finally {
            await (RNBluetoothClassic as any).cancelDiscovery?.().catch(() => {});
        }

        const unique: Record<string, any> = {};
        [...(bonded || []), ...discovered].forEach((device) => {
            const key = String(device?.address || device?.id || "").toLowerCase();
            if (key && !unique[key]) {
                unique[key] = device;
            }
        });

        const printers = await filterBluetoothDevices(Object.values(unique), "printer");
        const discoveredInner = printers.find((device) =>
            isInnerPrinterDevice(device.name, device.address || device.id)
        );

        if (discoveredInner) {
            console.log(
                "[INNER-PRINTER] Found discovered InnerPrinter:",
                discoveredInner.name || discoveredInner.address
            );
            return discoveredInner;
        }

        console.log("[INNER-PRINTER] No Classic InnerPrinter found");
        return null;
    } catch (error) {
        console.error("[INNER-PRINTER] Error searching for InnerPrinter:", error);
        return null;
    }
}

export async function isPrinterDeviceConnected(device: any): Promise<boolean> {
    if (!device) {
        return false;
    }

    try {
        if (device.type === "ble" && device.bleDevice) {
            return (device.bleDevice as any).isConnected === true;
        }

        if (device.type === "classic" && device.classicDevice) {
            return await device.classicDevice.isConnected();
        }
    } catch (error) {
        console.warn("[INNER-PRINTER] Connection check failed:", error);
    }

    return false;
}

export async function attemptInnerPrinterAutoConnect(options: {
    connectClassicDevice: (
        id: string,
        device: any
    ) => Promise<any | null>;
    getConnectedDevice: () => any | null;
    isConnecting?: () => boolean;
    logPrefix?: string;
}): Promise<any | null> {
    const {
        connectClassicDevice,
        getConnectedDevice,
        isConnecting = () => false,
        logPrefix = "[INNER-PRINTER]",
    } = options;

    if (isConnecting()) {
        return getConnectedDevice();
    }

    const connected = getConnectedDevice();
    if (connected && (await isPrinterDeviceConnected(connected))) {
        console.log(`${logPrefix} Printer already connected`);
        return connected;
    }

    console.log(`${logPrefix} Scanning for first Classic InnerPrinter...`);
    const innerPrinter = await findFirstClassicInnerPrinter();
    if (!innerPrinter) {
        return null;
    }

    const deviceId = innerPrinter.address || innerPrinter.id;
    if (!deviceId) {
        console.warn(`${logPrefix} InnerPrinter missing address/id`);
        return null;
    }

    console.log(
        `${logPrefix} Connecting to Classic InnerPrinter:`,
        innerPrinter.name || deviceId
    );

    return connectClassicDevice(deviceId, innerPrinter);
}
