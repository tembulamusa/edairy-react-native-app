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
// @ts-ignore - react-native-sqlite-storage doesn't have types
import SQLite from 'react-native-sqlite-storage';
import BluetoothConnectionModal from '../../components/modals/BluetoothConnectionModal';
import useBluetoothService from "../../hooks/useBluetoothService";
import { isBleAdapterReady } from "../../utils/sharedBleManager";

// Use require for hooks to avoid import issues
// const useBLEService = require("../../hooks/useBLEService").default;
const useClassicService = require("../../hooks/useClassicService").default;

// SQLite database for persistent scale storage
let scaleDatabase: SQLite.SQLiteDatabase | null = null;

const initScaleDatabase = async (): Promise<void> => {
    try {
        scaleDatabase = await SQLite.openDatabase(
            { name: 'scale_devices.db', location: 'default' },
            () => console.log('[SQLite] Scale database opened'),
            (error) => console.error('[SQLite] Error opening database:', error)
        );
        if (scaleDatabase) {
            await scaleDatabase.executeSql(
                `CREATE TABLE IF NOT EXISTS last_scale_device (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT NOT NULL,
                    device_name TEXT,
                    device_address TEXT,
                    connection_type TEXT NOT NULL,
                    last_connected DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                [],
                () => console.log('[SQLite] Scale devices table created/verified'),
                (error) => console.error('[SQLite] Error creating table:', error)
            );
        }
    } catch (error) {
        console.error('[SQLite] Error initializing database:', error);
    }
};

const saveLastScaleDevice = async (device: any): Promise<void> => {
    if (!scaleDatabase || !device) return;

    try {
        const deviceId = device.id || device.address || device.address_or_id;
        const deviceName = device.name || 'Unknown Device';
        const deviceAddress = device.address || deviceId;
        const connectionType = device.type || 'ble';

        // First, clear any existing entries
        await scaleDatabase.executeSql(
            'DELETE FROM last_scale_device',
            [],
            () => console.log('[SQLite] Cleared existing scale devices'),
            (error) => console.error('[SQLite] Error clearing devices:', error)
        );

        // Then insert the new device
        await scaleDatabase.executeSql(
            'INSERT INTO last_scale_device (device_id, device_name, device_address, connection_type, last_connected) VALUES (?, ?, ?, ?, datetime("now"))',
            [deviceId, deviceName, deviceAddress, connectionType],
            () => console.log('[SQLite] Scale device saved:', deviceName),
            (error) => console.error('[SQLite] Error saving device:', error)
        );
    } catch (error) {
        console.error('[SQLite] Error saving scale device:', error);
    }
};

const getLastScaleDevice = async (): Promise<any | null> => {
    if (!scaleDatabase) return null;

    return new Promise((resolve) => {
        try {
            scaleDatabase!.executeSql(
                'SELECT * FROM last_scale_device ORDER BY last_connected DESC LIMIT 1',
                [],
                (results) => {
                    try {
                        // Guard against unexpected result shapes
                        if (!Array.isArray(results) || results.length === 0) {
                            console.log('[SQLite] No result sets returned for last_scale_device query');
                            resolve(null);
                            return;
                        }

                        const firstResult = results[0];
                        if (!firstResult || !firstResult.rows || firstResult.rows.length === 0) {
                            console.log('[SQLite] No saved scale device found');
                            resolve(null);
                            return;
                        }

                        const device = firstResult.rows.item(0);
                        console.log('[SQLite] Retrieved last scale device:', device?.device_name);
                        resolve(device);
                    } catch (callbackErr) {
                        console.error('[SQLite] Error processing last_scale_device results:', callbackErr);
                        resolve(null);
                    }
                },
                (error) => {
                    console.error('[SQLite] Error retrieving scale device:', error);
                    resolve(null);
                }
            );
        } catch (outerErr) {
            console.error('[SQLite] Error executing last_scale_device query:', outerErr);
            resolve(null);
        }
    });
};

const clearLastScaleDevice = async (): Promise<void> => {
    if (!scaleDatabase) return;

    try {
        await scaleDatabase.executeSql(
            'DELETE FROM last_scale_device',
            [],
            () => console.log('[SQLite] Cleared last scale device'),
            (error) => console.error('[SQLite] Error clearing device:', error)
        );
    } catch (error) {
        console.error('[SQLite] Error clearing scale device:', error);
    }
};

// Show location permission prompt only once per session; after that allow user to proceed (scan will run)
let hasShownLocationPermissionForScale = false;

const checkBluetoothSetup = async () => {
    const { PermissionsAndroid, Platform, Alert } = require("react-native");

    if (Platform.OS !== 'android') return true;

    try {
        console.log('[SETUP] Checking Bluetooth setup...');

        const locationGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (!locationGranted) {
            if (hasShownLocationPermissionForScale) {
                // Already asked once; let user proceed (scan may still work or show no devices)
                return true;
            }
            hasShownLocationPermissionForScale = true;
            Alert.alert(
                'Location Permission Required',
                'Bluetooth device scanning requires location permission. This is used only for finding nearby Bluetooth devices and is not used for GPS tracking.',
                [
                    {
                        text: 'Grant Permission',
                        onPress: async () => {
                            try {
                                const result = await PermissionsAndroid.request(
                                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                                );
                                if (result === PermissionsAndroid.RESULTS.GRANTED) {
                                    console.log('[SETUP] Location permission granted');
                                } else {
                                    console.log('[SETUP] Location permission denied');
                                }
                            } catch (e) {
                                console.error('[SETUP] Error requesting location permission:', e);
                            }
                        }
                    },
                    { text: 'Cancel', style: 'cancel', onPress: () => { } }
                ]
            );
            return false;
        }

        console.log('[SETUP] Bluetooth setup check passed');
        return true;
    } catch (error) {
        console.error('[SETUP] Bluetooth setup check failed:', error);
        return false;
    }
};
import AsyncStorage from "@react-native-async-storage/async-storage";
import fetchCommonData, { clearSpecificCommonDataCache } from "../../components/utils/fetchCommonData.ts";
import makeRequest from "../../components/utils/makeRequest.ts";
import useCan from "../../hooks/useCan";
import { can as checkPermission } from "../../utils/permissions";
import { getTransporterDisplayName } from "../../utils/transporter";
import { getRouteDisplayName, getRouteCenterDisplayName } from "../../utils/route";
import { getMeasuringCan, saveMeasuringCan } from "../../services/offlineDatabase";
import {
    buildMemberKilosJournalPayload,
    buildJournalCode,
    buildBatchNo,
    formatJournalDate,
} from "../../utils/memberKilosJournalPayload";
import {
    buildMemberKilosReceipts,
    getPendingReceiptsStorageKey,
    logMilkJournalPost,
} from "../../utils/memberKilosJournalReceipts";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all.tsx";
import CashoutFormModal from "../../components/modals/CashoutFormModal.tsx";
import SuccessModal from "../../components/modals/SuccessModal.tsx";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { globalStyles } from "../../styles.ts";

// At the top of the file (best effort if multiple import blocks)
declare module 'react-native-vector-icons/MaterialIcons';

const PERM_MILK_JOURNALS_VIEW = "milk-journals.view";
const PERM_MILK_JOURNALS_CREATE = "milk-journals.create";

/** Higher zIndex at top; higher zIndexInverse toward bottom (react-native-dropdown-picker stacking). */
const DROPDOWN_STACK = {
    transporter: { zIndex: 8000, zIndexInverse: 1000 },
    shift: { zIndex: 7500, zIndexInverse: 1500 },
    route: { zIndex: 7000, zIndexInverse: 2000 },
    center: { zIndex: 6500, zIndexInverse: 2500 },
    can: { zIndex: 6000, zIndexInverse: 3000 },
    measuringCan: { zIndex: 5500, zIndexInverse: 3500 },
    member: { zIndex: 5000, zIndexInverse: 4000 },
    viewMember: { zIndex: 3000, zIndexInverse: 1000 },
} as const;

const getDropdownColStyle = (zIndex: number) => ({
    zIndex,
    elevation: zIndex / 1000,
});

const getMilkCanLabel = (can: any) =>
    can?.can_id || can?.name || `Can ${can?.id ?? ""}`;

const toMilkCanDropdownItems = (cans: any[]) =>
    (cans || []).map((c: any) => ({
        label: getMilkCanLabel(c),
        value: c.id,
    }));

const getMemberNumber = (member: any): string =>
    member?.member_no || member?.membership_no || member?.membershipNo || "";

const toMemberDropdownItems = (members: any[]) =>
    (members || []).map((m: any) => {
        const memberNo = getMemberNumber(m);
        const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim();
        return {
            label: memberNo ? `${name} (${memberNo})` : name,
            value: m.id,
        };
    });

const filterMemberDropdownItems = (
    items: { label: string; value: number }[],
    members: any[],
    searchText: string
) => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
        return items;
    }

    return items.filter((item) => {
        const member = members.find((m: any) => m.id === item.value);
        if (!member) {
            return item.label.toLowerCase().includes(normalized);
        }

        const memberNo = getMemberNumber(member).toLowerCase();
        const firstName = String(member.first_name ?? "").toLowerCase();
        const lastName = String(member.last_name ?? "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();

        return (
            item.label.toLowerCase().includes(normalized) ||
            memberNo.includes(normalized) ||
            firstName.includes(normalized) ||
            lastName.includes(normalized) ||
            fullName.includes(normalized)
        );
    });
};

const autoSelectRouteForTransporter = (
    selectedTransporter: any,
    routes: any[],
    setRouteValue: (value: number) => void,
    setRoute: (route: any) => void
) => {
    if (!selectedTransporter?.route_id || !routes?.length) {
        return;
    }

    const matchingRoute = routes.find((route: any) => route.id === selectedTransporter.route_id);
    if (matchingRoute) {
        setRouteValue(matchingRoute.id);
        setRoute(matchingRoute);
    }
};

const getMeasuringCanTare = (can: any): number => {
    const value = can?.weight;
    if (value === null || value === undefined || value === "") {
        return 0;
    }
    const parsed = parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
};

const extractApiErrorMessage = (response: any, status?: number): string => {
    if (typeof response === "string" && response.trim()) {
        return response.trim();
    }

    if (response && typeof response === "object") {
        const message =
            response.message ||
            response.error ||
            response.data?.message ||
            response.data?.error;

        if (typeof message === "string" && message.trim()) {
            return message.trim();
        }
    }

    if (status) {
        return `Failed to send kilos (status ${status}).`;
    }

    return "Failed to send kilos.";
};

const MemberKilosScreen = () => {
    // --- Toggle state ---
    const navigation = useNavigation();
    const [viewMode, setViewMode] = useState(true); // true = View Kilos, false = Record Kilos
    const canViewKilos = useCan(PERM_MILK_JOURNALS_VIEW);
    const canCreateKilos = useCan(PERM_MILK_JOURNALS_CREATE);
    const canToggleKilos = canViewKilos && canCreateKilos;
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
    const [memberTotals, setMemberTotals] = useState<any>(null);
    const [fetchingMemberTotals, setFetchingMemberTotals] = useState(false);
    const [errors, setErrors] = useState<any>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState<any[]>([]); // initialize as empty
    const [allMemberItems, setAllMemberItems] = useState<any[]>([]);
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
    const [journalCode, setJournalCode] = useState("");
    const [batchNo, setBatchNo] = useState("");

    // --- Dropdown open states ---
    const [transporterOpen, setTransporterOpen] = useState(false);
    const [shiftOpen, setShiftOpen] = useState(false);
    const [routeOpen, setRouteOpen] = useState(false);
    const [centerOpen, setCenterOpen] = useState(false);
    const [memberOpen, setMemberOpen] = useState(false);
    const [canOpen, setCanOpen] = useState(false);

    const [measuringCanValue, setMeasuringCanValue] = useState<number | null>(null);
    const [measuringCan, setMeasuringCan] = useState<any | null>(null);
    const [measuringCanOpen, setMeasuringCanOpen] = useState(false);

    const [scaleModalVisible, setScaleModalVisible] = useState(false);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // --- Scale connection type state ---
    const [scaleConnectionType, setScaleConnectionType] = useState<string>("ble"); // Default to BLE
    const [scaleSettingsLoaded, setScaleSettingsLoaded] = useState<boolean>(false);

    // --- Continuous reconnection state ---
    const [isContinuousReconnecting, setIsContinuousReconnecting] = useState<boolean>(false);
    const reconnectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastReconnectionAttempt = useRef<number>(0);

    // --- Load scale connection type from settings ---
    const loadScaleSettings = useCallback(async () => {
        try {
            const storedPrefs = await AsyncStorage.getItem("@edairyApp:user_preferences");
            if (storedPrefs) {
                const parsed = JSON.parse(storedPrefs);
                const savedType = parsed.scale_connection_type || "ble";
                console.log("[MemberKilos] Loaded scale connection type from settings:", savedType);
                setScaleConnectionType(savedType);
            } else {
                console.log("[MemberKilos] No saved preferences found, using default BLE");
            }
        } catch (error) {
            console.error("[MemberKilos] Failed to load scale settings:", error);
            // Keep default BLE
        } finally {
            setScaleSettingsLoaded(true);
        }
    }, []);

    // Initialize SQLite database for scale storage
    useEffect(() => {
        initScaleDatabase();
    }, []);

    useEffect(() => {
        loadScaleSettings();
    }, [loadScaleSettings]);

    // Reload settings when screen comes into focus (in case user changed settings)
    useFocusEffect(
        useCallback(() => {
            loadScaleSettings();
        }, [loadScaleSettings])
    );

    // Auto-select route when transporter changes
    useEffect(() => {
        if (transporter && commonData.routes && commonData.routes.length > 0) {
            console.log(`[MemberKilos] 🔄 Transporter changed to: ${getTransporterDisplayName(transporter)}, checking route_id: ${transporter.route_id}`);

            if (transporter.route_id) {
                const matchingRoute = commonData.routes.find((r: any) => r.id === transporter.route_id);
                if (matchingRoute) {
                    // Only update if the route is different from currently selected
                    if (routeValue !== matchingRoute.id) {
                        console.log(`[MemberKilos] ✅ Auto-selecting route: ${getRouteDisplayName(matchingRoute)} for transporter: ${getTransporterDisplayName(transporter)}`);
                        setRouteValue(matchingRoute.id);
                        setRoute(matchingRoute);
                    } else {
                        console.log(`[MemberKilos] ℹ️ Route already selected: ${getRouteDisplayName(matchingRoute)}`);
                    }
                } else {
                    console.log(`[MemberKilos] ⚠️ Transporter ${getTransporterDisplayName(transporter)} has route_id ${transporter.route_id} but route not found`);
                }
            } else {
                console.log(`[MemberKilos] ℹ️ Transporter ${getTransporterDisplayName(transporter)} has no route_id`);
            }
        }
    }, [transporter, commonData.routes, routeValue]);

    // --- Scale hook ---
    const scaleHook = useBluetoothService({ deviceType: "scale" });

    // Log when connection type changes
    useEffect(() => {
        if (scaleSettingsLoaded) {
            console.log(`[MemberKilos] Scale connection type setting: ${scaleConnectionType}`);
            console.log(`[MemberKilos] Using: useBluetoothService (Unified BLE/Classic)`);
        }
    }, [scaleConnectionType, scaleSettingsLoaded]);

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
    } = scaleHook || {};

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

    const printerDevicesRef = useRef<any[]>(printerDevices || []);
    const isMountedRef = useRef(true);
    const hasShownConnectionFailedRef = useRef(false);
    const hasAutoScaleInitRunRef = useRef(false);
    const hasAutoShownScaleModalRef = useRef(false);
      useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    useEffect(() => {
        printerDevicesRef.current = printerDevices || [];
    }, [printerDevices]);

    // Update scale weight when data is received from connected device
    // lastMessage is already weight in kgs (0.01 precision) from useBluetoothService
    useEffect(() => {
        // console.log(`[MEMBER KILOS] ⚖️ WEIGHT UPDATE EFFECT TRIGGERED`);
        // console.log(`[MEMBER KILOS] ⚖️ lastMessage value:`, lastMessage);
        // console.log(`[MEMBER KILOS] ⚖️ connectedScaleDevice:`, !!connectedScaleDevice);

        try {
            if (lastMessage !== null && lastMessage !== undefined && connectedScaleDevice) {
                // console.log(`[MEMBER KILOS] 📥 WEIGHT RECEIVED FROM SCALE: "${lastMessage}"`);

                // lastMessage is already weight in kgs, just parse and use it
                const weight = parseFloat(lastMessage);
                // console.log(`[MEMBER KILOS] 🔄 PARSED WEIGHT VALUE: ${weight}`);

                if (!isNaN(weight) && isFinite(weight) && weight >= 0 && weight <= 1000) {
                    // console.log(`[MEMBER KILOS] ✅ SETTING scaleWeight TO: ${weight}`);
                    setScaleWeight(weight);
                    // Clear manual text input when scale is connected
                    setScaleWeightText("");
                    // console.log(`[MEMBER KILOS] ✅ scaleWeight UPDATED SUCCESSFULLY - SHOULD SEE WEIGHT IN UI`);
                } else {
                    // console.warn(`[MEMBER KILOS] ❌ INVALID WEIGHT RECEIVED: "${lastMessage}" (parsed as: ${weight})`);
                    // Don't update scaleWeight for invalid values
                }
            } else if (!connectedScaleDevice) {
                // console.log(`[MEMBER KILOS] ⚠️ SCALE DISCONNECTED - CLEARING WEIGHT`);
                // Scale disconnected, clear weight
                setScaleWeight(null);
            } else {
                console.log(`[MEMBER KILOS] ⏳ WAITING FOR WEIGHT DATA FROM SCALE...`);
            }
        } catch (error) {
            console.error('[MEMBER KILOS] ❌ ERROR PROCESSING SCALE WEIGHT:', error);
            setScaleWeight(null);
        }
    }, [lastMessage, connectedScaleDevice]);

    // Clear scaleWeightText when scale connects to allow fresh input
    useEffect(() => {
        if (connectedScaleDevice) {
            setScaleWeightText("");
        }
    }, [connectedScaleDevice]);

    // Single automatic scale reconnection attempt with SQLite storage
    // After the first failed automatic attempt, we don't keep retrying;
    // user can manually select a scale from the modal.
    const startContinuousReconnection = useCallback(async () => {
        if (isContinuousReconnecting || !isMountedRef.current) return;

        console.log('[MemberKilos] Starting automatic scale reconnection (single attempt)...');
        setIsContinuousReconnecting(true);

        const attemptReconnection = async () => {
            if (!isMountedRef.current) return;

            const bleReady = await isBleAdapterReady();
            if (!bleReady) {
                console.log('[MemberKilos] CONTINUOUS RECONNECT: Bluetooth is off, skipping');
                return;
            }

            try {
                // Skip if already connected
                if (connectedScaleDevice && scaleHook) {
                    try {
                        let stillConnected = false;
                        if (connectedScaleDevice.type === 'ble' && connectedScaleDevice.bleDevice) {
                            stillConnected = (connectedScaleDevice.bleDevice as any).isConnected === true;
                        } else if (connectedScaleDevice.type === 'classic' && connectedScaleDevice.classicDevice) {
                            stillConnected = await connectedScaleDevice.classicDevice.isConnected();
                        }
                        if (stillConnected) {
                            console.log('[MemberKilos] CONTINUOUS RECONNECT: Already connected, stopping reconnection');
                            stopContinuousReconnection();
                            return;
                        }
                    } catch (error) {
                        console.log('[MemberKilos] CONTINUOUS RECONNECT: Error checking connection:', error);
                    }
                }

                // Get last scale from SQLite
                const lastScale = await getLastScaleDevice();
                if (!lastScale) {
                    console.log('[MemberKilos] CONTINUOUS RECONNECT: No saved scale device found');
                    // Show connection modal to let user select a device, but only once automatically
                    if (!hasAutoShownScaleModalRef.current) {
                        hasAutoShownScaleModalRef.current = true;
                        setTimeout(() => {
                            if (isMountedRef.current && !connectedScaleDevice) {
                                console.log('[MemberKilos] CONTINUOUS RECONNECT: Showing connection modal');
                                setScaleModalVisible(true);
                            }
                        }, 1000);
                    }
                    return;
                }

                const deviceId = lastScale.device_id;
                if (!deviceId) {
                    console.log('[MemberKilos] CONTINUOUS RECONNECT: No valid device ID found');
                    return;
                }

                console.log(`[MemberKilos] CONTINUOUS RECONNECT: Attempting to connect to ${lastScale.device_name}...`);

                // Prevent too frequent attempts
                const now = Date.now();
                if (now - lastReconnectionAttempt.current < 30000) { // 30 seconds minimum between attempts
                    return;
                }
                lastReconnectionAttempt.current = now;

                try {
                    if (scanForScaleDevices) {
                        scanForScaleDevices();
                    }

                    // Wait for scan to complete
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    if (connectToScaleDevice && isMountedRef.current) {
                        const result = await connectToScaleDevice(deviceId);
                        if (result) {
                            console.log('[MemberKilos] CONTINUOUS RECONNECT: ✓ Successfully reconnected!');
                            // The device should already be saved, but let's ensure it
                            const deviceInfo = {
                                id: lastScale.device_id,
                                name: lastScale.device_name,
                                address: lastScale.device_address,
                                type: lastScale.connection_type
                            };
                            await persistLastScale(deviceInfo);
                            stopContinuousReconnection();
                        }
                    }
                } catch (connectError: any) {
                    console.log('[MemberKilos] CONTINUOUS RECONNECT: Connection attempt failed:', connectError?.message ?? connectError?.reason ?? connectError);
                    // Continue trying - don't clear the device from storage
                }
            } catch (error: any) {
                console.error('[MemberKilos] CONTINUOUS RECONNECT: Error during reconnection attempt:', error?.message ?? error);
            }
        };

        // Perform a single automatic attempt, then stop
        await attemptReconnection();
        setIsContinuousReconnecting(false);

    }, [connectedScaleDevice, scaleHook, scanForScaleDevices, connectToScaleDevice, isContinuousReconnecting]);

    const stopContinuousReconnection = useCallback(() => {
        console.log('[MemberKilos] Stopping continuous reconnection');
        setIsContinuousReconnecting(false);
        if (reconnectionIntervalRef.current) {
            clearInterval(reconnectionIntervalRef.current);
            reconnectionIntervalRef.current = null;
        }
    }, []);

    // Auto-connect on app load and start continuous reconnection
    useEffect(() => {
        if (!scaleSettingsLoaded || !isMountedRef.current) return;

        const initializeScaleConnection = async () => {
            try {
                const bleReady = await isBleAdapterReady();
                if (!bleReady) {
                    console.log('[MemberKilos] INITIALIZING: Bluetooth is off, skipping auto scale connect');
                    return;
                }

                // First, try to connect to the last saved device
                const lastScale = await getLastScaleDevice();
                if (lastScale) {
                    console.log(`[MemberKilos] INITIALIZING: Found saved device ${lastScale.device_name}, attempting connection...`);

                    const deviceId = lastScale.device_id;
                    if (deviceId && connectToScaleDevice && scanForScaleDevices) {
                        try {
                            // Quick scan and connect attempt
                            scanForScaleDevices();
                            await new Promise(resolve => setTimeout(resolve, 2000));

                            if (isMountedRef.current) {
                                const result = await connectToScaleDevice(deviceId);
                                if (result) {
                                    console.log('[MemberKilos] INITIALIZING: ✓ Successfully connected to saved device');
                                    // Ensure the device is saved (should already be, but be safe)
                                    const deviceInfo = {
                                        id: lastScale.device_id,
                                        name: lastScale.device_name,
                                        address: lastScale.device_address,
                                        type: lastScale.connection_type
                                    };
                                    await persistLastScale(deviceInfo);
                                    return;
                                }
                            }
                        } catch (error: any) {
                            console.log('[MemberKilos] INITIALIZING: Failed to connect to saved device:', error?.message ?? error?.reason ?? error);
                        }
                    }
                }

                // If no saved device or connection failed, start a single automatic reconnection attempt
                console.log('[MemberKilos] INITIALIZING: Starting automatic reconnection (single attempt)');
                startContinuousReconnection();

            } catch (error: any) {
                console.error('[MemberKilos] INITIALIZING: Error during initialization:', error?.message ?? error);
                startContinuousReconnection();
            }
        };

        // Only run automatic initialization once per mount
        if (hasAutoScaleInitRunRef.current) {
            return;
        }
        hasAutoScaleInitRunRef.current = true;

        // Delay initialization to allow hooks to be ready
        const initTimeout = setTimeout(initializeScaleConnection, 1000);

        return () => clearTimeout(initTimeout);
    }, [scaleSettingsLoaded, connectToScaleDevice, scanForScaleDevices, startContinuousReconnection]);

    // Cleanup continuous reconnection on unmount
    useEffect(() => {
        return () => {
            stopContinuousReconnection();
        };
    }, [stopContinuousReconnection]);

    // Helper: Persist scale to SQLite database
    const persistSelectedMilkCan = useCallback(async (selected: any) => {
        if (!selected?.id) {
            return;
        }

        try {
            const userDataString = await AsyncStorage.getItem("user");
            const userData = userDataString ? JSON.parse(userDataString) : null;
            const userId = userData?.member_id ?? userData?.user_id;

            await saveMeasuringCan({
                user_id: userId,
                measuring_can_id: selected.id,
                measuring_can_name: getMilkCanLabel(selected),
                measuring_can_tare_weight: getMeasuringCanTare(selected),
            });
            console.log(`[MemberKilos] Saved selected can: ${getMilkCanLabel(selected)}`);
        } catch (error) {
            console.error("[MemberKilos] Failed to save selected can:", error);
        }
    }, []);

    const applyMeasuringCanSelection = useCallback((selected: any) => {
        if (!selected) {
            return;
        }
        setMeasuringCanValue(selected.id);
        setMeasuringCan(selected);
    }, []);

    const persistLastScale = useCallback(async (device: any) => {
        if (!device) return;
        try {
            console.log("[MemberKilos] persistLastScale: Saving scale device", device.name || device.id);
            await saveLastScaleDevice(device);
            console.log("[MemberKilos] persistLastScale: ✓ Scale device saved successfully");
        } catch (error) {
            console.error("[MemberKilos] persistLastScale: Failed to save scale", error);
        }
    }, []);

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

        const bleReady = await isBleAdapterReady();
        if (!bleReady) {
            console.log('[MemberKilos] AUTO-CONNECT PRINTER: Bluetooth is off, skipping');
            return false;
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

    // Show connection-failed alert only once, then let user proceed
    useEffect(() => {
        if (!scaleHook) return;
        if (!scaleHook.connectionFailed || !scaleHook.lastConnectionAttempt) return;
        if (hasShownConnectionFailedRef.current) return;
        hasShownConnectionFailedRef.current = true;
        try {
            Alert.alert(
                "Connection Failed",
                "Failed to connect to the last used scale device. Please check if the device is powered on and try connecting manually.",
                [{ text: "OK", style: "default" }]
            );
        } catch (alertErr) {
            console.warn("[MemberKilos] Connection failed alert error (ignored):", alertErr);
        }
    }, [scaleHook?.connectionFailed, scaleHook?.lastConnectionAttempt]);

    const [isCashoutModalVisible, setIsCashoutModalVisible] = useState(false);
    const [selectedMember, setSelectedMember] = useState<any | null>(null);

    // --- Load Common Data + Auto-select member if needed ---
    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const memberFetchOptions = {
                    cachable: false as const,
                    direct: true,
                    logContext: "MemberKilos",
                };

                await Promise.all([
                    clearSpecificCommonDataCache("cans"),
                    clearSpecificCommonDataCache("milk-delivery-cans"),
                    clearSpecificCommonDataCache("milk-cans"),
                    clearSpecificCommonDataCache("measuring_cans"),
                    clearSpecificCommonDataCache("route-centers"),
                    clearSpecificCommonDataCache("centers"),
                ]);

                console.log("[MemberKilos] Fetching members from endpoint: members");

                const [transporters, routes, shifts, members, cans] =
                    await Promise.all([
                        fetchCommonData({ name: "transporters", ...memberFetchOptions }),
                        fetchCommonData({ name: "routes", direct: true, cachable: false, logContext: "MemberKilos" }),
                        fetchCommonData({ name: "milk-delivery-shifts", direct: true, cachable: false, logContext: "MemberKilos" }),
                        fetchCommonData({ name: "members", ...memberFetchOptions }),
                        fetchCommonData({ name: "milk-cans", ...memberFetchOptions }),
                    ]);

                console.log("[MemberKilos] Members loaded:", {
                    count: Array.isArray(members) ? members.length : 0,
                    sample: Array.isArray(members) ? members.slice(0, 3).map((m: any) => ({
                        id: m.id,
                        name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
                    })) : members,
                });
                const allData = { transporters, routes, shifts, members, cans, route_centers: [] };
                setCommonData(allData);
                // populate dropdown items
                setTransporterItems((transporters || []).map((t: any) => ({
                    label: getTransporterDisplayName(t),
                    value: t.id,
                })));
                setShiftItems((shifts || []).map((s: any) => ({ label: s.name, value: s.id })));
                setRouteItems((routes || []).map((r: any) => ({
                    label: getRouteDisplayName(r),
                    value: r.id,
                })));
                const memberDropdownItems = toMemberDropdownItems(members);
                setAllMemberItems(memberDropdownItems);
                setMemberItems(memberDropdownItems);
                setCanItems(toMilkCanDropdownItems(cans));
                setMeasuringCanItems(toMilkCanDropdownItems(cans));

                try {
                    const userDataString = await AsyncStorage.getItem("user");
                    const userData = userDataString ? JSON.parse(userDataString) : null;
                    const userId = userData?.member_id ?? userData?.user_id;
                    const savedCan = await getMeasuringCan(userId);

                    if (savedCan && Array.isArray(cans)) {
                        const matchedCan = cans.find((c: any) => c.id === savedCan.id);
                        if (matchedCan) {
                            applyMeasuringCanSelection(matchedCan);
                            console.log(
                                `[MemberKilos] Restored saved measuring can: ${getMilkCanLabel(matchedCan)}`
                            );
                        }
                    }
                } catch (restoreError) {
                    console.warn("[MemberKilos] Failed to restore saved measuring can:", restoreError);
                }
                setCenterItems([]);

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
                    const hasViewKilos = await checkPermission(PERM_MILK_JOURNALS_VIEW);
                    const hasCreateKilos = await checkPermission(PERM_MILK_JOURNALS_CREATE);

                    if (hasViewKilos && !hasCreateKilos) {
                        setViewMode(true);
                        const matched = (members || []).find((m: any) => m.id === userData?.member_id);
                        if (matched) {
                            setMemberValue(matched?.id);
                            setSelectedMember(matched);
                        }
                    }

                    // Auto-select transporter if user is in transporter group
                    if (userGroups.includes("transporter") && userData?.member_id) {
                        const matchedTransporter = (transporters || []).find((t: any) => t.member_id === userData.member_id);
                        if (matchedTransporter) {
                            setTransporterValue(matchedTransporter.id);
                            setTransporter(matchedTransporter);
                            console.log(`[MemberKilos] ✅ Auto-selected transporter: ${getTransporterDisplayName(matchedTransporter)} (ID: ${matchedTransporter.id})`);

                            autoSelectRouteForTransporter(
                                matchedTransporter,
                                routes || [],
                                setRouteValue,
                                setRoute
                            );

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

                if ((transporters || []).length === 1) {
                    const onlyTransporter = transporters[0];
                    setTransporterValue(onlyTransporter.id);
                    setTransporter(onlyTransporter);
                    autoSelectRouteForTransporter(
                        onlyTransporter,
                        routes || [],
                        setRouteValue,
                        setRoute
                    );
                    console.log(
                        `[MemberKilos] ✅ Auto-selected only transporter: ${getTransporterDisplayName(onlyTransporter)}`
                    );
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

    // --- Fetch Member Totals (pending entries) ---
    const fetchMemberTotals = useCallback(async () => {
        if (!memberValue) {
            setMemberTotals(null);
            return;
        }
        setFetchingMemberTotals(true);
        try {
            const allEntries = await fetchCommonData({
                name: "customer_delivery_summary",
                cachable: false,
                direct: true,
                logContext: "MemberKilos",
            });

            const pendingEntries = Array.isArray(allEntries)
                ? allEntries.filter(
                      (entry: any) =>
                          entry.member_id === memberValue &&
                          String(entry.status ?? "pending").toLowerCase() === "pending"
                  )
                : [];

            // Sum quantity from pending journal entries
            let totalQuantity = 0;
            if (pendingEntries.length > 0) {
                totalQuantity = pendingEntries.reduce((sum: number, entry: any) => {
                    const quantity = parseFloat(entry.quantity || entry.net || entry.total_quantity || 0) || 0;
                    return sum + quantity;
                }, 0);
            }

            setMemberTotals(totalQuantity);
        } catch (err) {
            console.error('[MemberKilos] Error fetching member totals:', err);
            setMemberTotals(null);
        } finally {
            setFetchingMemberTotals(false);
        }
    }, [memberValue]);

    useEffect(() => {
        fetchMemberTotals();
    }, [fetchMemberTotals]);

    // Keep selected can details fully loaded
    useEffect(() => {
        if (canValue && Array.isArray(commonData.cans)) {
            const found = commonData.cans.find((c: any) => c.id === canValue);
            if (found) setCan(found);
        }
    }, [canValue, commonData.cans]);

    useEffect(() => {
        if (routeValue && Array.isArray(commonData.routes)) {
            const found = commonData.routes.find((r: any) => r.id === routeValue);
            if (found) {
                setRoute(found);
            }
        }
    }, [routeValue, commonData.routes]);

    useEffect(() => {
        if (transporter) {
            setJournalCode(buildJournalCode(transporter, formatJournalDate()));
            return;
        }

        setJournalCode("");
    }, [transporter]);

    useEffect(() => {
        const selectedRoute =
            route ??
            (routeValue && Array.isArray(commonData.routes)
                ? commonData.routes.find((r: any) => r.id === routeValue)
                : null);

        if (selectedRoute) {
            setBatchNo(buildBatchNo(selectedRoute, 1));
            return;
        }

        setBatchNo("");
    }, [route, routeValue, commonData.routes]);

    // Keep selected can details fully loaded
    useEffect(() => {
        if (memberValue && Array.isArray(commonData.members)) {
            const found = commonData.members.find((m: any) => m.id === memberValue);
            if (found) {
                setMember(found);
                setSelectedMember(found || null);
            }
        }
    }, [memberValue, commonData.members]);

    const hasEntryForMemberAndCan = useCallback(
        (memberId: number | null | undefined, canId: number | null | undefined) => {
            if (memberId == null || canId == null) {
                return false;
            }

            return entries.some(
                (entry) => entry.member_id === memberId && entry.can_id === canId
            );
        },
        [entries]
    );

    const resetMemberDropdownItems = useCallback(() => {
        setMemberItems(allMemberItems);
    }, [allMemberItems]);

    const handleMemberSearch = useCallback(
        (searchText: string) => {
            setMemberItems(
                filterMemberDropdownItems(
                    allMemberItems,
                    commonData.members || [],
                    searchText
                )
            );
        },
        [allMemberItems, commonData.members]
    );

    const handleTransporterSelect = useCallback(
        (val: number | null) => {
            if (val == null) {
                return;
            }

            setTransporterValue(val);
            const selectedTransporter = (commonData.transporters || []).find(
                (transporter: any) => transporter.id === val
            );
            if (!selectedTransporter) {
                return;
            }

            setTransporter(selectedTransporter);
            autoSelectRouteForTransporter(
                selectedTransporter,
                commonData.routes || [],
                setRouteValue,
                setRoute
            );
        },
        [commonData.transporters, commonData.routes]
    );

    const closeOtherDropdowns = useCallback((current: string) => {
        if (current !== "transporter") setTransporterOpen(false);
        if (current !== "shift") setShiftOpen(false);
        if (current !== "route") setRouteOpen(false);
        if (current !== "center") setCenterOpen(false);
        if (current !== "measuringCan") setMeasuringCanOpen(false);
        if (current !== "can") setCanOpen(false);
        if (current !== "member") setMemberOpen(false);
    }, []);

    useEffect(() => {
        if (memberValue == null || canValue == null) {
            return;
        }

        if (hasEntryForMemberAndCan(memberValue, canValue)) {
            setCanValue(null);
            setCan(null);
        }
    }, [memberValue, canValue, hasEntryForMemberAndCan]);

    // Fetch route centers when route is selected
    useEffect(() => {
        const fetchRouteCenters = async () => {
            if (routeValue == null || routeValue === "") {
                setCommonData((prev: any) => ({ ...prev, route_centers: [] }));
                setCenterItems([]);
                setCenterValue(null);
                setCenter(null);
                return;
            }

            try {
                setCenterValue(null);
                setCenter(null);

                await Promise.all([
                    clearSpecificCommonDataCache("route-centers"),
                    clearSpecificCommonDataCache("centers"),
                ]);

                console.log(`[MemberKilos] Fetching route centers for route_id: ${routeValue}`);
                const routeCenters = await fetchCommonData({
                    name: "route-centers",
                    cachable: false,
                    direct: true,
                    params: { route_id: routeValue },
                    logContext: "MemberKilos",
                });

                const centers = Array.isArray(routeCenters) ? routeCenters : [];

                setCommonData((prev: any) => ({
                    ...prev,
                    route_centers: centers,
                }));

                const items = centers.map((c: any) => ({
                    label: getRouteCenterDisplayName(c),
                    value: c.id,
                }));
                setCenterItems(items);

                if (centers.length > 0) {
                    const firstCenter = centers[0];
                    setCenterValue(firstCenter.id);
                    setCenter({
                        id: firstCenter.id,
                        center: getRouteCenterDisplayName(firstCenter),
                    });
                    console.log(
                        `[MemberKilos] ✅ Auto-selected route center: ${getRouteCenterDisplayName(firstCenter)} (ID: ${firstCenter.id}) for route_id: ${routeValue}`
                    );
                }
            } catch (error: any) {
                console.error("[MemberKilos] Error fetching route centers:", error);
                Alert.alert("Error", `Failed to load route centers: ${error.message || "Unknown error"}`);
                setCommonData((prev: any) => ({ ...prev, route_centers: [] }));
                setCenterItems([]);
            }
        };

        fetchRouteCenters();
    }, [routeValue]);

    useEffect(() => {
        if (measuringCanValue && Array.isArray(commonData?.cans)) {
            const found = (commonData?.cans || []).find((c: any) => c.id === measuringCanValue);
            if (found) {
                setMeasuringCan(found);
                console.log(`[MemberKilos] Measuring can loaded:`, found);
                console.log(`[MemberKilos] Measuring can tare (weight):`, getMeasuringCanTare(found));
            } else {
                console.log(`[MemberKilos] Measuring can not found for ID: ${measuringCanValue}`);
                console.log(`[MemberKilos] Available milk cans:`, commonData?.cans);
            }
        } else if (!measuringCanValue) {
            setMeasuringCan(null);
        }
    }, [measuringCanValue, commonData?.cans]);


    // --- takeWeight: push current scale weight into entries and update totals ---
    const takeWeight = () => {
        try {
            // Validate scale weight
            if (scaleWeight === null || scaleWeight === undefined || !isFinite(scaleWeight) || scaleWeight < 0) {
                Alert.alert("No weight", "No valid weight available to record. Please ensure the scale is connected and displaying a valid weight.");
                return;
            }

            // Validate measuring can and tare weight
            if (!measuringCan) {
                Alert.alert("Missing Measuring Can", "Select a measuring can before recording.");
                return;
            }

            const tare = getMeasuringCanTare(measuringCan);

            if (!can || !canValue || !can.id) {
                Alert.alert("Missing Can", "Please select a can before recording the weight.");
                return;
            }

            if (!memberValue) {
                Alert.alert("Missing Member", "Please select a member before recording the weight.");
                return;
            }

            if (hasEntryForMemberAndCan(memberValue, can.id)) {
                Alert.alert(
                    "Duplicate Entry",
                    "This member already has a record for the selected can. Choose a different can or member."
                );
                return;
            }

            const net = parseFloat((scaleWeight - tare).toFixed(2));

            // Prevent adding entry if net weight is negative or invalid
            if (!isFinite(net) || net < 0) {
                Alert.alert(
                    "Invalid Weight",
                    `Net weight is invalid (${net.toFixed(2)} KG). Please check the scale weight (${scaleWeight.toFixed(2)} KG) and measuring can tare weight (${tare} KG). Entry not added.`
                );
                return;
            }

            // Prevent adding entry if net weight is unreasonably high (likely error)
            if (net > 1000) {
                Alert.alert(
                    "Suspicious Weight",
                    `Net weight seems unusually high (${net.toFixed(2)} KG). Please verify the scale reading and measuring can tare weight.`
                );
                return;
            }

            const memberLabel = (() => {
                if (!selectedMember && memberValue == null) {
                    return "N/A";
                }

                const name = selectedMember
                    ? `${selectedMember.first_name ?? ""} ${selectedMember.last_name ?? ""}`.trim()
                    : "";
                const memberNo =
                    selectedMember?.member_no ||
                    selectedMember?.membership_no ||
                    selectedMember?.membershipNo;

                if (name) {
                    return memberNo ? `${name} (${memberNo})` : name;
                }

                return `Member #${memberValue}`;
            })();

            const entry = {
                member_id: memberValue,
                member_label: memberLabel,
                can_id: can?.id ?? null,
                can_label: can?.can_id ?? `Can ${can?.id ?? "N/A"}`,
                scale_weight: scaleWeight,
                tare_weight: tare, // Always from measuring can
                net,
            };

            setEntries(prev => [...prev, entry]);
            setTotalCans(prev => prev + 1);
            setTotalQuantity(prev => (prev ?? 0) + net);

            // Clear weight and member for the next member; keep can selected
            setScaleWeight(null);
            setScaleWeightText("");
            setMemberValue(null);
            setMember(null);
            setSelectedMember(null);
            setMemberOpen(true);
            resetMemberDropdownItems();
            setCanOpen(false);
            setMeasuringCanOpen(false);

        } catch (error) {
            console.error('[MemberKilos] Error in takeWeight:', error);
            Alert.alert("Error", "An error occurred while recording the weight. Please try again.");
        }
    };

    const removeEntry = (index: number) => {
        setEntries((prev) => {
            const next = prev.filter((_, i) => i !== index);
            const totalNet = next.reduce((sum, item) => sum + (item.net ?? 0), 0);
            setTotalQuantity(totalNet);
            setTotalCans(next.length);
            return next;
        });
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
    const sendMemberKilosDebounced = useRef<ReturnType<typeof setTimeout> | null>(null);

    const printMemberKilosReceipts = useCallback(async (receiptTexts: string[]) => {
        if (!receiptTexts.length) {
            return;
        }

        setIsPrinting(true);
        try {
            let connectedPrinter: any = null;

            if (connectedPrinterDevice) {
                try {
                    let isStillConnected = false;
                    if (connectedPrinterDevice.type === "ble" && connectedPrinterDevice.bleDevice) {
                        isStillConnected = (connectedPrinterDevice.bleDevice as any).isConnected === true;
                    } else if (
                        connectedPrinterDevice.type === "classic" &&
                        connectedPrinterDevice.classicDevice
                    ) {
                        isStillConnected = await connectedPrinterDevice.classicDevice.isConnected();
                    }
                    if (isStillConnected) {
                        console.log("[PRINT] Printer already connected");
                        connectedPrinter = connectedPrinterDevice;
                    }
                } catch (checkErr) {
                    console.warn("[PRINT] Error checking existing connection:", checkErr);
                }
            }

            if (!connectedPrinter) {
                try {
                    console.log("[PRINT] Attempting auto-connect...");
                    const connected = await attemptAutoConnectPrinter();
                    if (connected && connectedPrinterDevice) {
                        connectedPrinter = connectedPrinterDevice;
                    }
                } catch (connectErr) {
                    console.error("[PRINT] Error connecting:", connectErr);
                }
            }

            if (!connectedPrinter) {
                console.log("[PRINT] No printer, showing modal");
                setPrinterModalVisible(true);
                try {
                    await AsyncStorage.setItem(
                        getPendingReceiptsStorageKey(),
                        JSON.stringify(receiptTexts)
                    );
                    await AsyncStorage.removeItem("pending_receipt");
                } catch (storageErr) {
                    console.error("[PRINT] Storage error:", storageErr);
                }
                return;
            }

            await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));

            for (let index = 0; index < receiptTexts.length; index += 1) {
                const receiptText = receiptTexts[index];
                console.log(
                    `[PRINT] Printing member receipt ${index + 1}/${receiptTexts.length}`
                );

                try {
                    await printReceipt(receiptText, connectedPrinter);
                } catch (printErr) {
                    console.error("[PRINT] Error during printing:", printErr);
                    Alert.alert(
                        "Print Error",
                        `Kilos were sent but receipt ${index + 1} of ${receiptTexts.length} failed to print.`
                    );
                    break;
                }

                if (index < receiptTexts.length - 1) {
                    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1200));
                }
            }
        } catch (printerError) {
            console.error("[PRINT] Unexpected error:", printerError);
            Alert.alert(
                "Print Error",
                "Kilos were sent but an error occurred while printing receipts."
            );
        } finally {
            setIsPrinting(false);
        }
    }, [
        attemptAutoConnectPrinter,
        connectedPrinterDevice,
        printReceipt,
    ]);

    const sendMemberKilos = async () => {
        // Prevent rapid successive calls
        if (sendMemberKilosDebounced.current) {
            console.warn('[MemberKilos] Send already in progress');
            return;
        }
        const requiredFields = [
            { field: 'transporter', value: transporterValue, label: 'Transporter' },
            { field: 'route', value: routeValue, label: 'Route' },
            { field: 'center', value: centerValue, label: 'Route Center' },
            { field: 'shift', value: shiftValue, label: 'Milk Delivery Shift' },
        ];

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

        const entriesMissingMember = entries.some((entry) => !entry?.member_id);
        if (entriesMissingMember) {
            Alert.alert(
                "Missing Member",
                "One or more recorded entries are missing a member. Please remove them or record again with a member selected."
            );
            return;
        }

        if (!journalCode.trim()) {
            Alert.alert(
                "Missing Journal",
                "Journal is required. Select a transporter to auto-generate one, or enter it manually."
            );
            return;
        }

        if (!batchNo.trim()) {
            Alert.alert(
                "Missing Batch No",
                "Batch number is required. Select a route to auto-generate one, or enter it manually."
            );
            return;
        }

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
        sendMemberKilosDebounced.current = setTimeout(() => {
            sendMemberKilosDebounced.current = null;
        }, 3000);

        try {
            const capturedEntries = [...entries];
            const capturedTransporterValue = transporterValue;
            const capturedShiftValue = shiftValue;
            const capturedRouteValue = routeValue;
            const capturedCenterValue = centerValue;
            const capturedCommonData = commonData;
            const selectedTransporter = (commonData.transporters || []).find(
                (t: any) => t.id === transporterValue
            );
            const selectedRoute = (commonData.routes || []).find(
                (r: any) => r.id === routeValue
            );

            const payload = buildMemberKilosJournalPayload({
                transporterId: transporterValue as number,
                routeId: routeValue as number,
                milkDeliveryShiftId: shiftValue as number,
                entries: capturedEntries,
                transporter: selectedTransporter,
                route: selectedRoute,
                journal: journalCode.trim(),
                batch_no: batchNo.trim(),
            });

            console.log("[MemberKilos] Sending milk journal payload:", payload);

            const [status, response] = await makeRequest({
                url: "milk-journals",
                method: "POST",
                data: payload as any,
            });

            logMilkJournalPost(payload, status, response);

            if (![200, 201].includes(status)) {
                setLoading(false);
                Alert.alert(
                    "Failed to Send Kilos",
                    extractApiErrorMessage(response, status)
                );
                return;
            }

            const receiptTexts = buildMemberKilosReceipts({
                response,
                payload,
                localEntries: capturedEntries,
                commonData: capturedCommonData,
                transporterId: capturedTransporterValue,
                shiftId: capturedShiftValue,
                routeId: capturedRouteValue,
                centerId: capturedCenterValue,
            });

            console.log(
                `[MemberKilos] Prepared ${receiptTexts.length} member receipt(s) for printing`
            );

            setSuccessModalVisible(true);
            fetchMemberTotals();

            setEntries([]);
            setTotalCans(0);
            setTotalQuantity(0);
            setScaleWeight(null);
            setCanValue(null);
            setCan(null);

            void printMemberKilosReceipts(receiptTexts);
        } catch (err: any) {
            console.error("[MemberKilos] sendMemberKilos error:", err);
            setLoading(false);
            Alert.alert(
                "Error",
                err?.message || "An error occurred while sending kilos. Please try again."
            );
        } finally {
            setLoading(false);
            if (sendMemberKilosDebounced.current) {
                clearTimeout(sendMemberKilosDebounced.current);
                sendMemberKilosDebounced.current = null;
            }
        }
    };

    useEffect(() => {
        if (canViewKilos && canCreateKilos) {
            setViewMode(false);
        } else if (canViewKilos) {
            setViewMode(true);
        } else if (canCreateKilos) {
            setViewMode(false);
        }
    }, [canViewKilos, canCreateKilos]);

    const handleViewModeChange = (nextViewMode: boolean) => {
        if (nextViewMode && !canViewKilos) {
            return;
        }
        if (!nextViewMode && !canCreateKilos) {
            return;
        }
        setViewMode(nextViewMode);
    };

    // --- Render ---
    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={true}>
                {/* --- View/Record Toggle --- */}
                <View style={styles.toggleContainer}>
                    <Text style={styles.toggleLabel}>{viewMode ? "View Kilos" : "Record Kilos"}</Text>
                    <Switch
                        value={viewMode}
                        onValueChange={handleViewModeChange}
                        disabled={!canToggleKilos}
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
                        disabled={canViewKilos && !canCreateKilos}
                        placeholder="Select member"
                        searchable
                        disableLocalSearch
                        searchPlaceholder="Search name or member no..."
                        onChangeSearchText={handleMemberSearch}
                        onClose={resetMemberDropdownItems}
                        renderListItem={renderDropdownItem}
                        zIndex={DROPDOWN_STACK.viewMember.zIndex}
                        style={globalStyles.basedropdown}
                        dropDownContainerStyle={globalStyles.basedropdown}
                        zIndexInverse={DROPDOWN_STACK.viewMember.zIndexInverse}
                        scrollViewProps={{ nestedScrollEnabled: true }}
                    />
                ) : (
                    <>
                        <View style={styles.row}>
                            <View style={styles.col}>
                                <Text style={styles.label}>Journal</Text>
                                <TextInput
                                    style={styles.input}
                                    value={journalCode}
                                    onChangeText={setJournalCode}
                                    placeholder="Auto-generated from transporter"
                                    autoCapitalize="characters"
                                />
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.label}>Batch No</Text>
                                <TextInput
                                    style={styles.input}
                                    value={batchNo}
                                    onChangeText={setBatchNo}
                                    placeholder="Auto-generated from route"
                                    autoCapitalize="characters"
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.transporter.zIndex)]}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={transporterOpen}
                                    value={transporterValue}
                                    items={transporterItems}
                                    setOpen={(open) => {
                                        setTransporterOpen(open);
                                        if (open) closeOtherDropdowns("transporter");
                                    }}
                                    setValue={(val: any) => handleTransporterSelect(val as number)}
                                    setItems={setTransporterItems}
                                    placeholder="Select transporter"
                                    searchable
                                    searchPlaceholder="Search transporter..."
                                    disabled={transporterDisabled}
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.transporter.zIndex}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={DROPDOWN_STACK.transporter.zIndexInverse}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                            <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.shift.zIndex)]}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={shiftOpen}
                                    value={shiftValue}
                                    items={shiftItems}
                                    setOpen={(open) => {
                                        setShiftOpen(open);
                                        if (open) closeOtherDropdowns("shift");
                                    }}
                                    setValue={(val: any) => {
                                        setShiftValue(val as number);
                                        const sel = (commonData.shifts || []).find((s: any) => s.id === val);
                                        if (sel) setShift(sel);
                                    }}
                                    setItems={setShiftItems}
                                    placeholder="Select shift"
                                    searchable
                                    searchPlaceholder="Search shift..."
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.shift.zIndex}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={DROPDOWN_STACK.shift.zIndexInverse}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.route.zIndex)]}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={routeOpen}
                                    value={routeValue}
                                    items={routeItems}
                                    setOpen={(open) => {
                                        setRouteOpen(open);
                                        if (open) closeOtherDropdowns("route");
                                    }}
                                    setValue={(val: any) => {
                                        setRouteValue(val as number);
                                        const sel = (commonData.routes || []).find((r: any) => r.id === val);
                                        if (sel) setRoute(sel);
                                    }}
                                    setItems={setRouteItems}
                                    placeholder="Select route"
                                    searchable
                                    searchPlaceholder="Search route..."
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.route.zIndex}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={DROPDOWN_STACK.route.zIndexInverse}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                            <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.center.zIndex)]}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={centerOpen}
                                    value={centerValue}
                                    items={centerItems}
                                    setOpen={(open) => {
                                        setCenterOpen(open);
                                        if (open) closeOtherDropdowns("center");
                                    }}
                                    setValue={(val: any) => {
                                        setCenterValue(val as number);
                                        const sel = centerItems.find((c: any) => c.value === val);
                                        if (sel) {
                                            setCenter({ id: sel.value, center: sel.label });
                                        }
                                    }}
                                    setItems={setCenterItems}
                                    placeholder="Select route center"
                                    searchable
                                    searchPlaceholder="Search center..."
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.center.zIndex}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={DROPDOWN_STACK.center.zIndexInverse}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.can.zIndex)]}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={canOpen}
                                    value={canValue}
                                    items={canItems.map((item) => ({
                                        ...item,
                                        disabled:
                                            memberValue != null &&
                                            hasEntryForMemberAndCan(memberValue, item.value),
                                    }))}
                                    setOpen={(open) => {
                                        setCanOpen(open);
                                        if (open) closeOtherDropdowns("can");
                                    }}
                                    setValue={(val: any) => {
                                        setCanValue(val as number);
                                        const sel = (commonData.cans || []).find((c: any) => c.id === val);
                                        if (sel) {
                                            setCan(sel);
                                            applyMeasuringCanSelection(sel);
                                            persistSelectedMilkCan(sel);
                                        }
                                    }}
                                    setItems={setCanItems}
                                    placeholder="Select can"
                                    searchable
                                    searchPlaceholder="Search can..."
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.can.zIndex}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={DROPDOWN_STACK.can.zIndexInverse}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                            <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.measuringCan.zIndex)]}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={measuringCanOpen}
                                    value={measuringCanValue}
                                    items={measuringCanItems}
                                    setOpen={(open) => {
                                        setMeasuringCanOpen(open);
                                        if (open) closeOtherDropdowns("measuringCan");
                                    }}
                                    setValue={(val: any) => {
                                        setMeasuringCanValue(val as number);
                                        const sel = (commonData?.cans || []).find((c: any) => c.id === val);
                                        if (sel) {
                                            setMeasuringCan(sel);
                                            persistSelectedMilkCan(sel);
                                        }
                                    }}
                                    setItems={setMeasuringCanItems}
                                    placeholder="Measuring Can"
                                    searchable
                                    searchPlaceholder="Search measuring can..."
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.measuringCan.zIndex}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={DROPDOWN_STACK.measuringCan.zIndexInverse}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.member.zIndex)]}>
                                <DropDownPicker
                                    listMode="SCROLLVIEW"
                                    open={memberOpen}
                                    value={memberValue}
                                    items={memberItems}
                                    setOpen={(open) => {
                                        setMemberOpen(open);
                                        if (open) closeOtherDropdowns("member");
                                    }}
                                    setValue={(val: any) => {
                                        setMemberValue(val as number);
                                        const sel = (commonData.members || []).find((m: any) => m.id === val);
                                        if (sel) {
                                            setMember(sel);
                                            setSelectedMember(sel);
                                        }
                                        resetMemberDropdownItems();
                                    }}
                                    setItems={setMemberItems}
                                    placeholder="Select member"
                                    searchable
                                    disableLocalSearch
                                    searchPlaceholder="Search name or member no..."
                                    onChangeSearchText={handleMemberSearch}
                                    onClose={resetMemberDropdownItems}
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.member.zIndex}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={globalStyles.basedropdown}
                                    zIndexInverse={DROPDOWN_STACK.member.zIndexInverse}
                                    scrollViewProps={{ nestedScrollEnabled: true }}
                                />
                            </View>
                        </View>

                        <View style={styles.contentBelowDropdowns}>
                        <View style={styles.row}>
                            {/* SCALE, CAN IN/OUT, NET fields */}
                            <View style={styles.col}>
                                <Text style={styles.label}>Scale</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Scale Wt"
                                    value={connectedScaleDevice
                                        ? (scaleWeight !== null && scaleWeight !== undefined && !isNaN(scaleWeight) ? scaleWeight.toFixed(2) : "")
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
                                    value={measuringCan ? getMeasuringCanTare(measuringCan).toFixed(2) : "0.00"}
                                    editable={false}
                                />
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.label}>Net</Text>
                                <Text style={styles.value}>
                                    {(() => {
                                        try {
                                            if (scaleWeight !== null && scaleWeight !== undefined &&
                                                measuringCan &&
                                                isFinite(scaleWeight) && scaleWeight >= 0) {
                                                const net = scaleWeight - getMeasuringCanTare(measuringCan);
                                                if (isFinite(net) && net >= 0) {
                                                    return `${net.toFixed(2)} KG`;
                                                }
                                            }
                                            return "--";
                                        } catch (error) {
                                            console.error('[MemberKilos] Error calculating net weight in UI:', error);
                                            return "--";
                                        }
                                    })()}
                                </Text>
                            </View>
                        </View>

                        {/* Bluetooth Enable Reminder */}
                        {!connectedScaleDevice && (
                            <View style={{ marginVertical: 6, padding: 8, backgroundColor: '#FEF3C7', borderRadius: 6, borderWidth: 1, borderColor: '#F59E0B', flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialIcons name="bluetooth" size={16} color="#F59E0B" />
                                <Text style={{ marginLeft: 6, color: '#92400E', fontSize: 12, flex: 1 }}>
                                    Ensure Bluetooth is enabled on your device before connecting to a scale.
                                </Text>
                            </View>
                        )}

                        {/* Connection Type Indicator */}
                        {scaleSettingsLoaded && (
                            <View style={{ marginVertical: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: scaleConnectionType === 'ble' ? '#EBF4FF' : '#F0FDF4', borderRadius: 4, alignSelf: 'flex-start' }}>
                                <Text style={{ fontSize: 11, color: scaleConnectionType === 'ble' ? '#1D4ED8' : '#166534', fontWeight: '600' }}>
                                    {scaleConnectionType === 'ble' ? '🔵 BLE Mode (useBLEService)' : '📱 Classic Mode (useBluetoothService)'}
                                </Text>
                            </View>
                        )}

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
                                <View key={idx} style={styles.entryRow}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={styles.entryText}>
                                            {e.member_label ? `${e.member_label} - ` : ""}
                                            Can ({e.can_label}) - Gross: {e.scale_weight} - Tare: {e.tare_weight} - Net: {e.net}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => removeEntry(idx)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        accessibilityLabel="Delete entry"
                                    >
                                        <MaterialIcons name="delete" size={22} color="#ef4444" />
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
                        </View>
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

                    {/* Total Milk Section */}
                    <View style={{ marginTop: 16, alignItems: "center" }}>
                        <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                            Total Milk
                        </Text>

                        {fetchingMemberTotals ? (
                            <Text>Loading...</Text>
                        ) : memberTotals !== null && memberTotals !== undefined ? (
                            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#2563eb" }}>
                                {typeof memberTotals === 'number' ? `${memberTotals.toFixed(2)} KG` : '0.00 KG'}
                            </Text>
                        ) : (
                            <Text style={{ color: "gray" }}>No data available</Text>
                        )}
                    </View>

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
                onClose={() => {
                    setScaleModalVisible(false);
                    // If user closed modal without connecting, keep continuous reconnection running
                    if (!connectedScaleDevice) {
                        console.log('[MemberKilos] Scale modal closed without connection, continuing reconnection attempts');
                    }
                }}
                type="device-list"
                deviceType="scale"
                title="Select Scale Device"
                message="Make sure Bluetooth is enabled and location permissions are granted for device scanning."
                devices={scaleDevices}
                connectToDevice={async (deviceId: string) => {
                    try {
                        const result = await connectToScaleDevice(deviceId);
                        if (result) {
                            // Find the connected device from the devices list to persist it
                            const connectedDevice = scaleDevices?.find(d => d.id === deviceId || d.address === deviceId);
                            if (connectedDevice) {
                                await persistLastScale(connectedDevice);
                            }
                            // Stop continuous reconnection since we have a successful connection
                            stopContinuousReconnection();
                        }
                        return result;
                    } catch (error) {
                        console.error('[MemberKilos] Error connecting to scale device:', error);
                        throw error;
                    }
                }}
                scanForDevices={async () => {
                    // Check setup before scanning
                    const setupOk = await checkBluetoothSetup();
                    if (setupOk) {
                        scanForScaleDevices();
                    }
                }}
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

                            // Print pending receipts if they exist
                            try {
                                const pendingReceiptsRaw = await AsyncStorage.getItem(
                                    getPendingReceiptsStorageKey()
                                );
                                let pendingReceipts: string[] = [];

                                if (pendingReceiptsRaw) {
                                    const parsed = JSON.parse(pendingReceiptsRaw);
                                    if (Array.isArray(parsed)) {
                                        pendingReceipts = parsed.filter(
                                            (item) => typeof item === "string"
                                        );
                                    }
                                }

                                if (pendingReceipts.length === 0) {
                                    const legacyReceipt = await AsyncStorage.getItem(
                                        "pending_receipt"
                                    );
                                    if (legacyReceipt) {
                                        pendingReceipts = [legacyReceipt];
                                    }
                                }

                                if (pendingReceipts.length > 0) {
                                    setIsPrinting(true);
                                    try {
                                        let allPrinted = true;
                                        for (
                                            let index = 0;
                                            index < pendingReceipts.length;
                                            index += 1
                                        ) {
                                            const printSuccess = await printReceipt(
                                                pendingReceipts[index]
                                            );
                                            if (!printSuccess) {
                                                allPrinted = false;
                                                break;
                                            }
                                            if (index < pendingReceipts.length - 1) {
                                                await new Promise<void>((resolve) =>
                                                    setTimeout(() => resolve(), 1200)
                                                );
                                            }
                                        }

                                        if (allPrinted) {
                                            await AsyncStorage.removeItem(
                                                getPendingReceiptsStorageKey()
                                            );
                                            await AsyncStorage.removeItem("pending_receipt");
                                        } else {
                                            console.warn(
                                                "[PRINT] Failed to print all pending receipts"
                                            );
                                        }
                                    } catch (printErr) {
                                        console.error(
                                            "[PRINT] Error printing pending receipts:",
                                            printErr
                                        );
                                        try {
                                            Alert.alert(
                                                "Print Error",
                                                "Failed to print receipts. Please check the printer and try again."
                                            );
                                        } catch (alertErr) {
                                            console.error(
                                                "[PRINT] Error showing alert:",
                                                alertErr
                                            );
                                        }
                                    } finally {
                                        setIsPrinting(false);
                                    }
                                }
                            } catch (receiptErr) {
                                console.error(
                                    "[PRINT] Error handling pending receipts:",
                                    receiptErr
                                );
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
    contentBelowDropdowns: { zIndex: 1, elevation: 1 },
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
});
