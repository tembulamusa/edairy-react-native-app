import AsyncStorage from "@react-native-async-storage/async-storage";
import { BleManager } from "react-native-ble-plx";
import { Platform, PermissionsAndroid, Alert } from "react-native";

// Create a BLE manager instance for printer operations
const bleManager = new BleManager();

// Request BLE permissions
async function requestBLEPermissions(): Promise<boolean> {
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
        console.error('[PRINT] Permission request error:', e);
        return false;
    }
}

/**
 * Connects to InnerPrinter via BLE, prints receipt, then disconnects
 * @param receiptText - The formatted receipt text to print
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function printReceiptWithPrinter(receiptText: string): Promise<boolean> {
    let connectedDevice: any = null;
    let writeCharacteristic: any = null;
    let serviceUUID: string | null = null;

    try {
        console.log('🔌 [PRINT] Starting printer connection process...');

        // Step 0: Request BLE permissions
        const hasPermissions = await requestBLEPermissions();
        if (!hasPermissions) {
            console.error('❌ [PRINT] BLE permissions denied');
            Alert.alert('Permissions Required', 'Bluetooth and Location permissions are required to connect to the printer.');
            return false;
        }
        console.log('✅ [PRINT] BLE permissions granted');

        // Step 1: Try to get saved printer from AsyncStorage
        let printerData: any = null;
        try {
            const lastUsedPrinter = await AsyncStorage.getItem('last_device_printer');
            if (lastUsedPrinter) {
                printerData = JSON.parse(lastUsedPrinter);
                console.log('📦 [PRINT] Found saved printer:', printerData.name || printerData.id);
            }
        } catch (storageErr) {
            console.warn('⚠️ [PRINT] Error reading saved printer:', storageErr);
        }

        // Step 2: Stop any existing scan first
        try {
            await bleManager.stopDeviceScan();
            console.log('🛑 [PRINT] Stopped any existing scan');
        } catch (stopErr) {
            console.log('ℹ️ [PRINT] No existing scan to stop');
        }

        // Step 3: Scan for InnerPrinter devices
        console.log('🔍 [PRINT] Scanning for InnerPrinter devices (15 seconds)...');
        const devices: any[] = [];
        const allDevices: any[] = []; // For debugging - log all devices found
        const seen: Record<string, boolean> = {};

        bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
            if (error) {
                console.error('❌ [PRINT] Scan error:', error);
                return;
            }
            if (!device) return;

            const deviceName = (device.name || '').toLowerCase();
            const key = device.id;

            // Log all devices for debugging (first 20 to avoid spam)
            if (allDevices.length < 20 && !seen[key]) {
                allDevices.push(device);
                console.log(`🔍 [PRINT] Scanned device: ${device.name || 'Unnamed'} (${device.id})`);
            }

            // Look for InnerPrinter devices (case-insensitive, flexible matching)
            // Try multiple patterns: innerprinter, inner, printer (if it might be named differently)
            const isInnerPrinter = deviceName.includes('innerprinter') || 
                                   deviceName.includes('inner') ||
                                   (deviceName.includes('printer') && deviceName.includes('ble'));
            
            if (isInnerPrinter && !seen[key]) {
                seen[key] = true;
                devices.push(device);
                console.log('✅ [PRINT] Found InnerPrinter:', device.name || device.id, 'RSSI:', device.rssi);
            }
        });

        // Wait for scan to complete (15 seconds for better device discovery)
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        // Stop the scan
        try {
            await bleManager.stopDeviceScan();
            console.log('🛑 [PRINT] Scan stopped');
        } catch (stopErr) {
            console.warn('⚠️ [PRINT] Error stopping scan:', stopErr);
        }

        console.log(`🔍 [PRINT] Scan complete. Found ${devices.length} InnerPrinter device(s) out of ${allDevices.length} total devices scanned`);
        
        // Log all found InnerPrinter devices
        if (devices.length > 0) {
            devices.forEach((d, idx) => {
                console.log(`  [PRINT] InnerPrinter ${idx + 1}: ${d.name || 'Unnamed'} (${d.id}) RSSI: ${d.rssi}`);
            });
        } else {
            console.warn('⚠️ [PRINT] No InnerPrinter devices found. Scanned devices:');
            allDevices.slice(0, 10).forEach((d, idx) => {
                console.log(`  [PRINT] Scanned device ${idx + 1}: ${d.name || 'Unnamed'} (${d.id})`);
            });
        }

        // Step 3: Select printer (saved one if available and found, otherwise first InnerPrinter)
        let targetDevice: any = null;
        if (printerData && devices.length > 0) {
            // Try to find the saved printer in scanned devices
            const savedDevice = devices.find(d => 
                d.id.toLowerCase() === (printerData.id || printerData.address || '').toLowerCase()
            );
            if (savedDevice) {
                targetDevice = savedDevice;
                console.log('✅ [PRINT] Using saved printer:', targetDevice.name || targetDevice.id);
            } else {
                // Use first InnerPrinter found
                targetDevice = devices[0];
                console.log('✅ [PRINT] Saved printer not found, using first InnerPrinter:', targetDevice.name || targetDevice.id);
            }
        } else if (devices.length > 0) {
            // No saved printer, use first InnerPrinter
            targetDevice = devices[0];
            console.log('✅ [PRINT] Using first InnerPrinter found:', targetDevice.name || targetDevice.id);
        } else {
            console.error('❌ [PRINT] No InnerPrinter devices found');
            return false;
        }

        // Step 4: Connect to the printer
        console.log('🔌 [PRINT] Connecting to printer:', targetDevice.name || targetDevice.id);
        connectedDevice = await bleManager.connectToDevice(targetDevice.id, { autoConnect: false });
        console.log('✅ [PRINT] Connected to printer');

        // Step 5: Discover services and characteristics
        console.log('🔍 [PRINT] Discovering services and characteristics...');
        await connectedDevice.discoverAllServicesAndCharacteristics();
        const services = await connectedDevice.services();

        // Step 6: Find writable characteristic
        for (const s of services) {
            const chars = await connectedDevice.characteristicsForService(s.uuid);
            for (const c of chars) {
                if (c.isWritableWithResponse || c.isWritableWithoutResponse) {
                    const su = (s.uuid || '').toLowerCase().replace(/-/g, '');
                    const cu = (c.uuid || '').toLowerCase().replace(/-/g, '');
                    
                    // Look for common printer characteristics (fff0/fff1, ae30/ae31, or any writable)
                    if (su.includes('fff0') || cu.includes('fff1') || cu.includes('fff2') || 
                        su.includes('ae30') || cu.includes('ae31') || c.isWritableWithResponse || c.isWritableWithoutResponse) {
                        writeCharacteristic = c;
                        serviceUUID = s.uuid;
                        console.log('✅ [PRINT] Found write characteristic:', c.uuid, 'in service:', s.uuid);
                        break;
                    }
                }
            }
            if (writeCharacteristic) break;
        }

        if (!writeCharacteristic || !serviceUUID) {
            console.error('❌ [PRINT] No writable characteristic found');
            return false;
        }

        // Step 7: Save printer to AsyncStorage for future use
        const printerInfo = {
            id: targetDevice.id,
            address: targetDevice.id,
            name: targetDevice.name || 'InnerPrinter',
            type: 'ble',
            address_or_id: targetDevice.id,
            saved_at: new Date().toISOString()
        };
        await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerInfo));
        console.log('💾 [PRINT] Saved printer to AsyncStorage');

        // Step 8: Print receipt
        console.log('🖨️ [PRINT] Printing receipt...');
        const lines = receiptText.split('\n');
        
        for (const line of lines) {
            if (!line.trim() && line === lines[lines.length - 1]) continue; // Skip last empty line
            
            // Convert text to bytes
            const textBytes = new Uint8Array(
                (line || '').split('').map(c => c.charCodeAt(0))
            );
            
            // Add newline
            const newlineBytes = new Uint8Array([0x0A, 0x0D]); // \r\n
            const fullBytes = new Uint8Array([...textBytes, ...newlineBytes]);
            
            // Convert to base64 for BLE write
            let base64: string;
            try {
                // Try using global btoa if available
                // @ts-ignore
                base64 = (global as any)?.btoa?.(String.fromCharCode(...fullBytes)) || btoa(String.fromCharCode(...fullBytes));
            } catch {
                // Fallback: use Buffer if available
                // @ts-ignore
                if (typeof Buffer !== 'undefined') {
                    // @ts-ignore
                    base64 = Buffer.from(fullBytes).toString('base64');
                } else {
                    // Manual base64 encoding fallback
                    const binary = String.fromCharCode(...fullBytes);
                    base64 = btoa(binary);
                }
            }
            
            // Write to characteristic
            if (writeCharacteristic.isWritableWithResponse) {
                await connectedDevice.writeCharacteristicWithResponseForService(
                    serviceUUID,
                    writeCharacteristic.uuid,
                    base64
                );
            } else if (writeCharacteristic.isWritableWithoutResponse) {
                await connectedDevice.writeCharacteristicWithoutResponseForService(
                    serviceUUID,
                    writeCharacteristic.uuid,
                    base64
                );
            }
        }

        // Add some extra newlines at the end
        const endBytes = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A]);
        let endBase64: string;
        try {
            // @ts-ignore
            endBase64 = (global as any)?.btoa?.(String.fromCharCode(...endBytes)) || btoa(String.fromCharCode(...endBytes));
        } catch {
            // @ts-ignore
            if (typeof Buffer !== 'undefined') {
                // @ts-ignore
                endBase64 = Buffer.from(endBytes).toString('base64');
            } else {
                endBase64 = btoa(String.fromCharCode(...endBytes));
            }
        }
        if (writeCharacteristic.isWritableWithResponse) {
            await connectedDevice.writeCharacteristicWithResponseForService(
                serviceUUID,
                writeCharacteristic.uuid,
                endBase64
            );
        } else if (writeCharacteristic.isWritableWithoutResponse) {
            await connectedDevice.writeCharacteristicWithoutResponseForService(
                serviceUUID,
                writeCharacteristic.uuid,
                endBase64
            );
        }

        console.log('✅ [PRINT] Receipt printed successfully');
        
        // Step 9: Disconnect
        await connectedDevice.cancelConnection();
        console.log('🔌 [PRINT] Disconnected from printer');
        
        return true;
    } catch (err) {
        console.error('❌ [PRINT] Print error:', err);
        
        // Try to disconnect on error
        if (connectedDevice) {
            try {
                await connectedDevice.cancelConnection();
            } catch (disconnectErr) {
                console.error('❌ [PRINT] Failed to disconnect:', disconnectErr);
            }
        }
        
        return false;
    }
}

