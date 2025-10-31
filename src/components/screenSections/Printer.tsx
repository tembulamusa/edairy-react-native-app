import React, { useState, useEffect } from "react";
import { View, Text, Button, FlatList, Alert, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    BluetoothManager,
    BluetoothEscposPrinter,
} from "react-native-bluetooth-escpos-printer";

export default function Printer() {
    const [devices, setDevices] = useState<any[]>([]);
    const [connected, setConnected] = useState(false);
    const [selectedPrinter, setSelectedPrinter] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [rawResult, setRawResult] = useState("");
    const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
    const [isInnerPrinterConnected, setIsInnerPrinterConnected] = useState(false);
    const [otherPrinters, setOtherPrinters] = useState<any[]>([]);

    useEffect(() => {
        const initializePrinter = async () => {
            setLoading(true);
            setError("");
            
            try {
                // First, check AsyncStorage for last used printer (prioritize InnerPrinter)
                const lastUsedPrinter = await AsyncStorage.getItem('last_device_printer');
                
                if (lastUsedPrinter) {
                    try {
                        const printerData = JSON.parse(lastUsedPrinter);
                        const name = (printerData.name || '').toLowerCase();
                        const isInnerPrinter = name.includes('innerprinter');
                        
                        console.log('🔌 Found last used printer in storage:', printerData.name || printerData.address, isInnerPrinter ? '(InnerPrinter - permanent)' : '');
                        
                        // Try to connect to last used printer
                        await BluetoothManager.connect(printerData.address);
                        setConnected(true);
                        setSelectedPrinter(printerData.address);
                        setAutoConnectAttempted(true);
                        
                        // Check if it's InnerPrinter
                        if (isInnerPrinter) {
                            setIsInnerPrinterConnected(true);
                            console.log('✅ Auto-connected to InnerPrinter (permanently stored)');
                        } else {
                            console.log('✅ Auto-connected to last used printer');
                        }
                        
                        setLoading(false);
                        return; // Successfully connected, no need to scan
                    } catch (connectErr) {
                        console.warn('⚠️ Failed to connect to last used printer, scanning for devices...', connectErr);
                        // Continue to scan for devices if connection fails
                        // If it was InnerPrinter that failed, still try to find it in scan
                    }
                }
                
                // If no saved printer or connection failed, proceed with normal flow
                BluetoothManager.isBluetoothEnabled()
                    .then((enabled) => {
                        if (!enabled) {
                            BluetoothManager.enableBluetooth()
                                .then((r) => {
                                    setRawResult(String(r));
                                    const parsed = parseDevicesListFromString(r);
                                    setDevices(parsed);
                                    setLoading(false);
                                })
                                .catch((e) => { setError(String(e)); setLoading(false); });
                        } else {
                            BluetoothManager.enableBluetooth()
                                .then((r) => {
                                    setRawResult(String(r));
                                    const parsed = parseDevicesListFromString(String(r));
                                    setDevices(parsed);
                                    setLoading(false);
                                })
                                .catch((e) => { setError(String(e)); setLoading(false); });
                        }
                    })
                    .catch((e) => { setError(String(e)); setLoading(false); });
            } catch (err) {
                console.error('Error initializing printer:', err);
                setError(String(err));
                setLoading(false);
            }
        };
        
        initializePrinter();
    }, []);

    // Example transaction
    const exampleTransaction = React.useMemo(() => ({
        company: "E-DAIRY LIMITED",
        memberName: "Moses Tembula",
        receiptTitle: "Milk Collection", // 2-word dynamic title
        total: "20 kgs",
        date: new Date().toLocaleString(),
        transactionId: "TXN-" + Math.floor(Math.random() * 100000),
        items: [
            { description: "Can 001", quantity: "25.50 KG", price: "300.00" },
            { description: "Can 002", quantity: "30.25 KG", price: "350.00" },
            { description: "Can 003", quantity: "28.75 KG", price: "350.00" },
        ],
    }), []);

    // Check if device is a printer based on name/address
    function isPrinterDevice(device) {
        if (!device) return false;
        const name = (device.name || '').toLowerCase();
        const address = (device.address || '').toLowerCase();
        
        // Common printer keywords/patterns
        const printerKeywords = [
            'printer',
            'print',
            'pos',
            'esc',
            'receipt',
            'thermal',
            'label',
            'epson',
            'xprinter',
            'zjiang',
            'panda',
            'star',
            'citizen',
            'bixolon',
            'rpp',
            'innerprinter' // specific to your case
        ];
        
        // Check if name or address contains any printer keyword
        const searchText = name + ' ' + address;
        return printerKeywords.some(keyword => searchText.includes(keyword));
    }

    // Parse devices list - handles arrays, objects, or strings
    function parseDevicesListFromString(str) {
        if (!str || typeof str !== 'string') return [];
        const devices = [];
        str.split('},').map(s => s.trim()).filter(Boolean).forEach(deviceStr => {
            if (!deviceStr.endsWith('}')) {
                deviceStr += '}';
            }
            let device = JSON.parse(deviceStr.includes('{') ? deviceStr : '{}');
            devices.push(device);
        });
        
        // Filter to only show printers
        const printersOnly = devices.filter(isPrinterDevice);
        
        return printersOnly;
    }


    const connectToPrinter = async (address, deviceInfo?: any) => {
        try {
            await BluetoothManager.connect(address);
            setConnected(true);
            setSelectedPrinter(address);
            
            const printerData = deviceInfo || { address, name: address };
            const name = (printerData.name || '').toLowerCase();
            const isInnerPrinter = name.includes('innerprinter');
            
            // Check if there's already an InnerPrinter saved
            const savedPrinter = await AsyncStorage.getItem('last_device_printer');
            if (savedPrinter) {
                try {
                    const savedData = JSON.parse(savedPrinter);
                    const savedName = (savedData.name || '').toLowerCase();
                    const savedIsInnerPrinter = savedName.includes('innerprinter');
                    
                    // If InnerPrinter is already saved, only overwrite with another InnerPrinter
                    // If not InnerPrinter, only save if there's no InnerPrinter in storage
                    if (isInnerPrinter || !savedIsInnerPrinter) {
                        await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerData));
                        console.log('💾 Saved printer to AsyncStorage:', printerData.name || printerData.address);
                    } else {
                        console.log('⚠️ Not saving non-InnerPrinter - InnerPrinter already stored permanently');
                    }
                } catch (parseErr) {
                    // If parse fails, just save the new printer
                    await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerData));
                    console.log('💾 Saved printer to AsyncStorage:', printerData.name || printerData.address);
                }
            } else {
                // No saved printer, save this one
                await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerData));
                console.log('💾 Saved printer to AsyncStorage:', printerData.name || printerData.address);
            }
            
            // Check if it's InnerPrinter
            if (isInnerPrinter) {
                setIsInnerPrinterConnected(true);
            }
            
            Alert.alert("✅ Connected", "Printer connection successful");
        } catch (err) {
            console.error(err);
            Alert.alert("❌ Failed", "Could not connect to printer");
        }
    };

    const printReceipt = async (transaction, printerAddressOverride?: string) => {
        const printerAddress = printerAddressOverride || selectedPrinter;
        // If address override is provided, assume connected (for auto-connect case)
        const isConnected = printerAddressOverride ? true : connected;
        if (!isConnected || !printerAddress) {
            Alert.alert("Printer not connected", "Please connect first.");
            return;
        }

        const { company, memberName, receiptTitle, total, date, transactionId, items = [] } = transaction;

        try {
            // Align Center
            await BluetoothEscposPrinter.printerAlign(
                BluetoothEscposPrinter.ALIGN.CENTER
            );

            await BluetoothEscposPrinter.printText(`${company}\n\r`, {
                encoding: "GBK",
                codepage: 0,
                widthtimes: 1,
                heigthtimes: 1,
            });

            const receiptTitleText = receiptTitle ? `${receiptTitle} Receipt` : "Receipt";
            await BluetoothEscposPrinter.printText(`${receiptTitleText}\n\r`, {});

            // Add extra spacing
            await BluetoothEscposPrinter.printText("\n\r", {});

            await BluetoothEscposPrinter.printText(`Date: ${date}\n\r`, {});

            await BluetoothEscposPrinter.printText("-----------------------------\n\r", {});

            await BluetoothEscposPrinter.printerAlign(
                BluetoothEscposPrinter.ALIGN.LEFT
            );

            await BluetoothEscposPrinter.printText(`Member: ${memberName}\n\r`, {});
            
            // Print items list dynamically
            if (items && items.length > 0) {
                await BluetoothEscposPrinter.printText("\n\r", {});
                for (let index = 0; index < items.length; index++) {
                    const item = items[index];
                    const itemText = `${item.description || `Item ${index + 1}`} - ${item.quantity || ''}${item.price ? ` @ ${item.price}` : ''}\n\r`;
                    await BluetoothEscposPrinter.printText(itemText, {});
                }
            }
            
            await BluetoothEscposPrinter.printText(`\n\rTotal: ${total || 'N/A'}\n\r`, {});
            await BluetoothEscposPrinter.printText(
                `Transaction ID: ${transactionId}\n\r`,
                {}
            );

            await BluetoothEscposPrinter.printText("-----------------------------\n\r", {});

            await BluetoothEscposPrinter.printerAlign(
                BluetoothEscposPrinter.ALIGN.CENTER
            );
            await BluetoothEscposPrinter.printText("Thank you!\n\r", {
                encoding: "GBK",
                codepage: 0,
            });
            await BluetoothEscposPrinter.printText("Powered by eDairy.africa\n\r", {
                encoding: "GBK",
            });

            // Try to cut paper - gracefully handle if method doesn't exist
            try {
                if (typeof BluetoothEscposPrinter.cutPaper === 'function') {
                    await BluetoothEscposPrinter.cutPaper();
                } else {
                    console.warn('cutPaper method not available - receipt printed without automatic cut');
                }
            } catch (cutErr) {
                // Silently fail - receipt is already printed successfully
                console.warn('Paper cutting failed - receipt printed without cut:', cutErr);
            }
        } catch (err) {
            console.error("Print error:", err);
            Alert.alert("Error", "Printing failed. Check printer connection.");
        }
    };

    // Auto-connect to InnerPrinter when found
    useEffect(() => {
        const autoConnectToInnerPrinter = async () => {
            // Don't attempt if already connected to InnerPrinter, already attempted, or still loading
            if (isInnerPrinterConnected || autoConnectAttempted || loading || devices.length === 0) return;

            // Find InnerPrinter (case-insensitive)
            const innerPrinter = devices.find(device => {
                const name = (device.name || '').toLowerCase();
                return name.includes('innerprinter');
            });

            // Separate other printers from InnerPrinter
            const others = devices.filter(device => {
                const name = (device.name || '').toLowerCase();
                return !name.includes('innerprinter');
            });
            setOtherPrinters(others);

            if (innerPrinter && innerPrinter.address) {
                setAutoConnectAttempted(true);
                try {
                    console.log('🔌 Auto-connecting to InnerPrinter...');
                    await BluetoothManager.connect(innerPrinter.address);
                    setConnected(true);
                    setSelectedPrinter(innerPrinter.address);
                    setIsInnerPrinterConnected(true);
                    
                    // Save to AsyncStorage
                    await AsyncStorage.setItem('last_device_printer', JSON.stringify(innerPrinter));
                    console.log('💾 Saved InnerPrinter to AsyncStorage');
                    
                    console.log('✅ Auto-connected to InnerPrinter');
                } catch (err) {
                    console.error('❌ Auto-connect to InnerPrinter failed:', err);
                    Alert.alert('Connection Failed', 'Could not automatically connect to InnerPrinter.');
                    // Connection failed, so show other printers
                    setOtherPrinters(devices);
                }
            } else {
                // No InnerPrinter found, show all printers
                setOtherPrinters(devices);
            }
        };

        autoConnectToInnerPrinter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [devices, loading, isInnerPrinterConnected, autoConnectAttempted]);

    return (
        <View style={{ padding: 20 }}>
            {loading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 8 }} />
                    <Text>Loading printers...</Text>
                </View>
            )}
            {error !== "" && (
                <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>
            )}
            {/* Show printer list only if InnerPrinter is NOT connected */}
            {!isInnerPrinterConnected && (
                <>
                    {!loading && (!otherPrinters || otherPrinters.length === 0) && error === "" && (
                        <View style={{ marginBottom: 10 }}>
                            <Text>No printers found. Make sure your device is paired and Bluetooth is on.</Text>
                            {rawResult ? <Text style={{ fontSize: 10, color: '#666' }}>{rawResult}</Text> : null}
                        </View>
                    )}
                    <FlatList
                        data={otherPrinters}
                        keyExtractor={(item, idx) => (item.address ? String(item.address) : String(idx))}
                        renderItem={({ item }) => {
                            const label = item.name && item.address
                                ? `${item.name} (${item.address})`
                                : item.name || item.address || JSON.stringify(item);
                            return (
                                <Button
                                    title={label}
                                    onPress={() => connectToPrinter(item.address, item)}
                                />
                            );
                        }}
                    />
                    {connected && !isInnerPrinterConnected && (
                        <View style={{ marginTop: 20 }}>
                            <Button
                                title="🖨️ Print Receipt"
                                onPress={() => printReceipt(exampleTransaction)}
                            />
                        </View>
                    )}
                </>
            )}

            {/* Show print button when InnerPrinter is connected */}
            {isInnerPrinterConnected && (
                <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 16, marginBottom: 10, textAlign: 'center', color: '#22c55e' }}>
                        ✅ Connected to InnerPrinter
                    </Text>
                    <Button
                        title="🖨️ Print Receipt"
                        onPress={() => printReceipt(exampleTransaction)}
                    />
                </View>
            )}
        </View>
    );
}

