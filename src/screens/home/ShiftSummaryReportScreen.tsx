import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    SafeAreaView,
    Alert,
    FlatList,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DropDownPicker from 'react-native-dropdown-picker';
import fetchCommonData from '../../components/utils/fetchCommonData';
import useBluetoothService from '../../hooks/useBluetoothService';
import BluetoothConnectionModal from '../../components/modals/BluetoothConnectionModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ShiftSummaryReportScreen = () => {
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [commonData, setCommonData] = useState<any>({});
    const [userSummary, setUserSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // Printer hook
    const printerBluetooth = useBluetoothService({ deviceType: "printer" });
    const {
        devices: printerDevices,
        connectToDevice: connectToPrinterDevice,
        scanForDevices: scanForPrinterDevices,
        connectedDevice: connectedPrinterDevice,
        isScanning: isScanningPrinter,
        isConnecting: isConnectingPrinter,
        disconnect: disconnectPrinter,
        printText: printTextToPrinter,
    } = printerBluetooth;

    const printerDevicesRef = useRef<any[]>(printerDevices || []);
    const isMountedRef = useRef(true);

    useEffect(() => {
        printerDevicesRef.current = printerDevices || [];
    }, [printerDevices]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Transporter state
    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState<any[]>([]);

    // Shift filter state
    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<string | number>('all');
    const [shiftItems, setShiftItems] = useState<any[]>([]);

    // Route filter state
    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [routeItems, setRouteItems] = useState<any[]>([]);

    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [transporters, routes, shifts] = await Promise.all([
                    fetchCommonData({ name: 'transporters' }),
                    fetchCommonData({ name: 'routes' }),
                    fetchCommonData({ name: 'shifts' }),
                ]);

                const allData = { transporters, routes, shifts };
                setCommonData(allData);

                setTransporterItems(
                    (transporters || []).map((t: any) => ({
                        label: t.full_names || 'Unnamed Transporter',
                        value: t.id,
                    }))
                );

                setRouteItems([
                    { label: 'All', value: null },
                    ...(routes || []).map((r: any) => ({
                        label: `${r.route_name || r.name || 'Unnamed Route'}${r.route_code ? ` (${r.route_code})` : ''}`,
                        value: r.id,
                    }))
                ]);

                setShiftItems([
                    { label: 'All', value: 'all' },
                    ...(shifts || []).map((s: any) => ({
                        label: s.name || 'Unnamed Shift',
                        value: s.id,
                    }))
                ]);
            } catch (error: any) {
                Alert.alert('Error', `Failed to load common data: ${error.message || error}`);
            }
        };

        loadCommonData();
    }, []);

    const onChangeFromDate = (event: any, selectedDate?: Date) => {
        setShowFromPicker(false);
        if (selectedDate && selectedDate <= new Date()) {
            setFromDate(selectedDate);
            if (selectedDate > toDate) {
                setToDate(selectedDate);
            }
        }
    };

    const onChangeToDate = (event: any, selectedDate?: Date) => {
        setShowToPicker(false);
        if (selectedDate && selectedDate <= new Date() && selectedDate >= fromDate) {
            setToDate(selectedDate);
        }
    };

    useEffect(() => {
        const loadReport = async () => {
            if (transporterValue) {
                try {
                    setUserSummary([]);
                    setLoading(true);
                    const today = new Date();
                    const created_at_gte = fromDate ? fromDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                    const created_at_lte = toDate ? toDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];

                    const filters: any = {
                        created_at_gte,
                        created_at_lte,
                        transporter_id: transporterValue,
                    };

                    if (shiftValue && shiftValue !== 'all') {
                        filters.milk_delivery_shift_id = shiftValue;
                    }

                    if (routeValue) {
                        filters.route_id = routeValue;
                    }
                    const shifts = await fetchCommonData({
                        cachable: false,
                        name: "transporter_shift_summary",
                        params: filters,
                    });

                    if (shifts['error']) {
                        Alert.alert("Error", shifts?.message);
                        return;
                    }
                    setUserSummary(shifts || []);
                } catch (error) {
                    console.error("Error loading user summary:", error);
                    Alert.alert("Error", `Failed to load user summary report ${JSON.stringify(error)} `);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadReport();
    }, [fromDate, toDate, transporterValue, shiftValue, routeValue]);

    // Helper: Persist printer to AsyncStorage
    const persistLastPrinter = useCallback(async (device: any) => {
        if (!device) return;
        try {
            const payload = {
                id: device?.id || device?.address || device?.address_or_id,
                address: device?.address || device?.id || device?.address_or_id,
                name: device?.name || device?.label || "InnerPrinter",
                type: device?.type || "classic",
                saved_at: new Date().toISOString(),
            };

            if (!payload.id || !payload.address) {
                console.log("[ShiftSummary] persistLastPrinter: Missing id/address, skipping save");
                return;
            }

            await AsyncStorage.setItem("last_device_printer", JSON.stringify(payload));
            console.log("[ShiftSummary] persistLastPrinter: Saved printer", payload.name);
        } catch (error) {
            console.error("[ShiftSummary] persistLastPrinter: Failed to save printer", error);
        }
    }, []);

    // Helper: Connect to any available InnerPrinter
    const connectToAnyAvailablePrinter = useCallback(async (): Promise<boolean> => {
        try {
            console.log("[ShiftSummary] AUTO-CONNECT: Scanning for InnerPrinter...");
            await scanForPrinterDevices();
            await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

            const devices = printerDevicesRef.current || [];
            console.log("[ShiftSummary] AUTO-CONNECT: Found", devices.length, "printer devices");

            if (devices.length === 0) {
                console.log("[ShiftSummary] AUTO-CONNECT: No printers found in scan");
                return false;
            }

            const innerPrinters = devices.filter(device => {
                const deviceName = (device.name || '').toLowerCase();
                return deviceName.includes('innerprinter') || deviceName.includes('inner');
            });

            let targetPrinter;
            if (innerPrinters.length > 0) {
                targetPrinter = innerPrinters[0];
                console.log("[ShiftSummary] AUTO-CONNECT: Found InnerPrinter device:", targetPrinter.name || targetPrinter.id);
            } else {
                targetPrinter = devices[0];
                console.log("[ShiftSummary] AUTO-CONNECT: No InnerPrinter found, using first available printer:", targetPrinter.name || targetPrinter.id);
            }

            const deviceId = targetPrinter?.id || targetPrinter?.address || targetPrinter?.address_or_id;
            if (!deviceId) {
                console.log("[ShiftSummary] AUTO-CONNECT: Target printer missing device id");
                return false;
            }

            console.log("[ShiftSummary] AUTO-CONNECT: Attempting connection to", targetPrinter.name || deviceId);
            const result = await connectToPrinterDevice(deviceId);
            const success = !!result;
            console.log("[ShiftSummary] AUTO-CONNECT:", success ? "✓ Connected" : "✗ Connection failed");

            if (success) {
                await persistLastPrinter(result);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return success;
        } catch (error) {
            console.error("[ShiftSummary] AUTO-CONNECT: Error connecting to printer:", error);
            return false;
        }
    }, [scanForPrinterDevices, connectToPrinterDevice, persistLastPrinter]);

    // Helper: Attempt auto-connect (try saved first, then scan for InnerPrinter)
    const attemptAutoConnectPrinter = useCallback(async (): Promise<boolean> => {
        if (connectedPrinterDevice || isConnectingPrinter) {
            return true;
        }

        try {
            const stored = await AsyncStorage.getItem("last_device_printer");
            if (stored) {
                let data: any = null;
                try {
                    data = JSON.parse(stored);
                } catch (parseError) {
                    console.error("[ShiftSummary] AUTO-CONNECT: Failed to parse stored printer:", parseError);
                }

                if (data) {
                    const deviceId = data?.id || data?.address || data?.address_or_id;
                    if (deviceId) {
                        console.log("[ShiftSummary] AUTO-CONNECT: Scanning for saved printer...");
                        await scanForPrinterDevices();
                        await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
                        console.log("[ShiftSummary] AUTO-CONNECT: Attempting connection to stored printer", deviceId);
                        const result = await connectToPrinterDevice(deviceId);
                        const success = !!result;
                        console.log("[ShiftSummary] AUTO-CONNECT:", success ? "✓ Connected to stored printer" : "✗ Stored printer connection failed");

                        if (success) {
                            await persistLastPrinter(result);
                            await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
                            return true;
                        }
                    }
                }
            }

            console.log("[ShiftSummary] AUTO-CONNECT: Trying to connect to any available InnerPrinter...");
            return await connectToAnyAvailablePrinter();
        } catch (error) {
            console.error("[ShiftSummary] AUTO-CONNECT: Unexpected error:", error);
            return false;
        }
    }, [connectToPrinterDevice, scanForPrinterDevices, connectedPrinterDevice, isConnectingPrinter, persistLastPrinter, connectToAnyAvailablePrinter]);

    // Helper: Connect to saved printer or scan and connect to first InnerPrinter
    const connectToPrinterForPrinting = useCallback(async (): Promise<boolean> => {
        try {
            console.log('[PRINT] Step 1: Checking for saved printer in AsyncStorage...');

            try {
                const lastPrinter = await AsyncStorage.getItem('last_device_printer');
                if (lastPrinter) {
                    try {
                        const printerData = JSON.parse(lastPrinter);
                        const deviceId = printerData.id || printerData.address || printerData.address_or_id;

                        if (deviceId) {
                            console.log('[PRINT] Found saved printer:', printerData.name || deviceId);
                            try {
                                const result = await Promise.race([
                                    connectToPrinterDevice(deviceId),
                                    new Promise<null>((_, reject) =>
                                        setTimeout(() => reject(new Error('Connection timeout')), 10000)
                                    )
                                ]);

                                if (result) {
                                    console.log('[PRINT] ✅ Connected to saved printer');
                                    return true;
                                }
                            } catch (connectErr) {
                                console.warn('[PRINT] ⚠️ Error connecting to saved printer:', connectErr);
                            }
                        }
                    } catch (parseErr) {
                        console.warn('[PRINT] Error parsing saved printer:', parseErr);
                    }
                }
            } catch (storageErr) {
                console.warn('[PRINT] Error reading AsyncStorage:', storageErr);
            }

            try {
                console.log('[PRINT] Step 2: Scanning for InnerPrinter devices...');
                await scanForPrinterDevices();
                await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

                const innerPrinters = printerDevices.filter(device => {
                    const deviceName = (device.name || '').toLowerCase();
                    return deviceName.includes('innerprinter') || deviceName.includes('inner');
                });

                if (innerPrinters.length > 0) {
                    const firstInnerPrinter = innerPrinters[0];
                    const deviceId = firstInnerPrinter.id || firstInnerPrinter.address;

                    console.log('[PRINT] Found InnerPrinter:', firstInnerPrinter.name || deviceId);
                    try {
                        const result = await Promise.race([
                            connectToPrinterDevice(deviceId),
                            new Promise<null>((_, reject) =>
                                setTimeout(() => reject(new Error('Connection timeout')), 10000)
                            )
                        ]);

                        if (result) {
                            try {
                                const printerInfo = {
                                    id: firstInnerPrinter.id,
                                    address: firstInnerPrinter.id,
                                    name: firstInnerPrinter.name || 'InnerPrinter',
                                    type: 'classic',
                                    address_or_id: firstInnerPrinter.id,
                                    saved_at: new Date().toISOString()
                                };
                                await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerInfo));
                                console.log('[PRINT] ✅ Connected to InnerPrinter and saved to AsyncStorage');
                                return true;
                            } catch (saveErr) {
                                console.warn('[PRINT] ⚠️ Error saving printer (but connected):', saveErr);
                                return true;
                            }
                        }
                    } catch (connectErr) {
                        console.error('[PRINT] ⚠️ Error connecting to InnerPrinter:', connectErr);
                    }
                }
            } catch (scanErr) {
                console.error('[PRINT] ⚠️ Error scanning for printers:', scanErr);
            }

            return false;
        } catch (error) {
            console.error('[PRINT] Error connecting to printer:', error);
            return false;
        }
    }, [connectToPrinterDevice, scanForPrinterDevices, printerDevices]);

    // Helper: Print receipt using connected printer
    const printReceipt = useCallback(async (receiptText: string, deviceOverride?: any): Promise<boolean> => {
        console.log('[PRINTER] Printing receipt...');

        let printerDevice = deviceOverride || connectedPrinterDevice;

        if (deviceOverride && !connectedPrinterDevice) {
            console.log('[PRINT] Device provided but state not updated yet, waiting for state sync...');
            for (let i = 0; i < 5; i++) {
                await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
                if (connectedPrinterDevice) {
                    console.log('[PRINT] State updated, using state device');
                    printerDevice = connectedPrinterDevice;
                    break;
                }
            }
        }

        if (!printerDevice) {
            console.error('[PRINT] No printer connected');
            if (!deviceOverride && !connectedPrinterDevice) {
                console.log('[PRINT] Waiting for state update (500ms)...');
                await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
                if (connectedPrinterDevice) {
                    console.log('[PRINT] Retrying with updated state...');
                    return printReceipt(receiptText, connectedPrinterDevice);
                }
            }
            try {
                Alert.alert("Printer Not Available", "No printer connected. Please connect a printer to print the receipt.");
            } catch (alertErr) {
                console.error('[PRINT] Error showing alert:', alertErr);
            }
            return false;
        }

        if (!printTextToPrinter) {
            console.error('[PRINT] Print function not available');
            try {
                Alert.alert("Printer Not Available", "Print function is not available. Please check printer connection.");
            } catch (alertErr) {
                console.error('[PRINT] Error showing alert:', alertErr);
            }
            return false;
        }

        try {
            let isStillConnected = false;
            if (printerDevice.type === 'ble' && printerDevice.bleDevice) {
                isStillConnected = (printerDevice.bleDevice as any).isConnected === true;
            } else if (printerDevice.type === 'classic' && printerDevice.classicDevice) {
                try {
                    isStillConnected = await printerDevice.classicDevice.isConnected();
                } catch (checkErr) {
                    console.warn('[PRINT] Error checking connection status:', checkErr);
                    isStillConnected = false;
                }
            }

            if (!isStillConnected) {
                console.error('[PRINT] Printer device is not connected');
                try {
                    Alert.alert("Printer Not Connected", "The printer is not connected. Please check the connection and try again.");
                } catch (alertErr) {
                    console.error('[PRINT] Error showing alert:', alertErr);
                }
                return false;
            }
        } catch (checkErr) {
            console.error('[PRINT] Error verifying printer connection:', checkErr);
            try {
                Alert.alert("Printer Connection Error", "Unable to verify printer connection. Please check the printer and try again.");
            } catch (alertErr) {
                console.error('[PRINT] Error showing alert:', alertErr);
            }
            return false;
        }

        try {
            console.log('[PRINT] Starting print operation...');
            let printPromise: Promise<void>;
            try {
                printPromise = printTextToPrinter(receiptText);
                if (!printPromise || typeof printPromise.then !== 'function') {
                    console.error('[PRINT] Print function did not return a promise');
                    try {
                        Alert.alert("Print Error", "Print function error. Please try again.");
                    } catch (alertErr) {
                        console.error('[PRINT] Error showing alert:', alertErr);
                    }
                    return false;
                }
            } catch (syncErr) {
                console.error('[PRINT] Synchronous error calling print function:', syncErr);
                try {
                    Alert.alert("Print Error", "Failed to start printing. Please check the printer connection.");
                } catch (alertErr) {
                    console.error('[PRINT] Error showing alert:', alertErr);
                }
                return false;
            }

            try {
                await Promise.race([
                    printPromise,
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Print timeout')), 30000)
                    )
                ]);

                console.log('[PRINT] ✅ Receipt printed successfully');
                return true;
            } catch (timeoutErr) {
                const errorMsg = (timeoutErr as any)?.message || String(timeoutErr);
                console.error('[PRINT] Print timeout or error:', errorMsg);
                try {
                    if (errorMsg.includes('timeout')) {
                        Alert.alert("Print Timeout", "Printing took too long. Please check the printer and try again.");
                    } else {
                        Alert.alert("Print Error", "Failed to print receipt. Please check the printer connection and try again.");
                    }
                } catch (alertErr) {
                    console.error('[PRINT] Error showing alert:', alertErr);
                }
                return false;
            }
        } catch (error) {
            const errorMsg = (error as any)?.message || String(error);
            console.error('[PRINT] Print error:', errorMsg);
            try {
                Alert.alert("Print Error", "An error occurred while printing. Please check the printer and try again.");
            } catch (alertErr) {
                console.error('[PRINT] Error showing alert:', alertErr);
            }
            return false;
        }
    }, [connectedPrinterDevice, printTextToPrinter]);

    // Format receipt for shift summary
    const formatShiftSummaryReceipt = (
        summaryData: any[],
        selectedTransporter: any,
        selectedShift: any,
        selectedRoute: any,
        fromDate: Date,
        toDate: Date
    ) => {
        // Calculate total quantity
        const totalQuantity = summaryData.reduce((sum, item) => {
            const quantity = parseFloat(item?.quantity || item?.kgs || 0);
            return sum + quantity;
        }, 0);

        let receipt = "";
        receipt += "      E-DAIRY LIMITED\n";
        receipt += "      P.O. Box [P.O. Box Number]\n";
        receipt += "\n\n";
        receipt += "      TRANSPORTER SHIFT SUMMARY\n";
        receipt += "================================\n";
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];
        receipt += `Date: ${dateStr} ${timeStr} \n`;
        receipt += `Date Range: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()} \n`;
        receipt += `Transporter: ${selectedTransporter?.full_names || 'N/A'} \n`;
        if (selectedShift && selectedShift !== 'all') {
            receipt += `Shift: ${selectedShift?.name || selectedShift || 'N/A'} \n`;
        }
        if (selectedRoute) {
            receipt += `Route: ${selectedRoute?.route_name || selectedRoute?.name || 'N/A'} \n`;
        }
        receipt += "--------------------------------\n";
        receipt += "Date        Shift          KGs\n";
        receipt += "--------------------------------\n";

        summaryData.forEach((item) => {
            const transactionDate = item?.transaction_date
                ? new Date(item.transaction_date).toLocaleDateString()
                : 'N/A';
            const shiftName = item?.shift?.name || item?.shift_name || 'N/A';
            const quantity = parseFloat(item?.quantity || item?.kgs || 0);
            // Format with fixed width columns to prevent overflow
            // Date: 12 chars, Shift: 15 chars, KGs: rest
            const datePart = (transactionDate.length > 12 ? transactionDate.substring(0, 12) : transactionDate).padEnd(12, ' ');
            const shiftPart = (shiftName.length > 15 ? shiftName.substring(0, 15) : shiftName).padEnd(15, ' ');
            receipt += `${datePart}${shiftPart}${quantity.toFixed(2)} KG\n`;
        });

        receipt += "--------------------------------\n";
        receipt += `TOTAL: ${totalQuantity.toFixed(2)} KG\n`;
        receipt += "================================\n";
        receipt += "Thank you!\n";
        receipt += "================================\n";
        receipt += "Powered by eDairy.africa\n";
        receipt += "\n\n";

        return receipt;
    };

    const handleGenerate = async () => {
        if (userSummary.length === 0) {
            Alert.alert("No Data", "No data available to print. Please load the report first.");
            return;
        }

        // Get selected transporter, shift, and route
        const selectedTransporter = (commonData?.transporters || []).find((t: any) => t.id === transporterValue);
        const selectedShift = shiftValue !== 'all' ? (commonData?.shifts || []).find((s: any) => s.id === shiftValue) : null;
        const selectedRoute = (commonData?.routes || []).find((r: any) => r.id === routeValue);

        // Format receipt
        let receiptText = "";
        try {
            receiptText = formatShiftSummaryReceipt(
                userSummary,
                selectedTransporter,
                selectedShift,
                selectedRoute,
                fromDate,
                toDate
            );
        } catch (formatError) {
            console.error("Error formatting receipt:", formatError);
            Alert.alert("Error", "Failed to format receipt for printing.");
            return;
        }

        setIsPrinting(true);

        try {
            let connectedPrinter: any = null;

            if (connectedPrinterDevice) {
                try {
                    let isStillConnected = false;
                    if (connectedPrinterDevice.type === 'ble' && connectedPrinterDevice.bleDevice) {
                        isStillConnected = (connectedPrinterDevice.bleDevice as any).isConnected === true;
                    } else if (connectedPrinterDevice.type === 'classic' && connectedPrinterDevice.classicDevice) {
                        isStillConnected = await connectedPrinterDevice.classicDevice.isConnected();
                    }
                    if (isStillConnected) {
                        console.log('[PRINT] Printer already connected');
                        connectedPrinter = connectedPrinterDevice;
                    }
                } catch (checkErr) {
                    console.warn('[PRINT] Error checking existing connection:', checkErr);
                }
            }

            if (!connectedPrinter) {
                try {
                    console.log('[PRINT] Attempting auto-connect...');
                    const connected = await connectToPrinterForPrinting();
                    if (connected) {
                        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
                        if (connectedPrinterDevice) {
                            connectedPrinter = connectedPrinterDevice;
                        }
                    }
                } catch (connectErr) {
                    console.error('[PRINT] Error connecting:', connectErr);
                }
            }

            if (!connectedPrinter) {
                console.log('[PRINT] No printer, showing modal');
                if (!isMountedRef.current) return;
                setIsPrinting(false);
                setPrinterModalVisible(true);
                try {
                    await AsyncStorage.setItem('pending_receipt', receiptText);
                } catch (storageErr) {
                    console.error('[PRINT] Storage error:', storageErr);
                }
                return;
            }

            await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));

            if (!isMountedRef.current) return;

            let printSuccess = false;
            try {
                printSuccess = await printReceipt(receiptText, connectedPrinter);
                if (printSuccess) {
                    Alert.alert("Success", "Report printed successfully!");
                }
            } catch (printErr) {
                console.error('[PRINT] Error during printing:', printErr);
                printSuccess = false;
            }

        } catch (printerError) {
            console.error("[PRINT] Unexpected error:", printerError);
            Alert.alert("Error", "An error occurred while printing. Please try again.");
        } finally {
            if (!isMountedRef.current) return;
            setIsPrinting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
            >
                <Text style={styles.title}>Transporter Shift Summary</Text>
                <View style={styles.content}>
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Transporter</Text>
                            <DropDownPicker
                                listMode="SCROLLVIEW"
                                open={transporterOpen}
                                value={transporterValue}
                                items={transporterItems}
                                setOpen={setTransporterOpen}
                                setValue={setTransporterValue}
                                setItems={setTransporterItems}
                                searchable={true}
                                placeholder="Select transporter"
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                zIndex={2000}
                                zIndexInverse={2500}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>
                    </View>

                    {/* Shift + Route Filters Row */}
                    <View style={[styles.row]}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Shift</Text>
                            <DropDownPicker
                                listMode="SCROLLVIEW"
                                open={shiftOpen}
                                value={shiftValue}
                                items={shiftItems}
                                setOpen={setShiftOpen}
                                setValue={setShiftValue}
                                setItems={setShiftItems}
                                placeholder="Select shift"
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                zIndex={1800}
                                zIndexInverse={2800}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>

                        <View style={styles.col}>
                            <Text style={styles.label}>Route</Text>
                            <DropDownPicker
                                listMode="SCROLLVIEW"
                                open={routeOpen}
                                value={routeValue}
                                items={routeItems}
                                setOpen={setRouteOpen}
                                setValue={setRouteValue}
                                setItems={setRouteItems}
                                searchable={true}
                                placeholder="Select route"
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                zIndex={1700}
                                zIndexInverse={2900}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>
                    </View>

                    {/* Date Filters Row */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>From</Text>
                            <View style={styles.inputWithIcon}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Select From Date"
                                    value={fromDate.toDateString()}
                                    editable={false}
                                />
                                <TouchableOpacity
                                    style={styles.iconInside}
                                    onPress={() => setShowFromPicker(true)}
                                >
                                    <Icon name="calendar-today" size={20} color="#666" />
                                </TouchableOpacity>
                            </View>
                            {showFromPicker && (
                                <DateTimePicker
                                    value={fromDate}
                                    mode="date"
                                    maximumDate={new Date()}
                                    display="default"
                                    onChange={onChangeFromDate}
                                />
                            )}
                        </View>

                        <View style={styles.col}>
                            <Text style={styles.label}>To</Text>
                            <View style={styles.inputWithIcon}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Select To Date"
                                    value={toDate.toDateString()}
                                    editable={false}
                                />
                                <TouchableOpacity
                                    style={styles.iconInside}
                                    onPress={() => setShowToPicker(true)}
                                >
                                    <Icon name="calendar-today" size={20} color="#666" />
                                </TouchableOpacity>
                            </View>
                            {showToPicker && (
                                <DateTimePicker
                                    value={toDate}
                                    mode="date"
                                    minimumDate={fromDate}
                                    maximumDate={new Date()}
                                    display="default"
                                    onChange={onChangeToDate}
                                />
                            )}
                        </View>
                    </View>
                </View>
                <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>Transporter Shift Summary</Text>
                    {loading ? (
                        <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 20 }} />
                    ) : userSummary.length === 0 ? (
                        <Text style={{ textAlign: 'center', marginVertical: 20, color: '#666' }}>
                            No records found
                        </Text>
                    ) : (
                        <FlatList
                            data={userSummary}
                            keyExtractor={(item, idx) => idx.toString()}
                            scrollEnabled={false}
                            nestedScrollEnabled={true}
                            renderItem={({ item }) => {
                                // Format date
                                const transactionDate = item?.transaction_date
                                    ? new Date(item.transaction_date).toLocaleDateString()
                                    : 'N/A';

                                // Get shift name
                                const shiftName = item?.shift?.name || item?.shift_name || 'N/A';

                                // Get quantity (kgs)
                                const quantity = parseFloat(item?.quantity || item?.kgs || 0);

                                return (
                                    <View style={styles.summaryRow}>
                                        <View style={styles.summaryLeft}>
                                            <Text style={styles.summaryDate}>{transactionDate}</Text>
                                            <Text style={styles.summaryShift}>{shiftName}</Text>
                                        </View>
                                        <Text style={styles.summaryAmount}>
                                            {quantity.toFixed(2)} KG
                                        </Text>
                                    </View>
                                );
                            }}
                            ListFooterComponent={() => {
                                // Calculate total quantity
                                const totalQuantity = userSummary.reduce((sum, item) => {
                                    const quantity = parseFloat(item?.quantity || item?.kgs || 0);
                                    return sum + quantity;
                                }, 0);

                                return (
                                    <View style={styles.totalRow}>
                                        <Text style={styles.totalLabel}>Total</Text>
                                        <Text style={styles.totalValue}>{totalQuantity.toFixed(2)} KG</Text>
                                    </View>
                                );
                            }}
                        />
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.generateButton, isPrinting && { opacity: 0.6 }]}
                            onPress={handleGenerate}
                            disabled={isPrinting || loading}
                        >
                            {isPrinting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.generateButtonText}>Print Report</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Printer Connection Modal */}
            <BluetoothConnectionModal
                visible={printerModalVisible}
                onClose={() => {
                    setPrinterModalVisible(false);
                }}
                type="device-list"
                deviceType="printer"
                title="Select Printer"
                devices={printerDevices}
                connectToDevice={async (id: string) => {
                    try {
                        const result = await connectToPrinterDevice(id);
                        if (result) {
                            // Save printer
                            try {
                                const isInnerPrinter = (result.name || '').toLowerCase().includes('innerprinter') ||
                                    (result.name || '').toLowerCase().includes('inner');
                                const printerType = isInnerPrinter ? 'classic' : (result.type || 'classic');

                                const printerInfo = {
                                    id: result.id,
                                    address: result.id,
                                    name: result.name || 'Printer',
                                    type: printerType,
                                    address_or_id: result.id,
                                    saved_at: new Date().toISOString()
                                };
                                await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerInfo));
                            } catch (saveErr) {
                                console.error('[PRINT] Error saving printer:', saveErr);
                            }

                            // Print pending receipt if exists
                            try {
                                const pendingReceipt = await AsyncStorage.getItem('pending_receipt');
                                if (pendingReceipt) {
                                    setIsPrinting(true);
                                    try {
                                        const printSuccess = await printReceipt(pendingReceipt);
                                        if (printSuccess) {
                                            await AsyncStorage.removeItem('pending_receipt');
                                            Alert.alert("Success", "Report printed successfully!");
                                        } else {
                                            console.warn('[PRINT] Failed to print pending receipt');
                                        }
                                    } catch (printErr) {
                                        console.error('[PRINT] Error printing pending receipt:', printErr);
                                        try {
                                            Alert.alert("Print Error", "Failed to print receipt. Please check the printer and try again.");
                                        } catch (alertErr) {
                                            console.error('[PRINT] Error showing alert:', alertErr);
                                        }
                                    } finally {
                                        setIsPrinting(false);
                                    }
                                }
                            } catch (receiptErr) {
                                console.error('[PRINT] Error handling pending receipt:', receiptErr);
                                try {
                                    Alert.alert("Error", "Failed to retrieve pending receipt. Please try printing again.");
                                } catch (alertErr) {
                                    console.error('[PRINT] Error showing alert:', alertErr);
                                }
                            }

                            setPrinterModalVisible(false);
                        }
                        return result;
                    } catch (err) {
                        console.error('[PRINT] Error in printer modal connect:', err);
                        return null;
                    }
                }}
                scanForDevices={scanForPrinterDevices}
                isScanning={isScanningPrinter}
                isConnecting={isConnectingPrinter}
                connectedDevice={connectedPrinterDevice}
                disconnect={disconnectPrinter}
            />
        </SafeAreaView>
    );
};

export default ShiftSummaryReportScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    content: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    col: {
        flex: 1,
        marginHorizontal: 4,
    },
    label: {
        fontSize: 14,
        marginBottom: 6,
        color: '#333',
    },
    inputWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 8,
        paddingRight: 40,
        backgroundColor: '#fff',
        fontSize: 14,
        color: '#333',
    },
    iconInside: {
        position: 'absolute',
        right: 8,
        padding: 4,
    },
    dropdown: {
        borderRadius: 6,
        borderColor: '#ddd',
        backgroundColor: '#fff',
        minHeight: 40,
    },
    dropdownBox: {
        borderColor: '#ddd',
        backgroundColor: '#fff',
        borderRadius: 6,
    },
    summarySection: {
        marginTop: 20,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
    },
    generateButton: {
        backgroundColor: '#16a34a',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    summaryLeft: {
        flex: 1,
    },
    summaryDate: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
        marginBottom: 2,
    },
    summaryShift: {
        fontSize: 13,
        color: '#666',
    },
    summaryAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#16a34a',
        minWidth: 80,
        textAlign: 'right',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: '#ccc',
        marginTop: 6,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#222',
    },
    totalValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#16a34a',
    },
});
