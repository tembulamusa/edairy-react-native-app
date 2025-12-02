// src/screens/MemberKilosScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Switch,
    TextInput,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import BluetoothConnectionModal from '../../components/modals/BluetoothConnectionModal';
import useBluetoothService from "../../hooks/useBluetoothService.ts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import fetchCommonData from "../../components/utils/fetchCommonData.ts";
import makeRequest from "../../components/utils/makeRequest.ts";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all.tsx";
import CashoutFormModal from "../../components/modals/CashoutFormModal.tsx";
import SuccessModal from "../../components/modals/SuccessModal.tsx";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import { globalStyles } from "../../styles.ts";

const MemberKilosScreen = () => {
    // --- Toggle state ---
    const navigation = useNavigation();
    const [viewMode, setViewMode] = useState(true); // true = View Kilos, false = Record Kilos
    const [isMemberOnly, setIsMemberOnly] = useState(false);
    const [customer_type, setCustomerType] = useState<string>("member");
    const [can, setCan] = useState<any>({});
    const [totalCans, setTotalCans] = useState<number>(0);
    const [scaleWeight, setScaleWeight] = useState<number | null>(null);
    const [totalQuantity, setTotalQuantity] = useState<number | null>(0);
    const [transporter, setTransporter] = useState<any>(null);
    const [route, setRoute] = useState<any>(null);
    const [center, setCenter] = useState<any>(null);
    const [shift, setShift] = useState<any>(null);
    const [member, setMember] = useState<any>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [scaleWeightText, setScaleWeightText] = useState<string>("");
    const [commonData, setCommonData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [memberCreditLimit, setMemberCreditLimit] = useState<number | null>(null);
    const [fetchingCredit, setFetchingCredit] = useState(false);
    const [errors, setErrors] = useState<any>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState<any[]>([]); // initialize as empty
    const [transporterDisabled, setTransporterDisabled] = useState(false);

    // --- Dropdown data states ---
    const [transporterItems, setTransporterItems] = useState<any[]>([]);
    const [shiftItems, setShiftItems] = useState<any[]>([]);
    const [routeItems, setRouteItems] = useState<any[]>([]);
    const [centerItems, setCenterItems] = useState<any[]>([]);
    const [canItems, setCanItems] = useState<any[]>([]);
    const [measuringCanItems, setMeasuringCanItems] = useState<any[]>([]);

    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [centerValue, setCenterValue] = useState<number | null>(null);
    const [canValue, setCanValue] = useState<number | null>(null);

    // --- Dropdown open states ---
    const [transporterOpen, setTransporterOpen] = useState(false);
    const [shiftOpen, setShiftOpen] = useState(false);
    const [routeOpen, setRouteOpen] = useState(false);
    const [centerOpen, setCenterOpen] = useState(false);
    const [memberOpen, setMemberOpen] = useState(false);
    const [canOpen, setCanOpen] = useState(false);

    const [measuringCanValue, setMeasuringCanValue] = useState<number | null>(null);
    const [measuringCanOpen, setMeasuringCanOpen] = useState(false);

    const [scaleModalVisible, setScaleModalVisible] = useState(false);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // --- Scale hook for weight operations (BLE only) ---
    const scaleBluetooth = useBluetoothService({ deviceType: "scale" });

    // --- Destructure for scale operations ---
    const {
        devices: scaleDevices,
        connectToDevice: connectToScaleDevice,
        scanForDevices: scanForScaleDevices,
        connectedDevice: connectedScaleDevice,
        lastMessage,
        isScanning: isScanningScale,
        isConnecting: isConnectingScale,
        disconnect: disconnectScale,
    } = scaleBluetooth;

    // --- Printer hook for printing operations (BLE only) ---
    const printerBluetooth = useBluetoothService({ deviceType: "printer" });

    // --- Destructure for printer operations ---
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

    // Ref to track printer devices for auto-connect (similar to StoreSaleModal)
    const printerDevicesRef = useRef<any[]>(printerDevices || []);
    useEffect(() => {
        printerDevicesRef.current = printerDevices || [];
    }, [printerDevices]);

    // Update scale weight when data is received from connected device
    // lastMessage is already weight in kgs (0.01 precision) from useBluetoothService
    useEffect(() => {
        if (lastMessage && connectedScaleDevice) {
            // lastMessage is already weight in kgs, just parse and use it
            const weight = parseFloat(lastMessage);
            if (!isNaN(weight)) {
                setScaleWeight(weight);
                // Clear manual text input when scale is connected
                setScaleWeightText("");
            }
        }
    }, [lastMessage, connectedScaleDevice]);

    // Clear scaleWeightText when scale connects to allow fresh input
    useEffect(() => {
        if (connectedScaleDevice) {
            setScaleWeightText("");
        }
    }, [connectedScaleDevice]);

    // Auto-connect scale on load: Check AsyncStorage and connect based on stored type
    useEffect(() => {
        const autoConnectToLastScale = async () => {
            try {
                // Skip if already connected
                if (connectedScaleDevice) {
                    try {
                        let stillConnected = false;
                        if (connectedScaleDevice.type === 'ble' && connectedScaleDevice.bleDevice) {
                            stillConnected = (connectedScaleDevice.bleDevice as any).isConnected === true;
                        } else if (connectedScaleDevice.type === 'classic' && connectedScaleDevice.classicDevice) {
                            stillConnected = await connectedScaleDevice.classicDevice.isConnected();
                        }
                        if (stillConnected) {
                            console.log('[MemberKilos] AUTO-CONNECT SCALE: Already connected, skipping');
                            return;
                        }
                    } catch { }
                }

                // Retrieve last device from AsyncStorage
                const lastScale = await AsyncStorage.getItem('last_device_scale');
                if (!lastScale) {
                    console.log('[MemberKilos] AUTO-CONNECT SCALE: No last device found in storage');
                    return;
                }

                let deviceData: any = null;
                try {
                    deviceData = typeof lastScale === 'string' ? JSON.parse(lastScale) : lastScale;
                    console.log('[MemberKilos] AUTO-CONNECT SCALE: Last device found:', deviceData);
                    console.log('[MemberKilos] AUTO-CONNECT SCALE: Device type:', deviceData.type || 'unknown');
                } catch (parseError) {
                    console.error('[MemberKilos] AUTO-CONNECT SCALE: Error parsing stored device:', parseError);
                    return;
                }

                const deviceId = deviceData.id || deviceData.address || deviceData.address_or_id;
                if (!deviceId) {
                    console.log('[MemberKilos] AUTO-CONNECT SCALE: No valid device ID found');
                    return;
                }

                // First, trigger a scan to discover devices
                console.log('[MemberKilos] AUTO-CONNECT SCALE: Starting device scan to find saved device...');
                scanForScaleDevices(); // Don't await - let it run in background

                // Wait for scan to complete (15 seconds for BLE scan + buffer)
                console.log('[MemberKilos] AUTO-CONNECT SCALE: Waiting for scan to complete (18 seconds)...');
                await new Promise<void>(r => setTimeout(() => r(), 18000)); // Wait 18 seconds for scan to finish

                // Re-check scaleDevices after waiting (state should be updated by now)
                // Use a small delay to ensure state is updated
                await new Promise<void>(r => setTimeout(() => r(), 500));

                console.log('[MemberKilos] AUTO-CONNECT SCALE: Checking for device after scan...');
                console.log('[MemberKilos] AUTO-CONNECT SCALE: Looking for device ID:', deviceId);

                // The connectToDevice function in the hook will handle finding and connecting
                // It will try BLE first, then Classic as fallback
                // So we can just call it with the device ID and let the hook handle the rest
                const storedType = deviceData.type || 'ble';
                console.log('[MemberKilos] AUTO-CONNECT SCALE: Stored type is', storedType, '- attempting connection to:', deviceId);
                console.log('[MemberKilos] AUTO-CONNECT SCALE: connectToDevice will try BLE first, then Classic if needed...');

                try {
                    await connectToScaleDevice(deviceId);
                    console.log('[MemberKilos] AUTO-CONNECT SCALE: ✓ Connection attempt completed');
                } catch (connectError) {
                    console.error('[MemberKilos] AUTO-CONNECT SCALE: Connection error:', connectError);
                }
            } catch (error) {
                console.error('[MemberKilos] AUTO-CONNECT SCALE: Failed:', error);
                // Don't show alert - just log the error to avoid annoying the user
            }
        };

        // Run auto-connect after a short delay to allow component to mount
        const timeout = setTimeout(() => {
            autoConnectToLastScale();
        }, 2000); // Slightly longer delay to ensure hook is initialized

        return () => clearTimeout(timeout);
    }, []); // Run once on mount

    // Helper: Persist printer to AsyncStorage (similar to StoreSaleModal)
    const persistLastPrinter = useCallback(async (device: any) => {
        if (!device) return;
        try {
            const payload = {
                id: device?.id || device?.address || device?.address_or_id,
                address: device?.address || device?.id || device?.address_or_id,
                name: device?.name || device?.label || "InnerPrinter",
                type: device?.type || "classic", // InnerPrinter uses Classic
                saved_at: new Date().toISOString(),
            };

            if (!payload.id || !payload.address) {
                console.log("[MemberKilos] persistLastPrinter: Missing id/address, skipping save");
                return;
            }

            await AsyncStorage.setItem("last_device_printer", JSON.stringify(payload));
            console.log("[MemberKilos] persistLastPrinter: Saved printer", payload.name);
        } catch (error) {
            console.error("[MemberKilos] persistLastPrinter: Failed to save printer", error);
        }
    }, []);

    // Helper: Connect to any available InnerPrinter (similar to StoreSaleModal)
    const connectToAnyAvailablePrinter = useCallback(async (): Promise<boolean> => {
        try {
            console.log("[MemberKilos] AUTO-CONNECT: Scanning for InnerPrinter...");
            await scanForPrinterDevices();

            // Wait a bit for scan to complete
            await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

            // Get the latest devices from the ref (updated by useEffect)
            const devices = printerDevicesRef.current || [];
            console.log("[MemberKilos] AUTO-CONNECT: Found", devices.length, "printer devices");

            if (devices.length === 0) {
                console.log("[MemberKilos] AUTO-CONNECT: No printers found in scan");
                return false;
            }

            // Filter for InnerPrinter devices first (case-insensitive)
            const innerPrinters = devices.filter(device => {
                const deviceName = (device.name || '').toLowerCase();
                return deviceName.includes('innerprinter') || deviceName.includes('inner');
            });

            let targetPrinter;
            if (innerPrinters.length > 0) {
                targetPrinter = innerPrinters[0];
                console.log("[MemberKilos] AUTO-CONNECT: Found InnerPrinter device:", targetPrinter.name || targetPrinter.id);
            } else {
                // Fallback to first available printer if no InnerPrinter found
                targetPrinter = devices[0];
                console.log("[MemberKilos] AUTO-CONNECT: No InnerPrinter found, using first available printer:", targetPrinter.name || targetPrinter.id);
            }

            const deviceId = targetPrinter?.id || targetPrinter?.address || targetPrinter?.address_or_id;

            if (!deviceId) {
                console.log("[MemberKilos] AUTO-CONNECT: Target printer missing device id");
                return false;
            }

            console.log("[MemberKilos] AUTO-CONNECT: Attempting connection to", targetPrinter.name || deviceId);
            const result = await connectToPrinterDevice(deviceId);
            const success = !!result;
            console.log("[MemberKilos] AUTO-CONNECT:", success ? "✓ Connected" : "✗ Connection failed");

            if (success) {
                await persistLastPrinter(result);
                // Wait for connection to be fully established
                console.log("[MemberKilos] AUTO-CONNECT: Waiting for connection to stabilize...");
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return success;
        } catch (error) {
            console.error("[MemberKilos] AUTO-CONNECT: Error connecting to printer:", error);
            return false;
        }
    }, [scanForPrinterDevices, connectToPrinterDevice, persistLastPrinter]);

    // Helper: Attempt auto-connect (try saved first, then scan for InnerPrinter)
    const attemptAutoConnectPrinter = useCallback(async (): Promise<boolean> => {
        if (connectedPrinterDevice || isConnectingPrinter) {
            return true;
        }

        try {
            // First, try stored printer
            const stored = await AsyncStorage.getItem("last_device_printer");
            if (stored) {
                let data: any = null;
                try {
                    data = JSON.parse(stored);
                } catch (parseError) {
                    console.error("[MemberKilos] AUTO-CONNECT: Failed to parse stored printer:", parseError);
                }

                if (data) {
                    const deviceId = data?.id || data?.address || data?.address_or_id;
                    if (deviceId) {
                        console.log("[MemberKilos] AUTO-CONNECT: Scanning for saved printer...");
                        await scanForPrinterDevices();
                        await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
                        console.log("[MemberKilos] AUTO-CONNECT: Attempting connection to stored printer", deviceId);
                        const result = await connectToPrinterDevice(deviceId);
                        const success = !!result;
                        console.log("[MemberKilos] AUTO-CONNECT:", success ? "✓ Connected to stored printer" : "✗ Stored printer connection failed");

                        if (success) {
                            await persistLastPrinter(result);
                            // Wait for connection to be fully established
                            console.log("[MemberKilos] AUTO-CONNECT: Waiting for connection to stabilize...");
                            await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
                            return true;
                        }
                    }
                }
            }

            // If stored printer failed or doesn't exist, try any available InnerPrinter
            console.log("[MemberKilos] AUTO-CONNECT: Trying to connect to any available InnerPrinter...");
            return await connectToAnyAvailablePrinter();
        } catch (error) {
            console.error("[MemberKilos] AUTO-CONNECT: Unexpected error:", error);
            return false;
        }
    }, [connectToPrinterDevice, scanForPrinterDevices, connectedPrinterDevice, isConnectingPrinter, persistLastPrinter, connectToAnyAvailablePrinter]);

    // Auto-connect printer on load: Check AsyncStorage and connect to InnerPrinter (similar to StoreSaleModal)
    useEffect(() => {
        const autoConnectToLastPrinter = async () => {
            try {
                // Skip if already connected
                if (connectedPrinterDevice) {
                    try {
                        let stillConnected = false;
                        if (connectedPrinterDevice.type === 'ble' && connectedPrinterDevice.bleDevice) {
                            stillConnected = (connectedPrinterDevice.bleDevice as any).isConnected === true;
                        } else if (connectedPrinterDevice.type === 'classic' && connectedPrinterDevice.classicDevice) {
                            stillConnected = await connectedPrinterDevice.classicDevice.isConnected();
                        }
                        if (stillConnected) {
                            console.log('[MemberKilos] AUTO-CONNECT PRINTER: Already connected, skipping');
                            return;
                        }
                    } catch { }
                }

                // Use the attemptAutoConnectPrinter helper (similar to StoreSaleModal)
                await attemptAutoConnectPrinter();
            } catch (error) {
                console.error('[MemberKilos] AUTO-CONNECT PRINTER: Failed:', error);
                // Don't show alert - just log the error
            }
        };

        // Run auto-connect after a short delay to allow component to mount
        const timeout = setTimeout(() => {
            autoConnectToLastPrinter();
        }, 5000); // Delay printer auto-connect a bit more to let scale connect first

        return () => clearTimeout(timeout);
    }, [attemptAutoConnectPrinter, connectedPrinterDevice]); // Include dependencies

    // Show alert if connection failed
    useEffect(() => {
        if (scaleBluetooth.connectionFailed && scaleBluetooth.lastConnectionAttempt) {
            Alert.alert(
                "Connection Failed",
                `Failed to connect to the last used scale device. Please check if the device is powered on and try connecting manually.`,
                [{ text: "OK", style: "default" }]
            );
        }
    }, [scaleBluetooth.connectionFailed, scaleBluetooth.lastConnectionAttempt]);

    const [isCashoutModalVisible, setIsCashoutModalVisible] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any | null>(null);

    // --- Load Common Data + Auto-select member if needed ---
    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [transporters, routes, shifts, members, cans, centers] =
                    await Promise.all([
                        fetchCommonData({ name: "transporters", cachable: false }),
                        fetchCommonData({ name: "routes" }),
                        fetchCommonData({ name: "shifts" }),
                        fetchCommonData({ name: "members", cachable: false }),
                        fetchCommonData({ name: "cans" }),
                        fetchCommonData({ name: "centers" }),
                    ]);
                const allData = { transporters, routes, shifts, members, cans, centers, measuring_cans: [] };
                setCommonData(allData);
                // populate dropdown items
                setTransporterItems((transporters || []).map((t: any) => ({ label: t.full_names, value: t.id })));
                setShiftItems((shifts || []).map((s: any) => ({ label: s.name, value: s.id })));
                setRouteItems((routes || []).map((r: any) => ({ label: `${r.route_name} (${r.route_code})`, value: r.id })));
                setMemberItems((members || []).map((m: any) => ({ label: `${m.first_name} ${m.last_name}`, value: m.id })));
                setCanItems((cans || []).map((c: any) => ({ label: c.can_id || `Can ${c.id}`, value: c.id })));
                // Measuring cans will be loaded when transporter is selected
                setMeasuringCanItems([]);
                setCenterItems((centers || []).map((c: any) => ({ label: c.center, value: c.id })));

                // Auto-select shift based on current time period (morning, afternoon, evening)
                if (shifts && shifts.length > 0) {
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

                    console.log(`[MemberKilos] Current time: ${currentHours}:${currentTime.getMinutes()} - Period: ${currentPeriod}`);
                    console.log(`[MemberKilos] Available shifts:`, shifts.map((s: any) => ({ id: s.id, name: s.name, time: s.time })));

                    // Find shift that matches current time period
                    const matchingShift = shifts?.find((s: any) => {
                        if (!s.time) {
                            console.log(`[MemberKilos] Shift ${s.id} (${s.name}) has no time field`);
                            return false;
                        }

                        // Normalize the time field to lowercase and remove any extra whitespace
                        const shiftTime = s.time.toString().trim().toLowerCase();

                        // More flexible matching - check if the time field contains the period
                        // This handles cases like "Morning Shift", "morning", "MORNING", etc.
                        const matches = shiftTime === currentPeriod ||
                            shiftTime.includes(currentPeriod) ||
                            currentPeriod.includes(shiftTime);

                        console.log(`[MemberKilos] Shift ${s.id} (${s.name}): time="${s.time}" -> normalized="${shiftTime}", currentPeriod="${currentPeriod}", matches=${matches}`);

                        return matches;
                    });

                    if (matchingShift) {
                        setShiftValue(matchingShift?.id);
                        setShift(matchingShift);
                        console.log(`[MemberKilos] ✅ Auto-selected shift: ${matchingShift.name} (ID: ${matchingShift.id}) - Time period: ${currentPeriod}`);
                    } else {
                        console.log(`[MemberKilos] ❌ No shift found matching current time period: ${currentPeriod}`);
                        console.log(`[MemberKilos] Available shift times:`, shifts.map((s: any) => s.time).filter(Boolean));
                    }
                } else {
                    console.log(`[MemberKilos] No shifts available for auto-selection`);
                }
                // Load user info
                const userDataString = await AsyncStorage.getItem("user");
                if (userDataString) {
                    const userData = JSON.parse(userDataString);
                    const userGroups = userData?.user_groups || [];

                    const memberOnly =
                        !userGroups.includes("transporter") &&
                        !userGroups.includes("employee");

                    setIsMemberOnly(memberOnly);

                    if (memberOnly) {
                        setViewMode(true);
                        const matched = (members || []).find((m: any) => m.id === userData?.member_id);
                        if (matched) {
                            setMemberValue(matched.id);
                            setSelectedMember(matched);
                        }
                    }

                    // Auto-select transporter if user is in transporter group
                    if (userGroups.includes("transporter") && userData?.member_id) {
                        const matchedTransporter = (transporters || []).find((t: any) => t.member_id === userData.member_id);
                        if (matchedTransporter) {
                            setTransporterValue(matchedTransporter.id);
                            setTransporter(matchedTransporter);
                            console.log(`[MemberKilos] ✅ Auto-selected transporter: ${matchedTransporter.full_names} (ID: ${matchedTransporter.id})`);

                            // Disable transporter dropdown if user is NOT an employee
                            if (!userGroups.includes("employee")) {
                                setTransporterDisabled(true);
                                console.log(`[MemberKilos] ✅ Disabled transporter dropdown (user is not an employee)`);
                            }
                        } else {
                            console.log(`[MemberKilos] ❌ No transporter found matching user member_id: ${userData.member_id}`);
                        }
                    }
                }
            } catch (error: any) {
                Alert.alert("Error", error.message || "Failed to load data");
            }
        };
        loadCommonData();
    }, []);

    // --- Fetch Credit Limit ---
    useEffect(() => {
        const fetchCreditLimit = async () => {
            if (!memberValue) return;
            setFetchingCredit(true);
            try {
                const [status, response] = await makeRequest({
                    url: `member-credit-limit?member=${memberValue}`,
                    method: "GET",
                });

                if (![200, 201].includes(status)) {
                    Alert.alert("Error", response?.message || "Failed to fetch credit limit");
                    return;
                }
                setMemberCreditLimit(response?.data?.credit_limit ?? 0);
            } catch (err) {
                console.error(err);
            } finally {
                setFetchingCredit(false);
            }
        };

        fetchCreditLimit();
    }, [memberValue]);

    // Keep selected can details fully loaded
    useEffect(() => {
        if (canValue && Array.isArray(commonData.cans)) {
            const found = commonData.cans.find((c: any) => c.id === canValue);
            if (found) setCan(found);
        }
    }, [canValue, commonData.cans]);
    // Keep selected can details fully loaded
    useEffect(() => {
        if (memberValue && Array.isArray(commonData.members)) {
            const found = commonData.members.find((m: any) => m.id === memberValue);
            if (found) setMember(found);
            if (found) setSelectedMember(found || null);
        }
    }, [memberValue, commonData.members]);

    // Fetch measuring cans when transporter is selected
    useEffect(() => {
        const fetchMeasuringCans = async () => {
            if (!transporterValue) {
                // Clear measuring cans if no transporter is selected
                setCommonData((prev: any) => ({ ...prev, measuring_cans: [] }));
                setMeasuringCanItems([]);
                setMeasuringCanValue(null);
                setMeasuringCan(null);
                return;
            }

            try {
                console.log(`[MemberKilos] Fetching measuring cans for transporter_id: ${transporterValue}`);
                const measuringCans = await fetchCommonData({
                    name: "measuring_cans",
                    cachable: false,
                    params: { transporter_id: transporterValue }
                });

                // Update commonData with fetched measuring cans
                setCommonData((prev: any) => ({
                    ...prev,
                    measuring_cans: measuringCans || []
                }));

                // Update measuring can items
                const canItems = (measuringCans || []).map((c: any) => ({
                    label: c.can_id || `Can ${c.id}`,
                    value: c.id
                }));
                setMeasuringCanItems(canItems);

                // Clear measuring can selection if current selection is not in new list
                if (measuringCanValue) {
                    const isStillAvailable = (measuringCans || []).some((c: any) => c.id === measuringCanValue);
                    if (!isStillAvailable) {
                        setMeasuringCanValue(null);
                        setMeasuringCan(null);
                    }
                }
            } catch (error: any) {
                console.error('[MemberKilos] Error fetching measuring cans:', error);
                Alert.alert("Error", `Failed to load measuring cans: ${error.message || 'Unknown error'}`);
                // Clear on error
                setCommonData((prev: any) => ({ ...prev, measuring_cans: [] }));
                setMeasuringCanItems([]);
            }
        };

        fetchMeasuringCans();
    }, [transporterValue]);

    // Keep selected measuring can details fully loaded
    const [measuringCan, setMeasuringCan] = useState<any | null>(null);
    useEffect(() => {
        if (measuringCanValue && Array.isArray(commonData?.measuring_cans)) {
            const found = (commonData?.measuring_cans || []).find((c: any) => c.id === measuringCanValue);
            if (found) {
                setMeasuringCan(found);
                console.log(`[MemberKilos] Measuring can loaded:`, found);
                console.log(`[MemberKilos] Measuring can tare_weight:`, found?.tare_weight);
            } else {
                console.log(`[MemberKilos] Measuring can not found for ID: ${measuringCanValue}`);
                console.log(`[MemberKilos] Available measuring cans:`, commonData?.measuring_cans);
            }
        } else if (!measuringCanValue) {
            setMeasuringCan(null);
        }
    }, [measuringCanValue, commonData?.measuring_cans]);

    // --- takeWeight: push current scale weight into entries and update totals ---
    const takeWeight = () => {
        if (scaleWeight === null || scaleWeight === undefined) {
            Alert.alert("No weight", "No weight available to record.");
            return;
        }
        if (!measuringCan || typeof measuringCan.tare_weight !== 'number') {
            Alert.alert("Missing Measuring Can", "Select a measuring can for tare weight before recording.");
            return;
        }
        if (!can || !canValue || !can.id) {
            Alert.alert("Missing Can", "Please select a can before recording the weight.");
            return;
        }
        const tare = measuringCan.tare_weight; // Always use measuring can's tare
        const net = parseFloat((scaleWeight - tare).toFixed(2));

        // Prevent adding entry if net weight is negative
        if (net < 0) {
            Alert.alert(
                "Invalid Weight",
                `Net weight is negative (${net.toFixed(2)} KG). Please check the scale weight and measuring can tare weight. Entry not added.`
            );
            return;
        }

        const entry = {
            can_id: can?.id ?? null,
            can_label: can?.can_id ?? `Can ${can?.id ?? "N/A"}`,
            scale_weight: scaleWeight,
            tare_weight: tare, // Always from measuring can
            net,
        };
        setEntries(prev => [...prev, entry]);
        setTotalCans(prev => prev + 1);
        setTotalQuantity(prev => (prev ?? 0) + net);
        setScaleWeight(null);
        setScaleWeightText("");
        setCanValue(null);
    };

    // Format receipt for member kilos (takes all needed parameters to avoid closure issues)
    const formatMemberKilosReceipt = (
        responseData: any,
        capturedEntries: any[],
        capturedTotalCans: number,
        capturedTotalQuantity: number | null,
        capturedMemberValue: number | null,
        capturedTransporterValue: number | null,
        capturedShiftValue: number | null,
        capturedRouteValue: number | null,
        capturedCenterValue: number | null,
        capturedCommonData: any
    ) => {
        const selectedMember = capturedCommonData?.members?.find((m: any) => m.id === capturedMemberValue);
        const selectedTransporter = capturedCommonData?.transporters?.find((t: any) => t.id === capturedTransporterValue);
        const selectedShift = capturedCommonData?.shifts?.find((s: any) => s.id === capturedShiftValue);
        const selectedRoute = capturedCommonData?.routes?.find((r: any) => r.id === capturedRouteValue);
        const selectedCenter = capturedCommonData?.centers?.find((c: any) => c.id === capturedCenterValue);

        let receipt = "";
        receipt += "      E-DAIRY LIMITED\n";
        receipt += "      P.O. Box [P.O. Box Number]\n";
        receipt += "\n\n";
        receipt += "      MEMBER KILOS RECEIPT\n";
        receipt += "================================\n";
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];
        receipt += `Date: ${dateStr} ${timeStr}\n`;
        receipt += `Member: ${selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : 'N/A'}\n`;
        receipt += `Transporter: ${selectedTransporter?.full_names || 'N/A'}\n`;
        receipt += `Shift: ${selectedShift?.name || 'N/A'}\n`;
        receipt += `Route: ${selectedRoute?.route_name || 'N/A'}\n`;
        receipt += `Center: ${selectedCenter?.center || 'N/A'}\n`;
        receipt += "--------------------------------\n";
        receipt += `Total Cans: ${capturedTotalCans}\n`;
        receipt += `Total Quantity: ${(capturedTotalQuantity || 0).toFixed(2)} KG\n`;
        receipt += "--------------------------------\n";
        receipt += "Cans Details:\n";

        (capturedEntries || []).forEach((entry: any, index: number) => {
            receipt += `${index + 1}. Can ${entry?.can_label || 'N/A'} - Net: ${entry?.net || 0} KG\n`;
        });

        receipt += "--------------------------------\n";
        receipt += `TOTAL NET WEIGHT: ${(capturedTotalQuantity || 0).toFixed(2)} KG\n`;
        receipt += "================================\n";
        receipt += "Thank you for your delivery!\n";
        receipt += "================================\n";
        receipt += "Powered by eDairy.africa\n";
        receipt += "\n\n";

        return receipt;
    };

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
                        const savedType = printerData.type || 'classic'; // Default to classic for safety
                        const printerName = (printerData.name || '').toLowerCase();
                        const isInnerPrinter = printerName.includes('innerprinter') || printerName.includes('inner');

                        if (deviceId) {
                            console.log('[PRINT] Found saved printer:', printerData.name || deviceId);
                            console.log('[PRINT] Saved printer type:', savedType);

                            // If it's InnerPrinter or saved as Classic, ensure we use Classic connection
                            if (isInnerPrinter || savedType === 'classic') {
                                console.log('[PRINT] InnerPrinter or Classic printer detected - will use Classic connection');
                            }

                            // Try to connect to saved printer with timeout
                            // connectToDevice will handle forcing Classic for InnerPrinter
                            try {
                                const result = await Promise.race([
                                    connectToPrinterDevice(deviceId),
                                    new Promise<null>((_, reject) =>
                                        setTimeout(() => reject(new Error('Connection timeout')), 10000)
                                    )
                                ]);

                                if (result) {
                                    console.log('[PRINT] ✅ Connected to saved printer');
                                    // Verify it's using the correct type
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
                                    type: 'classic', // InnerPrinter uses Classic Bluetooth, not BLE
                                    address_or_id: firstInnerPrinter.id,
                                    saved_at: new Date().toISOString()
                                };
                                await AsyncStorage.setItem('last_device_printer', JSON.stringify(printerInfo));
                                console.log('[PRINT] ✅ Connected to InnerPrinter and saved to AsyncStorage');
                                return true;
                            } catch (saveErr) {
                                console.warn('[PRINT] ⚠️ Error saving printer (but connected):', saveErr);
                                return true; // Still return true since connection succeeded
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

        // Use provided device or fall back to state
        let printerDevice = deviceOverride || connectedPrinterDevice;

        // If device was provided but state might not be updated yet, wait and verify
        if (deviceOverride && !connectedPrinterDevice) {
            console.log('[PRINT] Device provided but state not updated yet, waiting for state sync...');
            // Wait for state to update (React state updates are async)
            for (let i = 0; i < 5; i++) {
                await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
                if (connectedPrinterDevice) {
                    console.log('[PRINT] State updated, using state device');
                    printerDevice = connectedPrinterDevice;
                    break;
                }
            }
            // If state still not updated, use the provided device
            if (!connectedPrinterDevice) {
                console.log('[PRINT] State not updated, will use provided device (printTextToPrinter may use state)');
            }
        }

        // Check if printer is connected and print function is available
        if (!printerDevice) {
            console.error('[PRINT] No printer connected');
            // If no device provided and state is not set, wait a bit and retry (React state update delay)
            if (!deviceOverride && !connectedPrinterDevice) {
                console.log('[PRINT] Waiting for state update (500ms)...');
                await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
                // Retry once with updated state
                if (connectedPrinterDevice) {
                    console.log('[PRINT] Retrying with updated state...');
                    return printReceipt(receiptText, connectedPrinterDevice);
                }
            }
            // Show alert instead of silently failing
            try {
                Alert.alert("Printer Not Available", "No printer connected. Please connect a printer to print the receipt.");
            } catch (alertErr) {
                console.error('[PRINT] Error showing alert:', alertErr);
            }
            return false;
        }

        if (!printTextToPrinter) {
            console.error('[PRINT] Print function not available');
            // Show alert instead of silently failing
            try {
                Alert.alert("Printer Not Available", "Print function is not available. Please check printer connection.");
            } catch (alertErr) {
                console.error('[PRINT] Error showing alert:', alertErr);
            }
            return false;
        }

        // Verify the hook's state has the device (printTextToPrinter uses hook's state)
        if (!connectedPrinterDevice && deviceOverride) {
            console.warn('[PRINT] Warning: Hook state not updated, but device provided. Print may fail if hook state is required.');
            console.log('[PRINT] Waiting additional 500ms for hook state update...');
            await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
            if (!connectedPrinterDevice) {
                console.error('[PRINT] Hook state still not updated after wait. This may cause print to fail.');
            }
        }

        // Double-check device is still connected before printing
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
                // Show alert instead of silently failing
                try {
                    Alert.alert("Printer Not Connected", "The printer is not connected. Please check the connection and try again.");
                } catch (alertErr) {
                    console.error('[PRINT] Error showing alert:', alertErr);
                }
                return false;
            }
        } catch (checkErr) {
            console.error('[PRINT] Error verifying printer connection:', checkErr);
            // Show alert for connection verification error
            try {
                Alert.alert("Printer Connection Error", "Unable to verify printer connection. Please check the printer and try again.");
            } catch (alertErr) {
                console.error('[PRINT] Error showing alert:', alertErr);
            }
            return false;
        }

        try {
            console.log('[PRINT] Starting print operation...');

            // Wrap printTextToPrinter in a try-catch to handle any synchronous errors
            let printPromise: Promise<void>;
            try {
                printPromise = printTextToPrinter(receiptText);
                if (!printPromise || typeof printPromise.then !== 'function') {
                    console.error('[PRINT] Print function did not return a promise');
                    // Show alert
                    try {
                        Alert.alert("Print Error", "Print function error. Please try again.");
                    } catch (alertErr) {
                        console.error('[PRINT] Error showing alert:', alertErr);
                    }
                    return false;
                }
            } catch (syncErr) {
                console.error('[PRINT] Synchronous error calling print function:', syncErr);
                // Show alert
                try {
                    Alert.alert("Print Error", "Failed to start printing. Please check the printer connection.");
                } catch (alertErr) {
                    console.error('[PRINT] Error showing alert:', alertErr);
                }
                return false;
            }

            // Add timeout to prevent hanging
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
                // Show alert for timeout or print error
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

            // Show alert for any unexpected errors
            try {
                Alert.alert("Print Error", "An error occurred while printing. Please check the printer and try again.");
            } catch (alertErr) {
                console.error('[PRINT] Error showing alert:', alertErr);
            }
            return false;
        }
    }, [connectedPrinterDevice, printTextToPrinter]);

    // Helper: Connect to printer and return the connected device
    const connectToPrinterAndGetDevice = useCallback(async (): Promise<any | null> => {
        try {
            console.log('[PRINT] Connecting to printer and getting device...');

            // Check AsyncStorage for last printer
            try {
                const lastPrinter = await AsyncStorage.getItem('last_device_printer');
                if (lastPrinter) {
                    try {
                        const printerData = JSON.parse(lastPrinter);
                        const deviceId = printerData.id || printerData.address || printerData.address_or_id;

                        if (deviceId) {
                            console.log('[PRINT] Found saved printer:', printerData.name || deviceId);
                            const result = await Promise.race([
                                connectToPrinterDevice(deviceId),
                                new Promise<null>((_, reject) =>
                                    setTimeout(() => reject(new Error('Connection timeout')), 10000)
                                )
                            ]);

                            if (result) {
                                console.log('[PRINT] ✅ Connected to saved printer');
                                return result;
                            }
                        }
                    } catch (parseErr) {
                        console.warn('[PRINT] Error parsing saved printer:', parseErr);
                    }
                }
            } catch (storageErr) {
                console.warn('[PRINT] Error reading AsyncStorage:', storageErr);
            }

            // If saved printer not found or connection failed, scan for InnerPrinter
            try {
                console.log('[PRINT] Scanning for InnerPrinter devices...');
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
                        } catch (saveErr) {
                            console.warn('[PRINT] ⚠️ Error saving printer (but connected):', saveErr);
                        }
                        return result;
                    }
                }
            } catch (scanErr) {
                console.error('[PRINT] ⚠️ Error scanning for printers:', scanErr);
            }

            return null;
        } catch (error) {
            console.error('[PRINT] Error connecting to printer:', error);
            return null;
        }
    }, [connectToPrinterDevice, scanForPrinterDevices, printerDevices]);

    // Helper: Reconnect to scale from AsyncStorage
    const reconnectToScale = useCallback(async (): Promise<void> => {
        try {
            console.log('[SCALE] Reconnecting to scale from AsyncStorage...');

            try {
                const lastScale = await AsyncStorage.getItem('last_device_scale');
                if (!lastScale) {
                    console.log('[SCALE] No saved scale found');
                    return;
                }

                const scaleData = JSON.parse(lastScale);
                const deviceId = scaleData.id || scaleData.address || scaleData.address_or_id;

                if (deviceId) {
                    console.log('[SCALE] Found saved scale:', scaleData.name || deviceId);

                    // Add timeout to prevent hanging
                    try {
                        await Promise.race([
                            connectToScaleDevice(deviceId),
                            new Promise<never>((_, reject) =>
                                setTimeout(() => reject(new Error('Reconnection timeout')), 15000)
                            )
                        ]);
                        console.log('[SCALE] ✅ Reconnected to scale');
                    } catch (connectErr) {
                        console.error('[SCALE] ⚠️ Error connecting to scale (timeout or error):', connectErr);
                        // Don't throw - just log the error
                    }
                }
            } catch (parseErr) {
                console.error('[SCALE] ⚠️ Error parsing scale data:', parseErr);
            }
        } catch (error) {
            console.error('[SCALE] Error reconnecting to scale:', error);
            // Don't throw - just log the error
        }
    }, [connectToScaleDevice]);

    // --- sendMemberKilos: post entries, basic error handling ---
    const sendMemberKilos = async () => {
        // List of required fields
        const requiredFields = [
            { field: 'member', value: memberValue, label: 'Member' },
            { field: 'route', value: routeValue, label: 'Route' },
            { field: 'center', value: centerValue, label: 'Center' },
        ];

        // Check for missing required fields
        const missingFields = requiredFields.filter(field => !field.value);
        if (missingFields.length > 0) {
            const missingLabels = missingFields.map(f => f.label).join(', ');
            Alert.alert(
                "Required Fields Missing",
                `Please fill in the following required fields: ${missingLabels}`,
                [{ text: "OK" }]
            );
            return;
        }

        if (entries.length === 0) {
            Alert.alert("Nothing to send", "No recorded cans to send.");
            return;
        }

        // Check if any entry has negative net weight
        const hasNegativeNet = entries.some((entry) => {
            const net = entry?.net ?? 0;
            return net < 0;
        });

        if (hasNegativeNet) {
            Alert.alert(
                "Invalid Entry",
                "One or more entries have negative net weight. Please check your entries and remove or correct any entries with negative values before sending.",
                [{ text: "OK" }]
            );
            return;
        }

        setLoading(true);
        try {
            // Capture ALL state values before async operations to avoid closure issues
            const currentConnectedDevice = connectedScaleDevice;
            const capturedEntries = [...entries]; // Create a copy
            const capturedTotalCans = totalCans;
            const capturedTotalQuantity = totalQuantity;
            const capturedMemberValue = memberValue;
            const capturedTransporterValue = transporterValue;
            const capturedShiftValue = shiftValue;
            const capturedRouteValue = routeValue;
            const capturedCenterValue = centerValue;
            const capturedCommonData = commonData;

            const payload = {
                member_id: memberValue,
                transporter_id: transporterValue,
                route_id: routeValue,
                center_id: centerValue,
                shift_id: shiftValue,
                cans: entries,
                total_cans: totalCans,
                total_quantity: totalQuantity,
                is_manual_entry: !currentConnectedDevice, // 👈 use captured value
                device_uid: currentConnectedDevice?.id || currentConnectedDevice?.address || null, // 👈 use captured value
            };

            const [status, response] = await makeRequest({
                url: "member-kilos", // adjust to your real endpoint
                method: "POST",
                data: payload as any,
            });

            if ([200, 201].includes(status)) {
                // Prepare receipt text first using captured values
                let receiptText = "";
                try {
                    receiptText = formatMemberKilosReceipt(
                        response?.data,
                        capturedEntries,
                        capturedTotalCans,
                        capturedTotalQuantity,
                        capturedMemberValue,
                        capturedTransporterValue,
                        capturedShiftValue,
                        capturedRouteValue,
                        capturedCenterValue,
                        capturedCommonData
                    );
                } catch (formatError) {
                    console.error("Error formatting receipt:", formatError);
                    // Create a simple receipt if formatting fails
                    receiptText = `MEMBER KILOS RECEIPT\nDate: ${new Date().toISOString().split("T")[0]}\nTotal Quantity: ${(capturedTotalQuantity || 0).toFixed(2)} KG\n`;
                }

                // Show success modal with loading state
                setSuccessModalVisible(true);
                setIsPrinting(true);

                // Print receipt following the specified flow
                try {
                    // Step 1: Check if printer is already connected, if not try to connect
                    let connectedPrinter: any = null;

                    // First check if already connected
                    if (connectedPrinterDevice) {
                        try {
                            let isStillConnected = false;
                            if (connectedPrinterDevice.type === 'ble' && connectedPrinterDevice.bleDevice) {
                                isStillConnected = (connectedPrinterDevice.bleDevice as any).isConnected === true;
                            } else if (connectedPrinterDevice.type === 'classic' && connectedPrinterDevice.classicDevice) {
                                isStillConnected = await connectedPrinterDevice.classicDevice.isConnected();
                            }
                            if (isStillConnected) {
                                console.log('[PRINT] Printer already connected, using existing connection');
                                connectedPrinter = connectedPrinterDevice;
                            }
                        } catch (checkErr) {
                            console.warn('[PRINT] Error checking existing connection:', checkErr);
                        }
                    }

                    // If not connected, try to connect using the auto-connect logic
                    if (!connectedPrinter) {
                        try {
                            console.log('[PRINT] Printer not connected, attempting auto-connect...');
                            const connected = await attemptAutoConnectPrinter();
                            if (connected && connectedPrinterDevice) {
                                connectedPrinter = connectedPrinterDevice;
                                console.log('[PRINT] ✅ Printer connected via auto-connect');
                            }
                        } catch (connectErr) {
                            console.error('[PRINT] ⚠️ Error connecting to printer:', connectErr);
                        }
                    }

                    if (!connectedPrinter) {
                        // Step 3: If no InnerPrinter found, show modal with scanned printers
                        console.log('[PRINT] No InnerPrinter found, showing printer selection modal');
                        setIsPrinting(false);
                        setPrinterModalVisible(true);
                        // Store receipt text for printing after user selects printer
                        try {
                            await AsyncStorage.setItem('pending_receipt', receiptText);
                        } catch (storageErr) {
                            console.error('[PRINT] Error storing pending receipt:', storageErr);
                        }
                        return; // Exit early, printing will happen when user selects printer
                    }

                    // Wait for connection to be fully established before printing
                    console.log('[PRINT] Waiting for printer connection to stabilize before printing...');
                    await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));

                    // Step 2: Print receipt - with error handling
                    // Pass the connected device directly to avoid state timing issues
                    let printSuccess = false;
                    try {
                        printSuccess = await printReceipt(receiptText, connectedPrinter);
                        if (printSuccess) {
                            console.log('[PRINT] ✅ Receipt printed successfully');
                        } else {
                            console.warn('[PRINT] ⚠️ Printing failed');
                            // Alert is already shown in printReceipt function, just log here
                        }
                    } catch (printErr) {
                        console.error('[PRINT] ⚠️ Error during printing:', printErr);
                        printSuccess = false;
                        // Show alert for unexpected errors
                        try {
                            Alert.alert("Print Error", "An unexpected error occurred while printing. Please check the printer and try again.");
                        } catch (alertErr) {
                            console.error('[PRINT] Error showing alert:', alertErr);
                        }
                    }

                } catch (printerError) {
                    console.error("[PRINT] ❌ Unexpected printer error:", printerError);
                    // Show alert for unexpected errors
                    try {
                        const errorMsg = (printerError as any)?.message || String(printerError);
                        Alert.alert("Print Error", `An error occurred: ${errorMsg}. Please check the printer and try again.`);
                    } catch (alertErr) {
                        console.error('[PRINT] Error showing alert:', alertErr);
                    }
                } finally {
                    setIsPrinting(false);
                }

                // Clear local records AFTER printing/reconnection is complete
                // Use setTimeout to ensure state updates happen after current render cycle
                // Also wrap in try-catch to prevent crashes during state updates
                setTimeout(() => {
                    try {
                        setEntries([]);
                        setTotalCans(0);
                        setTotalQuantity(0);
                        setScaleWeight(null);
                        setCanValue(null);
                        setCan(null);
                        // Note: Don't clear memberValue here - let user decide or handle elsewhere if needed
                    } catch (clearError) {
                        console.error("Error clearing state:", clearError);
                    }
                }, 100);
            } else {
                console.error("sendMemberKilos error", response);
                Alert.alert("Failed", response?.message || "Failed to send kilos.");
            }
        } catch (err: any) {
            console.error(err);
            Alert.alert("Error", err?.message || "An error occurred while sending kilos.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isMemberOnly === false) {
            setViewMode(false);   // Always show Record Kilos for transporters/admins
        }
    }, [isMemberOnly]);

    // --- Render ---
    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={true}>
                {/* --- View/Record Toggle --- */}
                <View style={styles.toggleContainer}>
                    <Text style={styles.toggleLabel}>{viewMode ? "View Kilos" : "Record Kilos"}</Text>
                    <Switch
                        value={viewMode}
                        onValueChange={(val) => { if (!isMemberOnly) setViewMode(val); }}
                        disabled={isMemberOnly} // member-only cannot switch
                        trackColor={{ false: "#d1d5db", true: "#a7f3d0" }}
                        thumbColor={viewMode ? "#16a34a" : "#f1f5f9"}
                        style={{ transform: [{ scaleX: 1.4 }, { scaleY: 1.4 }] }} // bigger switch
                    />
                </View>

                <Text style={styles.title}>Member Kilos</Text>

                {viewMode ? (
                    // --- View Kilos UI --
                    <DropDownPicker
                        listMode="SCROLLVIEW"
                        open={memberOpen}
                        value={memberValue}
                        items={memberItems}
                        setOpen={setMemberOpen}
                        setValue={(val: any) => setMemberValue(val as number)}
                        setItems={setMemberItems}
                        disabled={isMemberOnly}
                        placeholder="Select member"
                        renderListItem={renderDropdownItem}
                        zIndex={3000}
                        style={globalStyles.basedropdown}
                        dropDownContainerStyle={globalStyles.basedropdown}
                        scrollViewProps={{ nestedScrollEnabled: true }}
                    />
                ) : (
                    <>
                        <View style={styles.row}>
                            <View style={styles.col}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={transporterOpen}
                                    value={transporterValue}
                                    items={transporterItems}
                                    setOpen={setTransporterOpen}
                                    setValue={(val: any) => { setTransporterValue(val as number); const sel = (commonData.transporters || []).find((t: any) => t.id === val); if (sel) setTransporter(sel); }}
                                    setItems={setTransporterItems}
                                    placeholder="Select transporter"
                                    searchable={true}
                                    searchPlaceholder="Search transporter"
                                    disabled={transporterDisabled}
                                    renderListItem={renderDropdownItem}
                                    zIndex={5000}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={2000}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                            <View style={styles.col}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={shiftOpen}
                                    value={shiftValue}
                                    items={shiftItems}
                                    setOpen={setShiftOpen}
                                    setValue={(val: any) => { setShiftValue(val as number); const sel = (commonData.shifts || []).find((s: any) => s.id === val); if (sel) setShift(sel); }}
                                    setItems={setShiftItems}
                                    placeholder="Select shift"
                                    searchable={true}
                                    searchPlaceholder="Search shift"
                                    renderListItem={renderDropdownItem}
                                    zIndex={4500}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={2000}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.col}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={routeOpen}
                                    value={routeValue}
                                    items={routeItems}
                                    setOpen={setRouteOpen}
                                    setValue={(val: any) => { setRouteValue(val as number); const sel = (commonData.routes || []).find((r: any) => r.id === val); if (sel) setRoute(sel); }}
                                    setItems={setRouteItems}
                                    placeholder="Select route"
                                    searchable={true}
                                    searchPlaceholder="Search route"
                                    renderListItem={renderDropdownItem}
                                    zIndex={4000}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={2000}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                            <View style={styles.col}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={centerOpen}
                                    value={centerValue}
                                    items={centerItems}
                                    setOpen={setCenterOpen}
                                    setValue={(val: any) => { setCenterValue(val as number); const sel = centerItems.find((c: any) => c.value === val); if (sel) setCenter({ id: sel.value, center: sel.label }); }}
                                    setItems={setCenterItems}
                                    placeholder="Select center"
                                    searchable={true}
                                    searchPlaceholder="Search center"
                                    renderListItem={renderDropdownItem}
                                    zIndex={3500}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={1500}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.col}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={memberOpen}
                                    value={memberValue}
                                    items={memberItems}
                                    setOpen={setMemberOpen}
                                    setValue={(val: any) => { setMemberValue(val as number); const sel = (commonData.members || []).find((m: any) => m.id === val); if (sel) setMember(sel); if (sel) setSelectedMember(sel); }}
                                    setItems={setMemberItems}
                                    placeholder="Select member"
                                    searchable={true}
                                    searchPlaceholder="Search member"
                                    renderListItem={renderDropdownItem}
                                    zIndex={3000}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={2000}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                            <View style={styles.col}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={canOpen}
                                    value={canValue}
                                    items={canItems.map((item) => ({
                                        ...item,
                                        disabled: entries.some((e) => e.can_id === item.value),
                                    }))}
                                    setOpen={setCanOpen}
                                    setValue={(val: any) => {
                                        setCanValue(val as number);
                                        const sel = (commonData.cans || []).find((c: any) => c.id === val);
                                        if (sel) setCan(sel);
                                    }}
                                    setItems={setCanItems}
                                    placeholder="Select can"
                                    searchable={true}
                                    searchPlaceholder="Search can"
                                    renderListItem={renderDropdownItem}
                                    zIndex={2500}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={2600}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.col}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={measuringCanOpen}
                                    value={measuringCanValue}
                                    items={measuringCanItems}
                                    setOpen={setMeasuringCanOpen}
                                    setValue={(val: any) => {
                                        setMeasuringCanValue(val as number);
                                        const sel = (commonData?.measuring_cans || []).find((c: any) => c.id === val);
                                        if (sel) setMeasuringCan(sel);
                                    }}
                                    setItems={setMeasuringCanItems}
                                    placeholder="Measuring Can"
                                    searchable={true}
                                    searchPlaceholder="Search can"
                                    renderListItem={renderDropdownItem}
                                    zIndex={2000}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={2500}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>

                        </View>

                        <View style={styles.row}>
                            {/* SCALE, CAN IN/OUT, NET fields */}
                            <View style={styles.col}>
                                <Text style={styles.label}>Scale</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Scale Wt"
                                    value={connectedScaleDevice
                                        ? (scaleWeight !== null && scaleWeight !== undefined ? String(scaleWeight) : "")
                                        : scaleWeightText
                                    }
                                    keyboardType="decimal-pad"
                                    editable={!connectedScaleDevice}
                                    onChangeText={(text) => {
                                        // Only handle onChangeText if scale is NOT connected (manual entry mode)
                                        if (!connectedScaleDevice) {
                                            // Allow only digits and a single decimal point
                                            const cleaned = text.replace(/[^0-9.]/g, "");

                                            // Prevent multiple decimal points
                                            if ((cleaned.match(/\./g) || []).length > 1) {
                                                return; // Don't update if multiple decimals
                                            }

                                            // Update the text state to allow typing "." and partial numbers
                                            setScaleWeightText(cleaned);

                                            // Parse to number for scaleWeight state
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
                                        // If connected to scale, onChangeText is ignored (value comes from lastMessage)
                                    }}
                                />
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.label}>Tare Wt</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Tare Wt"
                                    value={measuringCan?.tare_weight ? String(measuringCan?.tare_weight) : ""}
                                    editable={false}
                                />
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.label}>Net</Text>
                                <Text style={styles.value}>
                                    {scaleWeight !== null && measuringCan?.tare_weight !== undefined && measuringCan?.tare_weight !== null ?
                                        `${(scaleWeight - (measuringCan?.tare_weight ?? 0)).toFixed(2)} KG` : "--"}
                                </Text>
                            </View>
                        </View>


                        {/* Bluetooth Connection Status - Compact */}
                        <View style={{ marginVertical: 6, padding: 8, backgroundColor: '#f8fafc', borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            {isScanningScale ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    <ActivityIndicator size="small" color="#3b82f6" />
                                    <Text style={{ marginLeft: 6, color: '#3b82f6', fontWeight: '500', fontSize: 12 }}>
                                        Scanning for devices...
                                    </Text>
                                </View>
                            ) : connectedScaleDevice ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e', marginRight: 6 }} />
                                    <Text style={{ color: '#22c55e', fontWeight: '600', fontSize: 12 }}>
                                        Connected: {connectedScaleDevice?.name || connectedScaleDevice?.address || 'Unknown Device'} ({connectedScaleDevice?.type === 'ble' ? 'BLE' : connectedScaleDevice?.type === 'classic' ? 'CLASSIC' : 'UNKNOWN'})
                                    </Text>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 6 }} />
                                    <Text style={{ color: '#ef4444', fontWeight: '500', fontSize: 12 }}>
                                        No scale connected
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* BUTTONS */}
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
                                style={styles.button}
                                onPress={() => {
                                    if (!scaleWeight) {
                                        Alert.alert("No weight to lock!");
                                        return;
                                    }
                                    takeWeight();
                                }}
                            >
                                <Text style={styles.buttonText}>Take Record</Text>
                            </TouchableOpacity>
                        </View>

                        {/* RECORDED CANS LIST */}
                        <View style={{ marginVertical: 16 }}>
                            <Text style={{ fontWeight: "bold" }}>Recorded Cans: {entries?.length}</Text>
                            {entries.map((e, idx) => (
                                <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 4 }}>
                                    <Text>
                                        Can ({e.can_label}) - Gross: {e.scale_weight} - Tare: {e.tare_weight} - Net: {e.net}
                                    </Text>
                                    <TouchableOpacity onPress={() => {
                                        setEntries(prev => {
                                            const next = prev.filter((_, i) => i !== idx);
                                            // recalc totals
                                            const totalNet = next.reduce((s, it) => s + (it.net ?? 0), 0);
                                            setTotalQuantity(totalNet);
                                            setTotalCans(next.length);
                                            return next;
                                        });
                                    }}>
                                        <Text style={{ color: "red" }}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                        <View style={{ alignItems: "center", marginBottom: 10 }}>
                            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151" }}>
                                Total Net Weight: {totalQuantity?.toFixed(2) ?? 0} KG
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.submitButton} onPress={sendMemberKilos} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Send Kilos</Text>}
                        </TouchableOpacity>
                    </>
                )}

                {/* CREDIT LIMIT SECTION */}
                {memberValue && <View style={{ marginTop: 24, alignItems: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                        Member Credit Limit
                    </Text>

                    {fetchingCredit ? (
                        <Text>Loading...</Text>
                    ) : memberCreditLimit !== null ? (
                        <Text style={{ fontSize: 20, fontWeight: "bold", color: "green" }}>
                            {memberCreditLimit.toFixed(2)} KES
                        </Text>
                    ) : (
                        <Text style={{ color: "gray" }}>No data available</Text>
                    )}

                    <TouchableOpacity
                        style={{
                            marginTop: 12,
                            backgroundColor: "#E67E22",
                            paddingVertical: 10,
                            paddingHorizontal: 20,
                            borderRadius: 8,
                        }}
                        onPress={() => setIsCashoutModalVisible(true)}
                    >
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>Cashout</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigation.navigate("UserBalanceSummary" as never)}
                        style={{ marginTop: 10 }}
                    >
                        <Text style={{ color: "#2563eb", fontWeight: "600", textDecorationLine: "underline" }}>
                            Go to Summary & Balance
                        </Text>
                    </TouchableOpacity>
                </View>}
            </ScrollView>

            {/* MODALs */}
            {memberValue && <CashoutFormModal
                visible={isCashoutModalVisible}
                onClose={() => setIsCashoutModalVisible(false)}
                selectedMember={selectedMember}
                memberId={memberValue}
                customer_type={customer_type}
                onSubmit={() => {
                    setIsCashoutModalVisible(false);
                    setCustomerType("member");
                }}
            />}
            <BluetoothConnectionModal
                visible={scaleModalVisible}
                onClose={() => setScaleModalVisible(false)}
                type="device-list"
                deviceType="scale"
                title="Select Scale Device"
                devices={scaleDevices}
                connectToDevice={connectToScaleDevice}
                scanForDevices={scanForScaleDevices}
                isScanning={isScanningScale}
                isConnecting={isConnectingScale}
                connectedDevice={connectedScaleDevice}
                disconnect={disconnectScale}
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
                                // Check if it's InnerPrinter - it uses Classic, not BLE
                                const isInnerPrinter = (result.name || '').toLowerCase().includes('innerprinter') ||
                                    (result.name || '').toLowerCase().includes('inner');
                                const printerType = isInnerPrinter ? 'classic' : (result.type || 'classic');

                                const printerInfo = {
                                    id: result.id,
                                    address: result.id,
                                    name: result.name || 'Printer',
                                    type: printerType, // Use Classic for InnerPrinter, otherwise use device's actual type
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
                                            // Alert already shown in printReceipt function
                                            console.warn('[PRINT] Failed to print pending receipt');
                                        }
                                    } catch (printErr) {
                                        console.error('[PRINT] Error printing pending receipt:', printErr);
                                        // Show alert for unexpected errors
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
                                // Show alert for storage errors
                                try {
                                    Alert.alert("Error", "Failed to retrieve pending receipt. Please try printing again.");
                                } catch (alertErr) {
                                    console.error('[PRINT] Error showing alert:', alertErr);
                                }
                            }

                            // Close modal
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
                message="Kilos sent successfully!"
                isLoading={isPrinting}
                loadingMessage={isPrinting ? "Printing receipt..." : undefined}
                onClose={() => setSuccessModalVisible(false)}
            />
        </View >
    );
};

export default MemberKilosScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#fff" },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    col: { flex: 1, marginHorizontal: 4 },
    cashoutButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16a34a",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 10,
    },
    cashoutButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
        marginLeft: 8,
    },
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
    label: { fontSize: 14, marginBottom: 6, color: "#333" },
    input: { borderWidth: 1, borderColor: "#ddd", padding: 8, borderRadius: 6, backgroundColor: "#fff" },
    value: { fontSize: 16, fontWeight: "600", marginTop: 8 },
    buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 6, minWidth: 140, alignItems: "center" },
    buttonText: { color: "#fff", fontWeight: "600" },
    submitButton: { backgroundColor: "#16a34a", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 12 },
    submitText: { color: "#fff", fontWeight: "700" },
});
