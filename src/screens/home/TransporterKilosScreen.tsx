import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    ActivityIndicator,
    Switch,
    ScrollView,
    FlatList,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import fetchCommonData from "../../components/utils/fetchCommonData.ts";
import makeRequest from "../../components/utils/makeRequest.ts";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all.tsx";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import useBluetoothService from "../../hooks/useBluetoothService";
import BluetoothConnectionModal from "../../components/modals/BluetoothConnectionModal";
import SuccessModal from "../../components/modals/SuccessModal";

const TransporterKilosScreen = () => {
    const [commonData, setCommonData] = useState<any>({});
    const navigation = useNavigation();

    // View mode and employee check
    const [viewMode, setViewMode] = useState(true); // true = View Kilos, false = Record Kilos
    const [isEmployee, setIsEmployee] = useState(false);
    const [transporterKilosList, setTransporterKilosList] = useState<any[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [selectedTransporterForView, setSelectedTransporterForView] = useState<number | null>(null);
    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState<any[]>([]);

    const [vehicleOpen, setVehicleOpen] = useState(false);
    const [vehicleValue, setVehicleValue] = useState<number | null>(null);
    const [vehicleItems, setVehicleItems] = useState<any[]>([]);

    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [shiftItems, setShiftItems] = useState<any[]>([]);

    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [routeItems, setRouteItems] = useState<any[]>([]);

    // form state
    const [transactionDate, setTransactionDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [netWeight, setNetWeight] = useState("");
    const [loading, setLoading] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);

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

    // load common data and check user role
    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [transporters, transporterVehicles, routes, shifts] =
                    await Promise.all([
                        fetchCommonData({ name: "transporters" }),
                        fetchCommonData({ name: "transporter_vehicles" }),
                        fetchCommonData({ name: "routes" }),
                        fetchCommonData({ name: "shifts" }),
                    ]);
                const allData = { transporters, transporterVehicles, routes, shifts };
                setCommonData(allData);

                // Check if user is employee
                try {
                    const userDataString = await AsyncStorage.getItem("user");
                    if (userDataString) {
                        const userData = JSON.parse(userDataString);
                        const userGroups = userData?.user_groups || [];
                        const hasEmployeeRole = userGroups.includes("employee");
                        setIsEmployee(hasEmployeeRole);

                        if (!hasEmployeeRole) {
                            // Non-employees can only view, set view mode
                            setViewMode(true);
                        } else {
                            // Employees can record, default to record mode
                            setViewMode(false);
                        }
                    }
                } catch (userError) {
                    console.error("Error checking user role:", userError);
                }
            } catch {
                Alert.alert("Error", "Failed to load common data");
            }
        };
        loadCommonData();
    }, []);

    // populate dropdown items when commonData changes
    useEffect(() => {
        if (!commonData) return;

        setTransporterItems(
            (commonData?.transporters || []).map((t: any) => ({
                label: t.full_names,
                value: t.id,
            }))
        );

        setVehicleItems(
            (commonData?.transporterVehicles || []).map((v: any) => ({
                label: v.description || v.name || `Vehicle ${v.id}`,
                value: v.id,
            }))
        );

        setRouteItems(
            (commonData?.routes || []).map((r: any) => ({
                label: `${r.route_name} (${r.route_code})`,
                value: r.id,
            }))
        );

        setShiftItems(
            (commonData?.shifts || []).map((s: any) => ({
                label: s.name,
                value: s.id,
            }))
        );

        // Auto-select shift based on current time period (morning, afternoon, evening)
        if (commonData?.shifts && commonData.shifts.length > 0) {
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

            console.log(`[TransporterKilos] Current time: ${currentHours}:${currentTime.getMinutes()} - Period: ${currentPeriod}`);
            console.log(`[TransporterKilos] Available shifts:`, commonData.shifts.map((s: any) => ({ id: s.id, name: s.name, time: s.time })));

            // Find shift that matches current time period
            const matchingShift = commonData.shifts.find((s: any) => {
                if (!s.time) {
                    console.log(`[TransporterKilos] Shift ${s.id} (${s.name}) has no time field`);
                    return false;
                }

                // Normalize the time field to lowercase and remove any extra whitespace
                const shiftTime = s.time.toString().trim().toLowerCase();

                // More flexible matching - check if the time field contains the period
                // This handles cases like "Morning Shift", "morning", "MORNING", etc.
                const matches = shiftTime === currentPeriod ||
                    shiftTime.includes(currentPeriod) ||
                    currentPeriod.includes(shiftTime);

                console.log(`[TransporterKilos] Shift ${s.id} (${s.name}): time="${s.time}" -> normalized="${shiftTime}", currentPeriod="${currentPeriod}", matches=${matches}`);

                return matches;
            });

            if (matchingShift) {
                setShiftValue(matchingShift.id);
                console.log(`[TransporterKilos] ✅ Auto-selected shift: ${matchingShift.name} (ID: ${matchingShift.id}) - Time period: ${currentPeriod}`);
            } else {
                console.log(`[TransporterKilos] ❌ No shift found matching current time period: ${currentPeriod}`);
                console.log(`[TransporterKilos] Available shift times:`, commonData.shifts.map((s: any) => s.time).filter(Boolean));
            }
        }
    }, [commonData]);

    // Auto-select route and vehicle when transporter is selected and data is available
    useEffect(() => {
        if (transporterValue && Array.isArray(commonData?.transporters)) {
            const selectedTransporter = commonData.transporters.find((t: any) => t.id === transporterValue);
            if (selectedTransporter) {
                // Auto-select route using transporter's default_route_id
                if (selectedTransporter.default_route_id && Array.isArray(commonData?.routes) && commonData.routes.length > 0) {
                    const routeId = selectedTransporter.default_route_id;
                    const matchingRoute = commonData.routes.find((r: any) => 
                        r.id === routeId || 
                        r.id === Number(routeId) || 
                        Number(r.id) === routeId
                    );
                    if (matchingRoute && routeValue !== matchingRoute.id) {
                        setRouteValue(matchingRoute.id);
                        console.log(`[TransporterKilos] ✅ Auto-selected route (via useEffect): ${matchingRoute.route_name} (ID: ${matchingRoute.id}) for transporter: ${selectedTransporter.full_names}`);
                    }
                }
                
                // Auto-select vehicle based on transporter_id
                if (Array.isArray(commonData?.transporterVehicles) && commonData.transporterVehicles.length > 0) {
                    const transporterId = selectedTransporter.id;
                    const matchingVehicles = commonData.transporterVehicles.filter((v: any) => 
                        v.transporter_id === transporterId || 
                        v.transporter_id === Number(transporterId) || 
                        Number(v.transporter_id) === transporterId
                    );
                    if (matchingVehicles.length > 0 && (!vehicleValue || !matchingVehicles.some((v: any) => v.id === vehicleValue))) {
                        // Auto-select the first matching vehicle
                        const firstVehicle = matchingVehicles[0];
                        setVehicleValue(firstVehicle.id);
                        console.log(`[TransporterKilos] ✅ Auto-selected vehicle (via useEffect): ${firstVehicle.description || firstVehicle.name} (ID: ${firstVehicle.id}) for transporter: ${selectedTransporter.full_names}`);
                    }
                }
            }
        }
    }, [transporterValue, commonData?.transporters, commonData?.routes, commonData?.transporterVehicles, routeValue, vehicleValue]);

    // Fetch transporter kilos list for view mode
    const fetchTransporterKilosList = async () => {
        if (!selectedTransporterForView) {
            setTransporterKilosList([]);
            return;
        }

        setLoadingList(true);
        try {
            const response = await fetchCommonData({
                name: "transporter_kilos",
                params: { transporter_id: selectedTransporterForView },
            });
            setTransporterKilosList(response || []);
        } catch (error) {
            console.error("Error fetching transporter kilos:", error);
            Alert.alert("Error", "Failed to fetch transporter kilos");
            setTransporterKilosList([]);
        } finally {
            setLoadingList(false);
        }
    };

    // Fetch list when transporter is selected in view mode
    useEffect(() => {
        if (viewMode && selectedTransporterForView) {
            fetchTransporterKilosList();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTransporterForView, viewMode]);

    // Format receipt for transporter kilos
    const formatTransporterKilosReceipt = (
        transporterName: string,
        vehicleName: string,
        routeName: string,
        shiftName: string,
        transactionDate: Date,
        netWeight: number
    ) => {
        let receipt = "";
        receipt += "      E-DAIRY LIMITED\n";
        receipt += "      P.O. Box [P.O. Box Number]\n";
        receipt += "\n\n";
        receipt += "      TRANSPORTER KILOS RECEIPT\n";
        receipt += "================================\n";
        receipt += `Date: ${transactionDate.toISOString().split("T")[0]}\n`;
        receipt += `Transporter: ${transporterName}\n`;
        receipt += `Vehicle: ${vehicleName || 'N/A'}\n`;
        receipt += `Route: ${routeName}\n`;
        receipt += `Shift: ${shiftName}\n`;
        receipt += "--------------------------------\n";
        receipt += `Net Weight: ${netWeight.toFixed(2)} KG\n`;
        receipt += "--------------------------------\n";
        receipt += `TOTAL KILOS: ${netWeight.toFixed(2)} KG\n`;
        receipt += "================================\n";
        receipt += "Thank you for your delivery!\n";
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
                console.log("[TransporterKilos] persistLastPrinter: Missing id/address, skipping save");
                return;
            }

            await AsyncStorage.setItem("last_device_printer", JSON.stringify(payload));
            console.log("[TransporterKilos] persistLastPrinter: Saved printer", payload.name);
        } catch (error) {
            console.error("[TransporterKilos] persistLastPrinter: Failed to save printer", error);
        }
    }, []);

    // Helper: Connect to any available InnerPrinter
    const connectToAnyAvailablePrinter = useCallback(async (): Promise<boolean> => {
        try {
            console.log("[TransporterKilos] AUTO-CONNECT: Scanning for InnerPrinter...");
            await scanForPrinterDevices();
            await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

            const devices = printerDevicesRef.current || [];
            console.log("[TransporterKilos] AUTO-CONNECT: Found", devices.length, "printer devices");

            if (devices.length === 0) {
                console.log("[TransporterKilos] AUTO-CONNECT: No printers found in scan");
                return false;
            }

            const innerPrinters = devices.filter(device => {
                const deviceName = (device.name || '').toLowerCase();
                return deviceName.includes('innerprinter') || deviceName.includes('inner');
            });

            let targetPrinter;
            if (innerPrinters.length > 0) {
                targetPrinter = innerPrinters[0];
                console.log("[TransporterKilos] AUTO-CONNECT: Found InnerPrinter device:", targetPrinter.name || targetPrinter.id);
            } else {
                targetPrinter = devices[0];
                console.log("[TransporterKilos] AUTO-CONNECT: No InnerPrinter found, using first available printer:", targetPrinter.name || targetPrinter.id);
            }

            const deviceId = targetPrinter?.id || targetPrinter?.address || targetPrinter?.address_or_id;
            if (!deviceId) {
                console.log("[TransporterKilos] AUTO-CONNECT: Target printer missing device id");
                return false;
            }

            console.log("[TransporterKilos] AUTO-CONNECT: Attempting connection to", targetPrinter.name || deviceId);
            const result = await connectToPrinterDevice(deviceId);
            const success = !!result;
            console.log("[TransporterKilos] AUTO-CONNECT:", success ? "✓ Connected" : "✗ Connection failed");

            if (success) {
                await persistLastPrinter(result);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return success;
        } catch (error) {
            console.error("[TransporterKilos] AUTO-CONNECT: Error connecting to printer:", error);
            return false;
        }
    }, [scanForPrinterDevices, connectToPrinterDevice, persistLastPrinter]);

    // Helper: Connect to saved printer or scan and connect to first InnerPrinter
    const connectToPrinterForPrinting = useCallback(async (): Promise<boolean> => {
        try {
            console.log('[PRINT] Step 1: Checking for saved printer in AsyncStorage...');

            // Check AsyncStorage for last printer
            try {
                const lastPrinter = await AsyncStorage.getItem('last_device_printer');
                if (lastPrinter) {
                    try {
                        const printerData = JSON.parse(lastPrinter);
                        const deviceId = printerData.id || printerData.address || printerData.address_or_id;
                        const savedType = printerData.type || 'classic';
                        const printerName = (printerData.name || '').toLowerCase();
                        const isInnerPrinter = printerName.includes('innerprinter') || printerName.includes('inner');

                        if (deviceId) {
                            console.log('[PRINT] Found saved printer:', printerData.name || deviceId);
                            console.log('[PRINT] Saved printer type:', savedType);

                            if (isInnerPrinter || savedType === 'classic') {
                                console.log('[PRINT] InnerPrinter or Classic printer detected - will use Classic connection');
                            }

                            // Try to connect to saved printer with timeout
                            try {
                                const result = await Promise.race([
                                    connectToPrinterDevice(deviceId),
                                    new Promise<null>((_, reject) =>
                                        setTimeout(() => reject(new Error('Connection timeout')), 10000)
                                    )
                                ]);

                                if (result) {
                                    console.log('[PRINT] ✅ Connected to saved printer');
                                    if (result.type === 'classic' && (isInnerPrinter || savedType === 'classic')) {
                                        console.log('[PRINT] ✅ Verified: Connected via Classic as expected');
                                    }
                                    return true;
                                } else {
                                    console.log('[PRINT] ⚠️ Failed to connect to saved printer, will scan for InnerPrinter');
                                }
                            } catch (connectErr) {
                                console.warn('[PRINT] ⚠️ Error connecting to saved printer:', connectErr);
                                // Continue to scan
                            }
                        }
                    } catch (parseErr) {
                        console.warn('[PRINT] Error parsing saved printer:', parseErr);
                    }
                } else {
                    console.log('[PRINT] No saved printer found in AsyncStorage');
                }
            } catch (storageErr) {
                console.warn('[PRINT] Error reading AsyncStorage:', storageErr);
            }

            // If saved printer not found or connection failed, scan for InnerPrinter
            try {
                console.log('[PRINT] Step 2: Scanning for InnerPrinter devices...');
                await scanForPrinterDevices();

                // Wait for scan to complete
                await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

                // Filter for InnerPrinter devices
                const innerPrinters = printerDevices.filter(device => {
                    const deviceName = (device.name || '').toLowerCase();
                    return deviceName.includes('innerprinter') || deviceName.includes('inner');
                });

                if (innerPrinters.length > 0) {
                    const firstInnerPrinter = innerPrinters[0];
                    const deviceId = firstInnerPrinter.id || firstInnerPrinter.address;

                    console.log('[PRINT] Found InnerPrinter:', firstInnerPrinter.name || deviceId);
                    console.log('[PRINT] Connecting to first InnerPrinter...');

                    try {
                        const result = await Promise.race([
                            connectToPrinterDevice(deviceId),
                            new Promise<null>((_, reject) =>
                                setTimeout(() => reject(new Error('Connection timeout')), 10000)
                            )
                        ]);

                        if (result) {
                            // Save printer to AsyncStorage
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
                        } else {
                            console.log('[PRINT] ⚠️ Failed to connect to InnerPrinter');
                        }
                    } catch (connectErr) {
                        console.error('[PRINT] ⚠️ Error connecting to InnerPrinter:', connectErr);
                    }
                } else {
                    console.log('[PRINT] ⚠️ No InnerPrinter found in scan');
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
            if (!connectedPrinterDevice) {
                console.log('[PRINT] State not updated, will use provided device (printTextToPrinter may use state)');
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

        if (!connectedPrinterDevice && deviceOverride) {
            console.warn('[PRINT] Warning: Hook state not updated, but device provided. Print may fail if hook state is required.');
            console.log('[PRINT] Waiting additional 500ms for hook state update...');
            await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
            if (!connectedPrinterDevice) {
                console.error('[PRINT] Hook state still not updated after wait. This may cause print to fail.');
            }
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

    const sendKilos = async () => {
        // Only employees can submit transporter kilos
        if (!isEmployee) {
            Alert.alert("Access Denied", "Only employees can submit transporter kilos.");
            return;
        }

        if (!transporterValue || !routeValue || !shiftValue || !transactionDate) {
            Alert.alert(
                "Missing Data",
                "Please select transporter, route, shift, and transaction date."
            );
            return;
        }

        if (!netWeight) {
            Alert.alert("Missing Data", "Please enter net weight.");
            return;
        }

        try {
            setLoading(true); // disable button
            const payload = {
                transporter_id: transporterValue,
                registration_number: vehicleValue,
                route_id: routeValue,
                shift_id: shiftValue,
                transaction_date: transactionDate.toISOString().split("T")[0], // YYYY-MM-DD
                quantity: parseFloat(netWeight),
            };

            const [status, response] = await makeRequest({
                url: "transporter-kilos",
                method: "POST",
                data: payload,
            });

            if (!isMountedRef.current) return;

            if (![200, 201].includes(status)) {
                Alert.alert(
                    `Error ${status}`,
                    response?.message || "Failed to submit data"
                );
                return;
            }

            // Capture data for receipt before clearing form
            const selectedTransporter = (commonData?.transporters || []).find((t: any) => t.id === transporterValue);
            const selectedVehicle = (commonData?.transporterVehicles || []).find((v: any) => v.id === vehicleValue);
            const selectedRoute = (commonData?.routes || []).find((r: any) => r.id === routeValue);
            const selectedShift = (commonData?.shifts || []).find((s: any) => s.id === shiftValue);
            const capturedNetWeight = parseFloat(netWeight);

            // Prepare receipt text
            let receiptText = "";
            try {
                receiptText = formatTransporterKilosReceipt(
                    selectedTransporter?.full_names || 'N/A',
                    selectedVehicle?.description || selectedVehicle?.name || 'N/A',
                    selectedRoute?.route_name || 'N/A',
                    selectedShift?.name || 'N/A',
                    transactionDate,
                    capturedNetWeight
                );
            } catch (formatError) {
                console.error("Error formatting receipt:", formatError);
                receiptText = `TRANSPORTER KILOS RECEIPT\nDate: ${transactionDate.toISOString().split("T")[0]}\nNet Weight: ${capturedNetWeight.toFixed(2)} KG\n`;
            }

            if (!isMountedRef.current) return;
            setSuccessModalVisible(true);
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
                            // Wait for state to update after connection
                            for (let i = 0; i < 5; i++) {
                                await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
                                if (connectedPrinterDevice) {
                                    console.log('[PRINT] State updated, using connected printer');
                                    connectedPrinter = connectedPrinterDevice;
                                    break;
                                }
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
                } catch (printErr) {
                    console.error('[PRINT] Error during printing:', printErr);
                    printSuccess = false;
                }

            } catch (printerError) {
                console.error("[PRINT] Unexpected error:", printerError);
            } finally {
                if (!isMountedRef.current) return;
                setIsPrinting(false);
            }

            // Clear form after a delay
            setTimeout(() => {
                if (!isMountedRef.current) return;
                try {
                    setNetWeight("");
                    setTransporterValue(null);
                    setVehicleValue(null);
                    setRouteValue(null);
                    setShiftValue(null);
                } catch (clearError) {
                    console.error("Error clearing state:", clearError);
                }
            }, 100);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to send data");
        } finally {
            setLoading(false); // re-enable button
        }
    };

    return (
        <View style={styles.container}>
            {/* View/Record Toggle */}
            {isEmployee && (
                <View style={styles.toggleContainer}>
                    <Text style={styles.toggleLabel}>{viewMode ? "View Kilos" : "Record Kilos"}</Text>
                    <Switch
                        value={viewMode}
                        onValueChange={setViewMode}
                        trackColor={{ false: "#d1d5db", true: "#a7f3d0" }}
                        thumbColor={viewMode ? "#16a34a" : "#f1f5f9"}
                        style={{ transform: [{ scaleX: 1.4 }, { scaleY: 1.4 }] }}
                    />
                </View>
            )}

            <Text style={styles.title}>Transporter Kilos</Text>

            {viewMode ? (
                // --- View Kilos UI ---
                <ScrollView>
                    <View style={styles.viewSection}>
                        <DropDownPicker
                            open={transporterOpen}
                            value={selectedTransporterForView}
                            items={transporterItems}
                            setOpen={setTransporterOpen}
                            setValue={(val: any) => setSelectedTransporterForView(val as number)}
                            setItems={setTransporterItems}
                            placeholder="Select transporter to view kilos"
                            listMode="SCROLLVIEW"
                            searchable
                            renderListItem={renderDropdownItem}
                            zIndex={3000}
                            style={{
                                borderWidth: 1,
                                borderColor: "#ddd",
                                borderRadius: 6,
                            }}
                            dropDownContainerStyle={{
                                borderWidth: 1,
                                borderColor: "#ddd",
                            }}
                            scrollViewProps={{ nestedScrollEnabled: true }}
                        />
                    </View>

                    {loadingList ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#16a34a" />
                            <Text style={styles.loadingText}>Loading kilos...</Text>
                        </View>
                    ) : transporterKilosList.length > 0 ? (
                        <View style={styles.listContainer}>
                            <Text style={styles.listTitle}>
                                Transporter Kilos ({transporterKilosList.length})
                            </Text>
                            <FlatList
                                data={transporterKilosList}
                                keyExtractor={(item, index) => `${item.id || index}`}
                                renderItem={({ item }) => (
                                    <View style={styles.listItem}>
                                        <View style={styles.listItemRow}>
                                            <Text style={styles.listItemLabel}>Date:</Text>
                                            <Text style={styles.listItemValue}>
                                                {item.transaction_date || 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.listItemRow}>
                                            <Text style={styles.listItemLabel}>Route:</Text>
                                            <Text style={styles.listItemValue}>
                                                {item.route?.route_name || 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.listItemRow}>
                                            <Text style={styles.listItemLabel}>Shift:</Text>
                                            <Text style={styles.listItemValue}>
                                                {item.shift?.name || 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.listItemRow}>
                                            <Text style={styles.listItemLabel}>Vehicle:</Text>
                                            <Text style={styles.listItemValue}>
                                                {item.vehicle?.description || item.vehicle?.name || item.registration_number || 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.listItemRow}>
                                            <Text style={styles.listItemLabel}>Net Weight:</Text>
                                            <Text style={[styles.listItemValue, styles.boldText]}>
                                                {item.quantity ? `${parseFloat(item.quantity).toFixed(2)} KG` : 'N/A'}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                scrollEnabled={false}
                            />
                        </View>
                    ) : selectedTransporterForView ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No transporter kilos found</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Select a transporter to view kilos</Text>
                        </View>
                    )}
                </ScrollView>
            ) : (
                // --- Record Kilos UI ---
                <ScrollView>
                    {/* Transporter & Transaction Date */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={transporterOpen}
                                value={transporterValue}
                                items={transporterItems}
                                setOpen={setTransporterOpen}
                                setValue={(val: any) => {
                                    setTransporterValue(val as number);
                                    const sel = (commonData?.transporters || []).find((t: any) => t.id === val);
                                    if (sel) {
                                        // Auto-select route using transporter's default_route_id
                                        if (sel.default_route_id) {
                                            const routeId = sel.default_route_id;
                                            // Find route that matches the default_route_id
                                            const matchingRoute = (commonData?.routes || []).find((r: any) => 
                                                r.id === routeId || 
                                                r.id === Number(routeId) || 
                                                Number(r.id) === routeId
                                            );
                                            if (matchingRoute) {
                                                setRouteValue(matchingRoute.id);
                                                console.log(`[TransporterKilos] ✅ Auto-selected route: ${matchingRoute.route_name} (ID: ${matchingRoute.id}) for transporter: ${sel.full_names}`);
                                            }
                                        }
                                        
                                        // Auto-select vehicle based on transporter_id
                                        const transporterId = sel.id;
                                        const matchingVehicles = (commonData?.transporterVehicles || []).filter((v: any) => 
                                            v.transporter_id === transporterId || 
                                            v.transporter_id === Number(transporterId) || 
                                            Number(v.transporter_id) === transporterId
                                        );
                                        if (matchingVehicles.length > 0) {
                                            // Auto-select the first matching vehicle
                                            const firstVehicle = matchingVehicles[0];
                                            setVehicleValue(firstVehicle.id);
                                            console.log(`[TransporterKilos] ✅ Auto-selected vehicle: ${firstVehicle.description || firstVehicle.name} (ID: ${firstVehicle.id}) for transporter: ${sel.full_names}`);
                                        }
                                    }
                                }}
                                setItems={setTransporterItems}
                                placeholder="Select transporter"
                                listMode="SCROLLVIEW"
                                searchable
                                renderListItem={renderDropdownItem}
                                zIndex={5000}
                                zIndexInverse={2000}
                                style={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                    borderRadius: 6,
                                }}
                                dropDownContainerStyle={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                }}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>
                        <View style={styles.col}>
                            <TouchableOpacity
                                style={styles.dateInput}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={styles.dateText}>
                                    {transactionDate.toISOString().split("T")[0]}
                                </Text>
                                <Icon name="date-range" size={22} color="#555" />
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={transactionDate}
                                    mode="date"
                                    display={Platform.OS === "ios" ? "spinner" : "default"}
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) {
                                            setTransactionDate(selectedDate);
                                        }
                                    }}
                                />
                            )}
                        </View>
                    </View>

                    {/* Route & Shift */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={routeOpen}
                                value={routeValue}
                                items={routeItems}
                                setOpen={setRouteOpen}
                                setValue={setRouteValue}
                                setItems={setRouteItems}
                                placeholder="Select route"
                                listMode="SCROLLVIEW"
                                searchable
                                renderListItem={renderDropdownItem}
                                zIndex={4000}
                                zIndexInverse={3000}
                                style={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                    borderRadius: 6,
                                }}
                                dropDownContainerStyle={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                }}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={shiftOpen}
                                value={shiftValue}
                                items={shiftItems}
                                setOpen={setShiftOpen}
                                setValue={setShiftValue}
                                setItems={setShiftItems}
                                placeholder="Select shift"
                                listMode="SCROLLVIEW"
                                searchable
                                renderListItem={renderDropdownItem}
                                zIndex={2500}
                                zIndexInverse={1000}
                                style={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                    borderRadius: 6,
                                }}
                                dropDownContainerStyle={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                }}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>
                    </View>

                    {/* Vehicle & Net Weight */}
                    <View style={[styles.row, { marginTop: 20 }]}>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={vehicleOpen}
                                value={vehicleValue}
                                items={vehicleItems}
                                setOpen={setVehicleOpen}
                                setValue={setVehicleValue}
                                setItems={setVehicleItems}
                                placeholder="Select vehicle"
                                listMode="SCROLLVIEW"
                                searchable
                                renderListItem={renderDropdownItem}
                                zIndex={1500}
                                zIndexInverse={500}
                                style={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                    borderRadius: 6,
                                }}
                                dropDownContainerStyle={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                }}
                                scrollViewProps={{ nestedScrollEnabled: true }}
                            />
                        </View>
                        <View style={styles.col}>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={netWeight}
                                onChangeText={setNetWeight}
                                placeholder="Net Weight"
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.submitButton, loading && { opacity: 0.6 }]}
                        onPress={sendKilos}
                        disabled={loading || !isEmployee}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitText}>Send Kilos</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* MODALs */}
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
            <SuccessModal
                visible={successModalVisible}
                title="Success"
                message="Transporter kilos sent successfully!"
                isLoading={isPrinting}
                loadingMessage={isPrinting ? "Printing receipt..." : undefined}
                onClose={() => setSuccessModalVisible(false)}
            />
        </View>
    );
};

export default TransporterKilosScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#fff" },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
    toggleContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: "#e6fffa",
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#065f46",
    },
    viewSection: {
        marginBottom: 16,
    },
    loadingContainer: {
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        marginTop: 12,
        color: "#666",
        fontSize: 14,
    },
    listContainer: {
        marginTop: 12,
    },
    listTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 12,
        color: "#333",
    },
    listItem: {
        backgroundColor: "#f8f9fa",
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    listItemRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    listItemLabel: {
        fontSize: 14,
        color: "#666",
        fontWeight: "500",
    },
    listItemValue: {
        fontSize: 14,
        color: "#333",
        fontWeight: "400",
    },
    boldText: {
        fontWeight: "bold",
        color: "#16a34a",
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        color: "#999",
        fontSize: 14,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
        justifyContent: "center",
    },
    submitButton: {
        backgroundColor: "green",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 16,
    },
    submitText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    col: { flex: 1, marginHorizontal: 4 },
    dateInput: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    dateText: {
        fontSize: 14,
        color: "#000",
    },
});
