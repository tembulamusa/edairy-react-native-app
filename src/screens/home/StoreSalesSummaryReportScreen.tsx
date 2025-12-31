import React, { useCallback, useEffect, useRef, useState } from 'react';
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
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from 'react-native-vector-icons/MaterialIcons';
import DropDownPicker from 'react-native-dropdown-picker';
import StoreSaleModal from '../../components/modals/StoreSaleModal';
import fetchCommonData from '../../components/utils/fetchCommonData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useBluetoothService from '../../hooks/useBluetoothService';
import BluetoothConnectionModal from '../../components/modals/BluetoothConnectionModal';
import SuccessModal from '../../components/modals/SuccessModal';

const SalesReportScreen = () => {
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [saleType, setSaleType] = useState('all');
    const [modalVisible, setModalVisible] = useState(false);
    const [commonData, setCommonData] = useState<any>({});
    const [storeSalesSummary, setStoreSalesSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [canCreateSale, setCanCreateSale] = useState(false);

    // Dropdowns
    const [storeOpen, setStoreOpen] = useState(false);
    const [storeValue, setStoreValue] = useState<number | null>(null);
    const [storeItems, setStoreItems] = useState<any[]>([]);

    const [memberOpen, setMemberOpen] = useState(false);
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState<any[]>([]);

    const [stockOpen, setStockOpen] = useState(false);
    const [stockValue, setStockValue] = useState<number | null>(null);
    const [stockItems, setStockItems] = useState<any[]>([]);

    const [printing, setPrinting] = useState(false);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);

    const {
        devices: printerDevices,
        connectToDevice: connectToPrinterDevice,
        scanForDevices: scanForPrinterDevices,
        connectedDevice: connectedPrinterDevice,
        isScanning: isScanningPrinter,
        isConnecting: isConnectingPrinter,
        disconnect: disconnectPrinter,
        printText: printTextToPrinter,
    } = useBluetoothService({ deviceType: 'printer' });

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


    // Check user permissions
    useEffect(() => {
        const checkUserPermissions = async () => {
            try {
                const userDataString = await AsyncStorage.getItem('user');
                if (userDataString) {
                    const userData = JSON.parse(userDataString);
                    const userGroups = userData?.user_groups || [];
                    
                    // User can create sale if they are employee or transporter
                    const canCreate = userGroups.includes('employee') || userGroups.includes('transporter');
                    setCanCreateSale(canCreate);
                } else {
                    setCanCreateSale(false);
                }
            } catch (error) {
                console.error('Error checking user permissions:', error);
                setCanCreateSale(false);
            }
        };

        checkUserPermissions();
    }, []);

    // Load static common data once
    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [members, stores, stock_items] = await Promise.all([
                    fetchCommonData({ name: 'members' }),
                    fetchCommonData({ name: 'stores' }),
                    fetchCommonData({ name: 'stock_items' }),
                ]);
                const allData = { members, stores, stock_items };
                setCommonData(allData);

                setMemberItems(
                    members?.map((m: any) => ({
                        label: `${m.first_name} ${m.last_name}`,
                        value: m.id,
                    })) || []
                );
                setStoreItems(
                    stores?.map((s: any) => ({
                        label: s.description || s.name || `Store ${s.id}`,
                        value: s.id,
                    })) || []
                );
                setStockItems(
                    stock_items?.map((s: any) => ({
                        label: s.name,
                        value: s.id,
                        unit_price: s.unit_price,
                    })) || []
                );
            } catch (error: any) {
                Alert.alert('Error', `Failed to load common data: ${error.message || error}`);
            }
        };

        loadCommonData();
    }, []);

    useEffect(() => {
        const loadSalesData = async () => {
            try {
                // if no store selected, clear summary
                if (!storeValue) {
                    setStoreSalesSummary([]);
                    return;
                }

                setLoading(true);

                // format dates
                const today = new Date();
                const from = fromDate ? fromDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];
                const to = toDate ? toDate.toISOString().split("T")[0] : today.toISOString().split("T")[0];

                // build filters dynamically
                const params: any = {
                    "created_at_gte": from,
                    // "created_at_lte": to,
                    "store_id": storeValue,
                };

                if (memberValue) params["member_id"] = memberValue;
                if (saleType && saleType !== "all") params["sale_type"] = saleType;

                const data = await fetchCommonData({
                    name: "store_sales",
                    cachable: false,
                    params,
                });
                setStoreSalesSummary(data || []);
            } catch (error) {
                console.error("Error loading sales report:", error);
                Alert.alert("Error", "Failed to load sales report");
            } finally {
                setLoading(false);
            }
        };
        loadSalesData();
    }, [fromDate, toDate, storeValue, memberValue, saleType]);


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




    const totalAmount = storeSalesSummary.reduce(
        (sum, s) => sum + parseFloat(s.total_amount || '0'),
        0
    );

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
                console.log("[StoreSales] persistLastPrinter: Missing id/address, skipping save");
                return;
            }

            await AsyncStorage.setItem("last_device_printer", JSON.stringify(payload));
            console.log("[StoreSales] persistLastPrinter: Saved printer", payload.name);
        } catch (error) {
            console.error("[StoreSales] persistLastPrinter: Failed to save printer", error);
        }
    }, []);

    // Format receipt for store sales summary
    const formatStoreSalesSummaryReceipt = useCallback((
        summaryData: any[],
        selectedStore: any,
        selectedMember: any,
        saleTypeValue: string,
        fromDateValue: Date,
        toDateValue: Date,
        totalAmountValue: number
    ) => {
        let receipt = "";
        receipt += "      E-DAIRY LIMITED\n";
        receipt += "      P.O. Box [P.O. Box Number]\n";
        receipt += "\n\n";
        receipt += "      STORE SALES SUMMARY\n";
        receipt += "================================\n";
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];
        receipt += `Date: ${dateStr} ${timeStr} \n`;
        receipt += `Date Range: ${fromDateValue.toLocaleDateString()} - ${toDateValue.toLocaleDateString()} \n`;
        receipt += `Store: ${selectedStore?.description || selectedStore?.name || 'All'} \n`;
        receipt += `Member: ${selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : 'All'} \n`;
        receipt += `Sale Type: ${saleTypeValue !== 'all' ? saleTypeValue.toUpperCase() : 'All'} \n`;
        receipt += "--------------------------------\n";
        receipt += "Date        Sale Type     Amount\n";
        receipt += "--------------------------------\n";

        if (summaryData.length === 0) {
            receipt += "No sales records found.\n";
        } else {
            summaryData.forEach((item) => {
                const saleDate = item?.created_at
                    ? new Date(item.created_at).toISOString().split("T")[0]
                    : 'N/A';
                const saleTypeName = item?.sale_type || 'N/A';
                const amount = parseFloat(item?.total_amount || 0);
                // Format with fixed width columns
                const datePart = (saleDate.length > 12 ? saleDate.substring(0, 12) : saleDate).padEnd(12, ' ');
                const saleTypePart = (saleTypeName.length > 15 ? saleTypeName.substring(0, 15) : saleTypeName).padEnd(15, ' ');
                receipt += `${datePart}${saleTypePart}${amount.toFixed(2)} KES\n`;
            });
        }

        receipt += "--------------------------------\n";
        receipt += `TOTAL SALES: ${totalAmountValue.toFixed(2)} KES\n`;
        receipt += "================================\n";
        receipt += "Thank you for using eDairy!\n";
        receipt += "================================\n";
        receipt += "Powered by eDairy.africa\n";
        receipt += "\n\n";

        return receipt;
    }, []);

    // Helper: Connect to any available InnerPrinter
    const connectToAnyAvailablePrinter = useCallback(async (): Promise<boolean> => {
        try {
            console.log("[StoreSales] AUTO-CONNECT: Scanning for InnerPrinter...");
            await scanForPrinterDevices();
            await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

            const devices = printerDevicesRef.current || [];
            console.log("[StoreSales] AUTO-CONNECT: Found", devices.length, "printer devices");

            if (devices.length === 0) {
                console.log("[StoreSales] AUTO-CONNECT: No printers found in scan");
                return false;
            }

            const innerPrinters = devices.filter(device => {
                const deviceName = (device.name || '').toLowerCase();
                return deviceName.includes('innerprinter') || deviceName.includes('inner');
            });

            let targetPrinter;
            if (innerPrinters.length > 0) {
                targetPrinter = innerPrinters[0];
                console.log("[StoreSales] AUTO-CONNECT: Found InnerPrinter device:", targetPrinter.name || targetPrinter.id);
            } else {
                targetPrinter = devices[0];
                console.log("[StoreSales] AUTO-CONNECT: No InnerPrinter found, using first available printer:", targetPrinter.name || targetPrinter.id);
            }

            const deviceId = targetPrinter?.id || targetPrinter?.address || targetPrinter?.address_or_id;
            if (!deviceId) {
                console.log("[StoreSales] AUTO-CONNECT: Target printer missing device id");
                return false;
            }

            console.log("[StoreSales] AUTO-CONNECT: Attempting connection to", targetPrinter.name || deviceId);
            const result = await connectToPrinterDevice(deviceId);
            const success = !!result;
            console.log("[StoreSales] AUTO-CONNECT:", success ? "✓ Connected" : "✗ Connection failed");

            if (success) {
                await persistLastPrinter(result);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return success;
        } catch (error) {
            console.error("[StoreSales] AUTO-CONNECT: Error connecting to printer:", error);
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
                    console.error("[StoreSales] AUTO-CONNECT: Failed to parse stored printer:", parseError);
                }

                if (data) {
            const deviceId = data?.id || data?.address || data?.address_or_id;
                    if (deviceId) {
                        console.log("[StoreSales] AUTO-CONNECT: Scanning for saved printer...");
                        await scanForPrinterDevices();
                        await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
                        console.log("[StoreSales] AUTO-CONNECT: Attempting connection to stored printer", deviceId);
            const result = await connectToPrinterDevice(deviceId);
                        const success = !!result;
                        console.log("[StoreSales] AUTO-CONNECT:", success ? "✓ Connected to stored printer" : "✗ Stored printer connection failed");

                        if (success) {
                await persistLastPrinter(result);
                            await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
                            return true;
                        }
                    }
                }
            }

            console.log("[StoreSales] AUTO-CONNECT: Trying to connect to any available InnerPrinter...");
            return await connectToAnyAvailablePrinter();
        } catch (error) {
            console.error("[StoreSales] AUTO-CONNECT: Unexpected error:", error);
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

    const handlePrintReport = async () => {
        if (!storeSalesSummary || storeSalesSummary.length === 0) {
            Alert.alert('No Data', 'There are no sales records to print.');
            return;
        }

        // Get selected store and member
        const selectedStore = (commonData?.stores || []).find((s: any) => s.id === storeValue);
        const selectedMember = (commonData?.customers || []).find((m: any) => m.id === memberValue);

        // Format receipt
        let receiptText = "";
        try {
            receiptText = formatStoreSalesSummaryReceipt(
                storeSalesSummary,
                selectedStore,
                selectedMember,
                saleType,
                fromDate,
                toDate,
                totalAmount
            );
        } catch (formatError) {
            console.error("Error formatting receipt:", formatError);
            Alert.alert("Error", "Failed to format receipt for printing.");
            return;
        }

        setPrinting(true);

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
                setPrinting(false);
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
            setPrinting(false);
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
                <View style={styles.headerRow}>
                    <Text style={styles.title}>Store Sales</Text>
                    {canCreateSale && (
                        <TouchableOpacity
                            style={styles.newSaleButton}
                            onPress={() => setModalVisible(true)}
                        >
                            <Icon name="add-circle-outline" size={22} color="#fff" />
                            <Text style={styles.newSaleText}>New Sale</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.content}>
                    {/* From & To in same row */}
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

                    {/* Store & Member in same row */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Store</Text>
                            <DropDownPicker
                                open={storeOpen}
                                value={storeValue}
                                items={storeItems}
                                setOpen={setStoreOpen}
                                setValue={setStoreValue}
                                setItems={setStoreItems}
                                placeholder="Select Store"
                                listMode="SCROLLVIEW"
                                zIndex={2500}
                                zIndexInverse={2000}
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                searchable={true}
                                searchPlaceholder="Search store..."
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>

                        <View style={styles.col}>
                            <Text style={styles.label}>Member</Text>
                            <DropDownPicker
                                open={memberOpen}
                                value={memberValue}
                                items={memberItems}
                                setOpen={setMemberOpen}
                                setValue={setMemberValue}
                                setItems={setMemberItems}
                                listMode="SCROLLVIEW"
                                searchable={true}
                                placeholder="Select Member"
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                zIndex={2000}
                                zIndexInverse={2500}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>
                    </View>

                    {/* Sale Type */}
                    <Text style={styles.label}>Sale Type</Text>
                    <View style={styles.radioContainer}>
                        {['all', 'cash', 'credit'].map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={styles.radioOption}
                                onPress={() => setSaleType(type)}
                            >
                                <View
                                    style={[
                                        styles.radioCircle,
                                        saleType === type && styles.radioCircleSelected,
                                    ]}
                                />
                                <Text style={styles.radioLabel}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                </View>

                {/* Summary Section */}
                <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>Sales Summary</Text>
                    {loading ? (
                        <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 20 }} />
                    ) : storeSalesSummary?.length === 0 ? (
                        <View style={styles.summaryEmptyState}>
                            <Text style={styles.emptySummaryText}>
                                No sales records found
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={storeSalesSummary}
                            keyExtractor={(item, idx) => idx.toString()}
                            scrollEnabled={false}
                            nestedScrollEnabled={true}
                            renderItem={({ item }) => {
                                const saleDate = item?.created_at 
                                    ? new Date(item.created_at).toISOString().split("T")[0]
                                    : 'N/A';
                                const saleType = item?.sale_type || 'N/A';
                                const amount = isNaN(item?.total_amount) ? 0 : parseFloat(item.total_amount);

                                return (
                                    <View style={styles.summaryRow}>
                                        <View style={styles.summaryLeft}>
                                            <Text style={styles.summaryDate}>{saleDate}</Text>
                                            <Text style={styles.summarySaleType}>{saleType}</Text>
                                        </View>
                                        <Text style={styles.summaryAmount}>
                                            {amount.toFixed(2)} KES
                                        </Text>
                                    </View>
                                );
                            }}
                            ListFooterComponent={() => (
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalLabel}>Total Sales:</Text>
                                    <Text style={styles.totalValue}>
                                        {totalAmount.toFixed(2)} KES
                                    </Text>
                                </View>
                            )}
                        />
                    )}
                </View>

                {/* Print Report Button */}
                <TouchableOpacity
                    style={[
                        styles.generateButton,
                        (printing || isConnectingPrinter || !storeSalesSummary?.length) && { opacity: 0.6 },
                    ]}
                    onPress={handlePrintReport}
                    disabled={printing || isConnectingPrinter || !storeSalesSummary?.length}
                >
                    {printing || isConnectingPrinter ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.generateButtonText}>Print Report</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Modals */}
            <StoreSaleModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={async (data) => {
                    console.log('New Sale Data:', data);
                    Alert.alert('Success', 'New sale saved!');
                    setModalVisible(false);
                    return;
                }}
                commonData={commonData}
            />
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
                                    setPrinting(true);
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
                                        setPrinting(false);
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

export default SalesReportScreen;

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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        marginBottom: 20,
    },
    newSaleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16a34a',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    newSaleText: {
        marginLeft: 6,
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
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
    radioContainer: {
        flexDirection: 'row',
        marginVertical: 10,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    radioCircle: {
        height: 18,
        width: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#1b7f74',
        marginRight: 6,
    },
    radioCircleSelected: {
        backgroundColor: '#1b7f74',
    },
    radioLabel: {
        fontSize: 14,
        color: '#444',
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
    summarySaleType: {
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
    summaryEmptyState: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptySummaryText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
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

