// src/screens/home/OfflineMilkCollectionScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    TextInput,
    ActivityIndicator,
    ScrollView,
    FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
// @ts-ignore
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import NetInfo from '@react-native-community/netinfo';
import useBluetoothService from "../../hooks/useBluetoothService";
import BluetoothConnectionModal from '../../components/modals/BluetoothConnectionModal';
import SuccessModal from "../../components/modals/SuccessModal";
import { globalStyles } from "../../styles";
import {
    initDatabase,
    insertOfflineCollection,
    getUnsyncedCount,
    getAllCollections,
    getMeasuringCan,
    getShifts,
    getMeasuringCans,
} from "../../services/offlineDatabase";
import { syncAllCollections, checkConnectivity, syncWithConfirmation } from "../../services/offlineSync";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all";

const OfflineMilkCollectionScreen = () => {
    // Basic states
    const [memberNumber, setMemberNumber] = useState<string>("");
    const [canNumber, setCanNumber] = useState<string>("");
    const [scaleWeight, setScaleWeight] = useState<number | null>(null);
    const [scaleWeightText, setScaleWeightText] = useState<string>("");
    const [tareWeight, setTareWeight] = useState<string>("0");
    const [measuringCan, setMeasuringCan] = useState<any | null>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [totalCans, setTotalCans] = useState<number>(0);
    const [totalQuantity, setTotalQuantity] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
    const [isOnline, setIsOnline] = useState<boolean>(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Modal states
    const [scaleModalVisible, setScaleModalVisible] = useState(false);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [collectionHistory, setCollectionHistory] = useState<any[]>([]);
    const [isPrinting, setIsPrinting] = useState(false);

    // Shift states
    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [shiftItems, setShiftItems] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);

    // Measuring can selection states
    const [measuringCanOpen, setMeasuringCanOpen] = useState(false);
    const [measuringCanValue, setMeasuringCanValue] = useState<number | null>(null);
    const [measuringCanItems, setMeasuringCanItems] = useState<any[]>([]);
    const [measuringCans, setMeasuringCans] = useState<any[]>([]);

    const isMountedRef = useRef(true);

    // Scale hook
    const scaleHook = useBluetoothService({ deviceType: "scale" });
    const {
        devices: scaleDevices,
        connectToDevice: connectToScaleDevice,
        scanForDevices: scanForScaleDevices,
        connectedDevice: connectedScaleDevice,
        lastMessage,
        isScanning: isScanningScale,
        isConnecting: isConnectingScale,
        disconnect: disconnectScale,
    } = scaleHook;

    // Printer hook for printing operations
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

    // Update printer devices ref
    useEffect(() => {
        printerDevicesRef.current = printerDevices || [];
    }, [printerDevices]);

    // Initialize database and load data on mount
    useEffect(() => {
        const init = async () => {
            try {
                await initDatabase();
                
                // Load shifts from SQLite
                const savedShifts = await getShifts();
                if (savedShifts && savedShifts.length > 0) {
                    setShifts(savedShifts);
                    const items = savedShifts.map((s: any) => ({
                        label: s.name,
                        value: s.id
                    }));
                    setShiftItems(items);
                    console.log('[OFFLINE] Loaded', savedShifts.length, 'shifts from database');

                    // Auto-select shift based on current time period (morning, afternoon, evening)
                    const currentTime = new Date();
                    const currentHours = currentTime.getHours();

                    // Determine current time period
                    let currentPeriod: string;
                    if (currentHours >= 6 && currentHours < 12) {
                        currentPeriod = "morning";
                    } else if (currentHours >= 12 && currentHours < 18) {
                        currentPeriod = "afternoon";
                    } else {
                        // Evening: 18:00 (6 PM) to 06:00 (6 AM next day)
                        currentPeriod = "evening";
                    }

                    console.log(`[OFFLINE] Current time: ${currentHours}:${currentTime.getMinutes()} - Period: ${currentPeriod}`);
                    console.log(`[OFFLINE] Available shifts:`, savedShifts.map((s: any) => ({ id: s.id, name: s.name, time: s.time })));

                    // Find shift that matches current time period
                    const matchingShift = savedShifts.find((s: any) => {
                        if (!s.time) {
                            console.log(`[OFFLINE] Shift ${s.id} (${s.name}) has no time field`);
                            return false;
                        }

                        // Normalize the time field to lowercase and remove any extra whitespace
                        const shiftTime = s.time.toString().trim().toLowerCase();

                        // More flexible matching - check if the time field contains the period
                        // This handles cases like "Morning Shift", "morning", "MORNING", etc.
                        const matches = shiftTime === currentPeriod ||
                            shiftTime.includes(currentPeriod) ||
                            currentPeriod.includes(shiftTime);

                        console.log(`[OFFLINE] Shift ${s.id} (${s.name}): time="${s.time}" -> normalized="${shiftTime}", currentPeriod="${currentPeriod}", matches=${matches}`);

                        return matches;
                    });

                    if (matchingShift) {
                        setShiftValue(matchingShift.id);
                        console.log(`[OFFLINE] ✅ Auto-selected shift: ${matchingShift.name} (ID: ${matchingShift.id}) - Time period: ${currentPeriod}`);
                    } else {
                        console.log(`[OFFLINE] ❌ No shift found matching current time period: ${currentPeriod}`);
                        console.log(`[OFFLINE] Available shift times:`, savedShifts.map((s: any) => s.time).filter(Boolean));
                    }
                } else {
                    console.log('[OFFLINE] No shifts found in database');
                }

                // Load measuring cans from SQLite
                const savedMeasuringCans = await getMeasuringCans();
                if (savedMeasuringCans && savedMeasuringCans.length > 0) {
                    setMeasuringCans(savedMeasuringCans);
                    const canItems = savedMeasuringCans.map((c: any) => ({
                        label: `${c.can_id} (Tare: ${c.tare_weight} KG)`,
                        value: c.id
                    }));
                    setMeasuringCanItems(canItems);
                    console.log('[OFFLINE] Loaded', savedMeasuringCans.length, 'measuring cans from database');

                    // Try to load saved measuring can from settings
                    const storedUser = await AsyncStorage.getItem("user");
                    if (storedUser) {
                        const userData = JSON.parse(storedUser);
                        const savedCan = await getMeasuringCan(userData.member_id);
                        if (savedCan) {
                            // Find matching can in loaded cans
                            const matchingCan = savedMeasuringCans.find((c: any) => c.id === savedCan.id);
                            if (matchingCan) {
                                setMeasuringCanValue(matchingCan.id);
                                setMeasuringCan(matchingCan);
                                setTareWeight(String(matchingCan.tare_weight || 0));
                                console.log('[OFFLINE] Auto-selected saved measuring can:', matchingCan.can_id);
                            }
                        }
                    }
                } else {
                    console.log('[OFFLINE] No measuring cans found in database');
                }
            } catch (error) {
                console.error('[OFFLINE] Failed to initialize:', error);
                Alert.alert("Database Error", "Failed to initialize offline storage");
            }
        };

        init();

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Load unsynced count
    const loadUnsyncedCount = useCallback(async () => {
        try {
            const count = await getUnsyncedCount();
            setUnsyncedCount(count);
        } catch (error) {
            console.error('[OFFLINE] Error loading unsynced count:', error);
        }
    }, []);

    useEffect(() => {
        loadUnsyncedCount();
        // Refresh count every 30 seconds
        const interval = setInterval(loadUnsyncedCount, 30000);
        return () => clearInterval(interval);
    }, [loadUnsyncedCount]);

    // Monitor network connectivity
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected === true && state.isInternetReachable === true);
        });

        // Check initial state
        checkConnectivity().then(setIsOnline);

        return () => unsubscribe();
    }, []);

    // Update scale weight from Bluetooth
    useEffect(() => {
        try {
            if (lastMessage !== null && lastMessage !== undefined && connectedScaleDevice) {
                const weight = parseFloat(lastMessage);
                if (!isNaN(weight) && isFinite(weight) && weight >= 0 && weight <= 1000) {
                    setScaleWeight(weight);
                    setScaleWeightText("");
                }
            } else if (!connectedScaleDevice) {
                setScaleWeight(null);
            }
        } catch (error) {
            console.error('[OFFLINE] Error processing scale weight:', error);
            setScaleWeight(null);
        }
    }, [lastMessage, connectedScaleDevice]);

    // Auto-connect to last scale
    useEffect(() => {
        const autoConnectToLastScale = async () => {
            if (!isMountedRef.current) return;
            try {
                if (connectedScaleDevice) return;

                const lastScale = await AsyncStorage.getItem('last_device_scale');
                if (!lastScale) return;

                const deviceData = JSON.parse(lastScale);
                const deviceId = deviceData.id || deviceData.address || deviceData.address_or_id;
                if (!deviceId) return;

                console.log('[OFFLINE] Auto-connecting to scale...');
                scanForScaleDevices();
                await new Promise(resolve => setTimeout(resolve, 3000));

                if (!isMountedRef.current) return;
                await connectToScaleDevice(deviceId);
            } catch (error) {
                console.error('[OFFLINE] Auto-connect failed:', error);
            }
        };

        const timeout = setTimeout(autoConnectToLastScale, 2000);
        return () => clearTimeout(timeout);
    }, []);

    // Take weight and add to entries
    const takeWeight = () => {
        try {
            if (scaleWeight === null || scaleWeight === undefined || !isFinite(scaleWeight) || scaleWeight < 0) {
                Alert.alert("No weight", "No valid weight available to record.");
                return;
            }

            const tare = parseFloat(tareWeight) || 0;
            const net = parseFloat((scaleWeight - tare).toFixed(2));

            if (!isFinite(net) || net < 0) {
                Alert.alert("Invalid Weight", `Net weight is invalid (${net.toFixed(2)} KG).`);
                return;
            }

            if (net > 1000) {
                Alert.alert("Suspicious Weight", `Net weight seems unusually high (${net.toFixed(2)} KG).`);
                return;
            }

            const entry = {
                can_label: `Can ${entries.length + 1}`,
                scale_weight: scaleWeight,
                tare_weight: tare,
                net,
                timestamp: new Date().toISOString(),
            };

            setEntries(prev => [...prev, entry]);
            setTotalCans(prev => prev + 1);
            setTotalQuantity(prev => prev + net);

            // Clear for next entry
            setScaleWeight(null);
            setScaleWeightText("");
        } catch (error) {
            console.error('[OFFLINE] Error in takeWeight:', error);
            Alert.alert("Error", "An error occurred while recording the weight.");
        }
    };

    // Remove entry
    const removeEntry = (index: number) => {
        setEntries(prev => {
            const newEntries = prev.filter((_, i) => i !== index);
            const newTotal = newEntries.reduce((sum, e) => sum + e.net, 0);
            setTotalQuantity(newTotal);
            setTotalCans(newEntries.length);
            return newEntries;
        });
    };

    // Handle measuring can selection
    const handleMeasuringCanChange = (canId: number | null) => {
        if (canId === null) {
            setMeasuringCan(null);
            setTareWeight("0");
            return;
        }

        const selectedCan = measuringCans.find((c: any) => c.id === canId);
        if (selectedCan) {
            setMeasuringCan(selectedCan);
            setTareWeight(String(selectedCan.tare_weight || 0));
            console.log('[OFFLINE] Selected measuring can:', selectedCan.can_id, 'Tare:', selectedCan.tare_weight);
        }
    };

    // Format receipt for offline collection
    const formatOfflineCollectionReceipt = (
        capturedMemberNumber: string,
        capturedCanNumber: string,
        capturedEntries: any[],
        capturedTotalCans: number,
        capturedTotalQuantity: number,
        capturedShiftName: string,
        capturedMeasuringCanName: string
    ) => {
        let receipt = "";
        receipt += "      E-DAIRY LIMITED\n";
        receipt += "      P.O. Box [P.O. Box Number]\n";
        receipt += "\n\n";
        receipt += "   OFFLINE MILK COLLECTION\n";
        receipt += "================================\n";
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];
        receipt += `Date: ${dateStr} ${timeStr}\n`;
        receipt += `Member No: ${capturedMemberNumber}\n`;
        if (capturedCanNumber) {
            receipt += `Can Number: ${capturedCanNumber}\n`;
        }
        if (capturedShiftName) {
            receipt += `Shift: ${capturedShiftName}\n`;
        }
        if (capturedMeasuringCanName) {
            receipt += `Measuring Can: ${capturedMeasuringCanName}\n`;
        }
        receipt += "--------------------------------\n";
        receipt += `Total Cans: ${capturedTotalCans}\n`;
        receipt += `Total Quantity: ${capturedTotalQuantity.toFixed(2)} KG\n`;
        receipt += "--------------------------------\n";
        receipt += "Cans Details:\n";

        (capturedEntries || []).forEach((entry: any, index: number) => {
            receipt += `${index + 1}. ${entry.can_label} - Net: ${entry.net.toFixed(2)} KG\n`;
        });

        receipt += "--------------------------------\n";
        receipt += `TOTAL NET WEIGHT: ${capturedTotalQuantity.toFixed(2)} KG\n`;
        receipt += "================================\n";
        receipt += "Thank you for your delivery!\n";
        receipt += "NOTE: Collected Offline\n";
        receipt += "Will sync when online\n";
        receipt += "================================\n";
        receipt += "Powered by eDairy.africa\n";
        receipt += "\n\n";

        return receipt;
    };

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
                console.log("[OFFLINE] persistLastPrinter: Missing id/address");
                return;
            }

            await AsyncStorage.setItem("last_device_printer", JSON.stringify(payload));
            console.log("[OFFLINE] persistLastPrinter: Saved printer", payload.name);
        } catch (error) {
            console.error("[OFFLINE] persistLastPrinter: Failed", error);
        }
    }, []);

    // Helper: Connect to any available InnerPrinter
    const connectToAnyAvailablePrinter = useCallback(async (): Promise<boolean> => {
        try {
            console.log("[OFFLINE] AUTO-CONNECT: Scanning for InnerPrinter...");
            await scanForPrinterDevices();
            await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

            const devices = printerDevicesRef.current || [];
            console.log("[OFFLINE] AUTO-CONNECT: Found", devices.length, "printer devices");

            if (devices.length === 0) return false;

            const innerPrinters = devices.filter(device => {
                const deviceName = (device.name || '').toLowerCase();
                return deviceName.includes('innerprinter') || deviceName.includes('inner');
            });

            let targetPrinter = innerPrinters.length > 0 ? innerPrinters[0] : devices[0];
            const deviceId = targetPrinter?.id || targetPrinter?.address || targetPrinter?.address_or_id;

            if (!deviceId) return false;

            console.log("[OFFLINE] AUTO-CONNECT: Connecting to", targetPrinter.name || deviceId);
            const result = await connectToPrinterDevice(deviceId);
            const success = !!result;

            if (success) {
                await persistLastPrinter(result);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return success;
        } catch (error) {
            console.error("[OFFLINE] AUTO-CONNECT: Error:", error);
            return false;
        }
    }, [scanForPrinterDevices, connectToPrinterDevice, persistLastPrinter]);

    // Helper: Attempt auto-connect
    const attemptAutoConnectPrinter = useCallback(async (): Promise<boolean> => {
        if (connectedPrinterDevice || isConnectingPrinter) return true;

        try {
            const stored = await AsyncStorage.getItem("last_device_printer");
            if (stored) {
                const data = JSON.parse(stored);
                const deviceId = data?.id || data?.address || data?.address_or_id;
                if (deviceId) {
                    console.log("[OFFLINE] AUTO-CONNECT: Trying stored printer");
                    await scanForPrinterDevices();
                    await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
                    const result = await connectToPrinterDevice(deviceId);
                    if (result) {
                        await persistLastPrinter(result);
                        await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
                        return true;
                    }
                }
            }

            return await connectToAnyAvailablePrinter();
        } catch (error) {
            console.error("[OFFLINE] AUTO-CONNECT: Error:", error);
            return false;
        }
    }, [connectToPrinterDevice, scanForPrinterDevices, connectedPrinterDevice, isConnectingPrinter, persistLastPrinter, connectToAnyAvailablePrinter]);

    // Helper: Print receipt
    const printReceipt = useCallback(async (receiptText: string, deviceOverride?: any): Promise<boolean> => {
        console.log('[OFFLINE-PRINT] Printing receipt...');

        let printerDevice = deviceOverride || connectedPrinterDevice;

        if (!printerDevice) {
            console.error('[OFFLINE-PRINT] No printer connected');
            Alert.alert("Printer Not Available", "No printer connected. Please connect a printer to print the receipt.");
            return false;
        }

        if (!printTextToPrinter) {
            console.error('[OFFLINE-PRINT] Print function not available');
            Alert.alert("Printer Not Available", "Print function is not available.");
            return false;
        }

        try {
            console.log('[OFFLINE-PRINT] Starting print operation...');
            await Promise.race([
                printTextToPrinter(receiptText),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Print timeout')), 30000)
                )
            ]);

            console.log('[OFFLINE-PRINT] ✅ Receipt printed successfully');
            return true;
        } catch (error) {
            const errorMsg = (error as any)?.message || String(error);
            console.error('[OFFLINE-PRINT] Print error:', errorMsg);
            Alert.alert("Print Error", "Failed to print receipt. Please check the printer connection.");
            return false;
        }
    }, [connectedPrinterDevice, printTextToPrinter]);

    // Save collection offline
    const saveCollection = async () => {
        try {
            if (!memberNumber.trim()) {
                Alert.alert("Required Field", "Please enter member number");
                return;
            }

            if (entries.length === 0) {
                Alert.alert("No Data", "Please record at least one can");
                return;
            }

            setLoading(true);

            // Capture data before clearing
            const capturedMemberNumber = memberNumber.trim();
            const capturedCanNumber = canNumber.trim();
            const capturedShiftId = shiftValue;
            const capturedShiftName = shifts.find((s: any) => s.id === shiftValue)?.name || '';
            const capturedMeasuringCanName = measuringCan?.can_id || '';
            const capturedEntries = [...entries];
            const capturedTotalCans = totalCans;
            const capturedTotalQuantity = totalQuantity;

            // Save to SQLite
            await insertOfflineCollection({
                member_number: capturedMemberNumber,
                shift_id: capturedShiftId || undefined,
                shift_name: capturedShiftName || undefined,
                measuring_can_name: capturedMeasuringCanName || undefined,
                total_cans: capturedTotalCans,
                total_quantity: capturedTotalQuantity,
                cans_data: capturedEntries,
            });

            console.log('[OFFLINE] Collection saved successfully');
            setSuccessModalVisible(true);
            setIsPrinting(true);

            // Format receipt
            const receiptText = formatOfflineCollectionReceipt(
                capturedMemberNumber,
                capturedCanNumber,
                capturedEntries,
                capturedTotalCans,
                capturedTotalQuantity,
                capturedShiftName,
                capturedMeasuringCanName
            );

            // Update unsynced count
            await loadUnsyncedCount();

            // Try to print
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
                            connectedPrinter = connectedPrinterDevice;
                        }
                    } catch (checkErr) {
                        console.warn('[OFFLINE-PRINT] Error checking connection:', checkErr);
                    }
                }

                if (!connectedPrinter) {
                    try {
                        console.log('[OFFLINE-PRINT] Attempting auto-connect...');
                        const connected = await attemptAutoConnectPrinter();
                        if (connected && connectedPrinterDevice) {
                            connectedPrinter = connectedPrinterDevice;
                        }
                    } catch (connectErr) {
                        console.error('[OFFLINE-PRINT] Error connecting:', connectErr);
                    }
                }

                if (!connectedPrinter) {
                    console.log('[OFFLINE-PRINT] No printer, showing modal');
                    setIsPrinting(false);
                    setPrinterModalVisible(true);
                    await AsyncStorage.setItem('pending_receipt', receiptText);
                    return;
                }

                await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));

                let printSuccess = false;
                try {
                    printSuccess = await printReceipt(receiptText, connectedPrinter);
                } catch (printErr) {
                    console.error('[OFFLINE-PRINT] Error during printing:', printErr);
                    printSuccess = false;
                }

            } catch (printerError) {
                console.error("[OFFLINE-PRINT] Unexpected error:", printerError);
            } finally {
                setIsPrinting(false);
            }

            // Clear form after a delay
            setTimeout(() => {
                setMemberNumber("");
                setCanNumber("");
                setShiftValue(null);
                setEntries([]);
                setTotalCans(0);
                setTotalQuantity(0);
                setScaleWeight(null);
                if (!measuringCan) {
                    setTareWeight("0");
                }
                setSuccessModalVisible(false);
            }, 2000);

        } catch (error: any) {
            console.error('[OFFLINE] Error saving collection:', error);
            Alert.alert("Error", "Failed to save collection: " + (error?.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    // Manual sync
    const handleManualSync = async () => {
        try {
            setIsSyncing(true);

            const online = await checkConnectivity();
            if (!online) {
                Alert.alert(
                    "No Internet Connection", 
                    "Please connect to the internet to sync data. Your offline collections are stored safely and will sync when connection is restored.",
                    [{ text: "OK" }]
                );
                setIsSyncing(false);
                return;
            }

            // Use the new sync with confirmation flow
            // All error handling is done inside syncWithConfirmation
            await syncWithConfirmation();
            
            // Refresh unsynced count after sync operations
            await loadUnsyncedCount();
        } catch (error: any) {
            console.error('[OFFLINE] Unexpected sync error:', error);
            // Only show alert for unexpected errors not handled by syncWithConfirmation
            Alert.alert(
                "Sync Error", 
                "An unexpected error occurred during sync. Please contact your administrator if this problem persists.",
                [{ text: "OK" }]
            );
        } finally {
            setIsSyncing(false);
        }
    };

    // View collection history
    const viewHistory = async () => {
        try {
            const collections = await getAllCollections();
            setCollectionHistory(collections);
            setHistoryModalVisible(true);
        } catch (error) {
            console.error('[OFFLINE] Error loading history:', error);
            Alert.alert("Error", "Failed to load collection history");
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={true}>
                {/* Header with status */}
                <View style={styles.header}>
                    <Text style={styles.title}>Offline Milk Collection</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusBadge, { backgroundColor: isOnline ? '#DEF7EC' : '#FEE' }]}>
                            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
                            <Text style={[styles.statusText, { color: isOnline ? '#166534' : '#991B1B' }]}>
                                {isOnline ? 'Online' : 'Offline'}
                            </Text>
                        </View>
                        {unsyncedCount > 0 && (
                            <View style={styles.unsyncedBadge}>
                                <MaterialIcons name="cloud-upload" size={16} color="#F59E0B" />
                                <Text style={styles.unsyncedText}>{unsyncedCount} pending</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
                        onPress={handleManualSync}
                        disabled={isSyncing || unsyncedCount === 0}
                    >
                        {isSyncing ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <MaterialIcons name="sync" size={20} color="#fff" />
                                <Text style={styles.actionButtonText}>Sync Now</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
                        onPress={viewHistory}
                    >
                        <MaterialIcons name="history" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>History</Text>
                    </TouchableOpacity>
                </View>

                {/* Member Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Collection Information</Text>
                    
                    <Text style={styles.label}>Member Number *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter member number"
                        value={memberNumber}
                        onChangeText={setMemberNumber}
                        autoCapitalize="none"
                    />

                    <Text style={styles.label}>Can Number</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter can number"
                        value={canNumber}
                        onChangeText={setCanNumber}
                    />

                    <Text style={styles.label}>Shift</Text>
                    {shiftItems.length > 0 ? (
                        <DropDownPicker
                            listMode="SCROLLVIEW"
                            open={shiftOpen}
                            value={shiftValue}
                            items={shiftItems}
                            setOpen={setShiftOpen}
                            setValue={setShiftValue}
                            setItems={setShiftItems}
                            placeholder="Select shift"
                            renderListItem={renderDropdownItem}
                            zIndex={3000}
                            zIndexInverse={1000}
                            style={{
                                borderColor: '#2563eb',
                                borderWidth: 1,
                                borderRadius: 6,
                                backgroundColor: '#fff'
                            }}
                            dropDownContainerStyle={{
                                borderColor: '#2563eb',
                                borderWidth: 1,
                                borderRadius: 6,
                                backgroundColor: '#fff'
                            }}
                        />
                    ) : (
                        <View style={{ 
                            padding: 12, 
                            backgroundColor: '#FEF3C7', 
                            borderRadius: 6,
                            marginTop: 8 
                        }}>
                            <Text style={{ fontSize: 12, color: '#92400E' }}>
                                No shifts available. Please ensure you have internet connection on first launch.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Measuring Can Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Measuring Can</Text>
                    
                    {measuringCanItems.length > 0 ? (
                        <DropDownPicker
                            listMode="SCROLLVIEW"
                            open={measuringCanOpen}
                            value={measuringCanValue}
                            items={measuringCanItems}
                            setOpen={setMeasuringCanOpen}
                            setValue={(callback) => {
                                const value = typeof callback === 'function' ? callback(measuringCanValue) : callback;
                                setMeasuringCanValue(value);
                                handleMeasuringCanChange(value);
                            }}
                            setItems={setMeasuringCanItems}
                            placeholder="Select measuring can"
                            renderListItem={renderDropdownItem}
                            zIndex={2000}
                            zIndexInverse={2000}
                            style={{
                                borderColor: '#16a34a',
                                borderWidth: 1,
                                borderRadius: 6,
                                backgroundColor: '#fff'
                            }}
                            dropDownContainerStyle={{
                                borderColor: '#16a34a',
                                borderWidth: 1,
                                borderRadius: 6,
                                backgroundColor: '#fff'
                            }}
                        />
                    ) : (
                        <View style={{ 
                            padding: 12, 
                            backgroundColor: '#FEF3C7', 
                            borderRadius: 6,
                            marginTop: 8 
                        }}>
                            <Text style={{ fontSize: 12, color: '#92400E' }}>
                                No measuring cans available. Please ensure you have internet connection on first launch.
                            </Text>
                        </View>
                    )}

                    {measuringCan && (
                        <View style={[styles.measuringCanInfo, { marginTop: 12 }]}>
                            <MaterialIcons name="check-circle" size={16} color="#16a34a" />
                            <Text style={styles.measuringCanText}>
                                Tare weight will be automatically set to {measuringCan.tare_weight} KG
                            </Text>
                        </View>
                    )}
                </View>

                {/* Weight Recording */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Weight Recording</Text>

                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Scale Weight (KG)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Scale Weight"
                                value={connectedScaleDevice
                                    ? (scaleWeight !== null && !isNaN(scaleWeight) ? scaleWeight.toFixed(2) : "")
                                    : scaleWeightText
                                }
                                keyboardType="decimal-pad"
                                editable={!connectedScaleDevice}
                                onChangeText={(text) => {
                                    if (!connectedScaleDevice) {
                                        const cleaned = text.replace(/[^0-9.]/g, "");
                                        if ((cleaned.match(/\./g) || []).length > 1) return;
                                        setScaleWeightText(cleaned);
                                        if (cleaned === "" || cleaned === ".") {
                                            setScaleWeight(null);
                                        } else {
                                            const parsed = parseFloat(cleaned);
                                            if (!isNaN(parsed)) {
                                                setScaleWeight(parsed);
                                            } else {
                                                setScaleWeight(null);
                                            }
                                        }
                                    }
                                }}
                            />
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Tare Weight (KG)</Text>
                            <TextInput
                                style={[styles.input, measuringCan && styles.inputReadonly]}
                                placeholder="Tare Weight"
                                value={tareWeight}
                                keyboardType="decimal-pad"
                                editable={!measuringCan}
                                onChangeText={(text) => {
                                    if (!measuringCan) {
                                        const cleaned = text.replace(/[^0-9.]/g, "");
                                        if ((cleaned.match(/\./g) || []).length > 1) return;
                                        setTareWeight(cleaned);
                                    }
                                }}
                            />
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Net (KG)</Text>
                            <Text style={styles.netValue}>
                                {(() => {
                                    const tare = parseFloat(tareWeight) || 0;
                                    if (scaleWeight !== null && !isNaN(scaleWeight) && isFinite(scaleWeight)) {
                                        const net = scaleWeight - tare;
                                        if (isFinite(net) && net >= 0) {
                                            return net.toFixed(2);
                                        }
                                    }
                                    return "--";
                                })()}
                            </Text>
                        </View>
                    </View>

                    {/* Bluetooth Status */}
                    <View style={styles.bluetoothStatus}>
                        {connectedScaleDevice ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.connectedDot} />
                                <Text style={styles.connectedText}>
                                    Connected: {connectedScaleDevice?.name || 'Scale'}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.disconnectedText}>No scale connected</Text>
                        )}
                    </View>

                    {/* Scale Buttons */}
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: "#facc15" }]}
                            onPress={() => setScaleModalVisible(true)}
                        >
                            <Text style={[styles.buttonText, { color: "#000" }]}>
                                {connectedScaleDevice ? "Change Scale" : "Connect Scale"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: "#16a34a" }]}
                            onPress={takeWeight}
                        >
                            <Text style={styles.buttonText}>Take Record</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Recorded Cans */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recorded Cans: {entries.length}</Text>
                    {entries.map((entry, idx) => (
                        <View key={idx} style={styles.entryRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.entryText}>
                                    {entry.can_label} - Gross: {entry.scale_weight.toFixed(2)} - Tare: {entry.tare_weight.toFixed(2)} - Net: {entry.net.toFixed(2)} KG
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => removeEntry(idx)}>
                                <MaterialIcons name="delete" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ))}

                    {entries.length > 0 && (
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total Net Weight:</Text>
                            <Text style={styles.totalValue}>{totalQuantity.toFixed(2)} KG</Text>
                        </View>
                    )}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={saveCollection}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitText}>Save Collection</Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Scale Modal */}
            <BluetoothConnectionModal
                visible={scaleModalVisible}
                onClose={() => setScaleModalVisible(false)}
                type="device-list"
                deviceType="scale"
                title="Select Scale Device"
                message="Make sure Bluetooth is enabled."
                devices={scaleDevices}
                connectToDevice={connectToScaleDevice}
                scanForDevices={scanForScaleDevices}
                isScanning={isScanningScale}
                isConnecting={isConnectingScale}
                connectedDevice={connectedScaleDevice}
                disconnect={disconnectScale}
            />

            {/* Printer Modal */}
            <BluetoothConnectionModal
                visible={printerModalVisible}
                onClose={() => setPrinterModalVisible(false)}
                type="device-list"
                deviceType="printer"
                title="Select Printer"
                devices={printerDevices}
                connectToDevice={async (id: string) => {
                    try {
                        const result = await connectToPrinterDevice(id);
                        if (result) {
                            await persistLastPrinter(result);

                            // Print pending receipt if exists
                            try {
                                const pendingReceipt = await AsyncStorage.getItem('pending_receipt');
                                if (pendingReceipt) {
                                    setIsPrinting(true);
                                    try {
                                        const printSuccess = await printReceipt(pendingReceipt);
                                        if (printSuccess) {
                                            await AsyncStorage.removeItem('pending_receipt');
                                        }
                                    } catch (printErr) {
                                        console.error('[OFFLINE-PRINT] Error printing:', printErr);
                                    } finally {
                                        setIsPrinting(false);
                                    }
                                }
                            } catch (receiptErr) {
                                console.error('[OFFLINE-PRINT] Error handling receipt:', receiptErr);
                            }

                            setPrinterModalVisible(false);
                        }
                        return result;
                    } catch (err) {
                        console.error('[OFFLINE-PRINT] Error connecting:', err);
                        return null;
                    }
                }}
                scanForDevices={scanForPrinterDevices}
                isScanning={isScanningPrinter}
                isConnecting={isConnectingPrinter}
                connectedDevice={connectedPrinterDevice}
                disconnect={disconnectPrinter}
            />

            {/* Success Modal */}
            <SuccessModal
                visible={successModalVisible}
                title="Success"
                message="Collection saved successfully!"
                isLoading={isPrinting}
                loadingMessage={isPrinting ? "Printing receipt..." : undefined}
                onClose={() => setSuccessModalVisible(false)}
            />

            {/* History Modal */}
            <BluetoothConnectionModal
                visible={historyModalVisible}
                onClose={() => setHistoryModalVisible(false)}
                type="device-list"
                deviceType="scale"
                title="Collection History"
                message={`Total collections: ${collectionHistory.length}`}
                devices={[]}
                connectToDevice={async () => {}}
                scanForDevices={async () => {}}
                isScanning={false}
                isConnecting={false}
                connectedDevice={null}
                disconnect={async () => {}}
            >
                <ScrollView style={{ maxHeight: 400 }}>
                    {collectionHistory.map((collection, idx) => (
                        <View key={idx} style={styles.historyItem}>
                            <View style={styles.historyHeader}>
                                <Text style={styles.historyMember}>
                                    {collection.member_number} - {collection.member_name || 'N/A'}
                                </Text>
                                <View style={[
                                    styles.syncBadge,
                                    { backgroundColor: collection.synced ? '#DEF7EC' : '#FEF3C7' }
                                ]}>
                                    <Text style={[
                                        styles.syncBadgeText,
                                        { color: collection.synced ? '#166534' : '#92400E' }
                                    ]}>
                                        {collection.synced ? 'Synced' : 'Pending'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.historyDetails}>
                                Cans: {collection.total_cans} | Quantity: {collection.total_quantity.toFixed(2)} KG
                            </Text>
                            <Text style={styles.historyDate}>
                                {new Date(collection.created_at).toLocaleString()}
                            </Text>
                        </View>
                    ))}
                </ScrollView>
            </BluetoothConnectionModal>
        </View>
    );
};

export default OfflineMilkCollectionScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    header: {
        padding: 16,
        backgroundColor: "#F9FAFB",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#111827",
        marginBottom: 8,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "600",
    },
    unsyncedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FEF3C7",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    unsyncedText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#92400E",
    },
    actionRow: {
        flexDirection: "row",
        padding: 16,
        gap: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        borderRadius: 8,
        gap: 6,
    },
    actionButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
    section: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#374151",
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        color: "#6B7280",
        marginBottom: 6,
        marginTop: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#D1D5DB",
        padding: 10,
        borderRadius: 6,
        backgroundColor: "#fff",
        fontSize: 14,
    },
    inputReadonly: {
        backgroundColor: "#F3F4F6",
        color: "#6B7280",
    },
    measuringCanInfo: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        backgroundColor: "#DEF7EC",
        borderRadius: 6,
        marginBottom: 12,
        gap: 8,
    },
    measuringCanText: {
        fontSize: 13,
        color: "#166534",
        fontWeight: "600",
        flex: 1,
    },
    row: {
        flexDirection: "row",
        gap: 12,
    },
    col: {
        flex: 1,
    },
    netValue: {
        fontSize: 16,
        fontWeight: "600",
        color: "#16a34a",
        marginTop: 8,
    },
    bluetoothStatus: {
        marginTop: 12,
        padding: 8,
        backgroundColor: "#F3F4F6",
        borderRadius: 6,
        alignItems: "center",
    },
    connectedDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#22c55e",
        marginRight: 6,
    },
    connectedText: {
        fontSize: 12,
        color: "#22c55e",
        fontWeight: "600",
    },
    disconnectedText: {
        fontSize: 12,
        color: "#ef4444",
        fontWeight: "500",
    },
    buttonRow: {
        flexDirection: "row",
        gap: 12,
        marginTop: 12,
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 6,
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 14,
    },
    entryRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        backgroundColor: "#F9FAFB",
        borderRadius: 6,
        marginBottom: 8,
    },
    entryText: {
        fontSize: 13,
        color: "#374151",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        padding: 12,
        backgroundColor: "#EBF5FF",
        borderRadius: 6,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E40AF",
    },
    totalValue: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1E40AF",
    },
    submitButton: {
        backgroundColor: "#16a34a",
        padding: 16,
        borderRadius: 8,
        alignItems: "center",
        margin: 16,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    historyItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    historyHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    historyMember: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111827",
        flex: 1,
    },
    syncBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    syncBadgeText: {
        fontSize: 11,
        fontWeight: "600",
    },
    historyDetails: {
        fontSize: 13,
        color: "#6B7280",
        marginBottom: 4,
    },
    historyDate: {
        fontSize: 11,
        color: "#9CA3AF",
    },
});

