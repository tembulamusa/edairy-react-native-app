import {
    BluetoothManager,
    BluetoothEscposPrinter,
} from "react-native-bluetooth-escpos-printer";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Connects to printer, prints receipt, then disconnects
 * @param receiptText - The formatted receipt text to print
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function printReceiptWithPrinter(receiptText: string): Promise<boolean> {
    try {
        // Get last used printer
        const lastUsedPrinter = await AsyncStorage.getItem('last_device_printer');
        
        if (!lastUsedPrinter) {
            console.log('ℹ️ No saved printer found');
            return false;
        }

        const printerData = JSON.parse(lastUsedPrinter);
        const printerAddress = printerData.address;

        if (!printerAddress) {
            console.error('❌ No printer address found');
            return false;
        }

        console.log('🔌 Connecting to printer:', printerData.name || printerAddress);
        
        // Connect to printer
        await BluetoothManager.connect(printerAddress);
        console.log('✅ Connected to printer');

        // Split receipt text into lines and print
        const lines = receiptText.split('\n');
        
        // Print each line of the receipt
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip empty lines at the end
            if (i === lines.length - 1 && !line.trim()) continue;
            
            // Center align header lines and separator lines
            if (line.trim().startsWith('=') || 
                line.includes('E-DAIRY LIMITED') ||
                line.includes('MEMBER KILOS RECEIPT') || 
                line.includes('Thank you') ||
                line.includes('Powered by')) {
                await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
            } else {
                await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
            }
            
            // Print the line with bold formatting for company name
            if (line.trim()) {
                if (line.includes('E-DAIRY LIMITED')) {
                    // Make company name bold (normal size)
                    try {
                        // Enable bold
                        await BluetoothEscposPrinter.printText("\x1B\x45\x01", {});
                        await BluetoothEscposPrinter.printText(`${line}\r\n`, {});
                        // Disable bold
                        await BluetoothEscposPrinter.printText("\x1B\x45\x00", {});
                    } catch (boldErr) {
                        // If bold command fails, just print normally
                        console.warn('Bold formatting not supported, printing normally');
                        await BluetoothEscposPrinter.printText(`${line}\r\n`, {});
                    }
                } else {
                    // Normal size for other text
                    await BluetoothEscposPrinter.printText(`${line}\r\n`, {});
                }
            } else {
                // Empty line
                await BluetoothEscposPrinter.printText("\r\n", {});
            }
        }

        // Try to cut paper
        try {
            if (typeof BluetoothEscposPrinter.cutPaper === 'function') {
                await BluetoothEscposPrinter.cutPaper();
            }
        } catch (cutErr) {
            console.warn('Paper cutting failed:', cutErr);
        }

        console.log('✅ Receipt printed successfully');
        
        // Disconnect printer - use disconnect instead of unpair
        try {
            await BluetoothManager.unpair(printerAddress);
        } catch (unpairErr) {
            // If unpair fails, try disconnect
            try {
                await BluetoothManager.disconnect();
            } catch (disconnectErr) {
                console.warn('Failed to disconnect printer:', disconnectErr);
            }
        }
        console.log('🔌 Disconnected from printer');
        
        return true;
    } catch (err) {
        console.error('❌ Print error:', err);
        
        // Try to disconnect even on error
        try {
            await BluetoothManager.disconnect();
        } catch (disconnectErr) {
            console.error('Failed to disconnect printer on error:', disconnectErr);
        }
        
        return false;
    }
}

