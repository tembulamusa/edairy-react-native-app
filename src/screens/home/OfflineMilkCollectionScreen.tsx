// src/screens/home/OfflineMilkCollectionScreen.tsx
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    TextInput,
    ActivityIndicator,
    ScrollView,
    Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
// @ts-ignore
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import NetInfo from '@react-native-community/netinfo';
import useBluetoothService from "../../hooks/useBluetoothService";
import BluetoothConnectionModal from '../../components/modals/BluetoothConnectionModal';
import SuccessModal from "../../components/modals/SuccessModal";
import { globalStyles, getDropdownPickerModalProps } from "../../styles";
import {
    initDatabase,
    insertOfflineData,
    OFFLINE_SYNC_ENDPOINTS,
    getAllCollections,
    getMeasuringCan,
    saveOfflineCollectionDraft,
    getOfflineCollectionDraft,
    clearOfflineCollectionDraft,
} from "../../services/offlineDatabase";
import {
    fetchRouteCentersForRoute,
    getMembers,
    getMeasuringCans,
    getRouteCenters,
    getRoutes,
    getTransporters,
    loadMemberKilosReferenceDataFromSQLite,
    normalizeMemberKilosCans,
} from "../../services/offlineReferenceData";
import { checkConnectivity } from "../../services/offlineSync";
import { useSync } from "../../context/SyncContext";
import { getOfflineReferenceSyncHours } from "../../utils/userPreferences";
import { formatPendingAge } from "../../utils/offlineSaveGate";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all";
import useMemberDropdownSearch from "../../hooks/useMemberDropdownSearch";
import { getMilkCanTare, toMilkCanDropdownItems } from "../../utils/milkCan";
import {
    getMemberDisplayName,
    getMemberNumber,
    toMemberDropdownItems,
} from "../../utils/referenceDataFetch";
import { getTransporterDisplayName, toTransporterDropdownItems } from "../../utils/transporter";
import {
    getRouteDisplayName,
    getRouteCenterDisplayName,
    toRouteCenterDropdownItems,
    toRouteDropdownItems,
} from "../../utils/route";
import { toShiftDropdownItems } from "../../utils/dropdownItems";
import { findShiftForCurrentTime } from "../../utils/shift";
import {
    buildMemberKilosJournalPayload,
    findRouteById,
    findTransporterById,
    resolveBatchNo,
    resolveJournalCode,
} from "../../utils/memberKilosJournalPayload";
import {
    buildOfflineCollectionReceipts,
    getPendingReceiptsStorageKey,
} from "../../utils/memberKilosJournalReceipts";

const OFFLINE_HEADER_ONLINE = "#1b7f74";
const OFFLINE_HEADER_OFFLINE = "#dc2626";

const DROPDOWN_STACK = {
    transporter: { zIndex: 8000, zIndexInverse: 1000 },
    shift: { zIndex: 7500, zIndexInverse: 1500 },
    route: { zIndex: 7000, zIndexInverse: 2000 },
    center: { zIndex: 6500, zIndexInverse: 2500 },
    can: { zIndex: 6000, zIndexInverse: 3000 },
    measuringCan: { zIndex: 5500, zIndexInverse: 3500 },
    member: { zIndex: 5000, zIndexInverse: 4000 },
} as const;

const getDropdownColStyle = (zIndex: number) => ({
    zIndex,
    elevation: zIndex / 1000,
});

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

const formatReferenceSyncLabel = (
    syncInfo: { synced_at: string; record_counts: Record<string, number> } | null
): string | null => {
    if (!syncInfo?.synced_at) {
        return null;
    }

    const syncedAt = new Date(syncInfo.synced_at);
    const when = Number.isNaN(syncedAt.getTime())
        ? syncInfo.synced_at
        : syncedAt.toLocaleString();

    const counts = syncInfo.record_counts || {};
    const parts = [
        counts.members != null ? `${counts.members} members` : null,
        counts.transporters != null ? `${counts.transporters} transporters` : null,
        counts.routes != null ? `${counts.routes} routes` : null,
        counts.shifts != null ? `${counts.shifts} shifts` : null,
        counts.cans != null ? `${counts.cans} cans` : null,
    ].filter(Boolean);

    return parts.length > 0
        ? `Stored locally ${when} (${parts.join(", ")})`
        : `Stored locally ${when}`;
};

const gateSyncHint = (unsyncedCount: number): string => {
    if (unsyncedCount > 0) {
        return ` (${unsyncedCount} pending collection${unsyncedCount === 1 ? "" : "s"})`;
    }
    return "";
};

const OfflineMilkCollectionScreen = () => {
    const navigation = useNavigation<any>();
    const {
        isSyncing,
        collectionGate,
        mandatorySyncError,
        gateCheckEnabled,
        refreshCollectionGate,
        enableCollectionGateCheck,
    } = useSync();

    const unsyncedCount = collectionGate.unsyncedCount;
    const requiresOnlinePush = collectionGate.requiresOnlinePush;
    const pendingAgeLabel = useMemo(
        () => formatPendingAge(collectionGate.pendingAgeMs),
        [collectionGate.pendingAgeMs]
    );

    const [commonData, setCommonData] = useState<any>({
        transporters: [],
        members: [],
        routes: [],
        shifts: [],
        cans: [],
        route_centers: [],
    });
    const [journalCode, setJournalCode] = useState("");
    const [batchNo, setBatchNo] = useState("");
    const [scaleWeight, setScaleWeight] = useState<number | null>(null);
    const [scaleWeightText, setScaleWeightText] = useState<string>("");
    const [measuringCan, setMeasuringCan] = useState<any | null>(null);
    const [can, setCan] = useState<any | null>(null);
    const [transporter, setTransporter] = useState<any | null>(null);
    const [route, setRoute] = useState<any | null>(null);
    const [center, setCenter] = useState<any | null>(null);
    const [member, setMember] = useState<any | null>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [totalCans, setTotalCans] = useState<number>(0);
    const [totalQuantity, setTotalQuantity] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean>(false);

    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState<any[]>([]);

    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [shiftItems, setShiftItems] = useState<any[]>([]);

    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [routeItems, setRouteItems] = useState<any[]>([]);

    const [centerOpen, setCenterOpen] = useState(false);
    const [centerValue, setCenterValue] = useState<number | null>(null);
    const [centerItems, setCenterItems] = useState<any[]>([]);

    const [canOpen, setCanOpen] = useState(false);
    const [canValue, setCanValue] = useState<number | null>(null);
    const [canItems, setCanItems] = useState<any[]>([]);

    const [measuringCanOpen, setMeasuringCanOpen] = useState(false);
    const [measuringCanValue, setMeasuringCanValue] = useState<number | null>(null);
    const [measuringCanItems, setMeasuringCanItems] = useState<any[]>([]);

    const [memberOpen, setMemberOpen] = useState(false);
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState<any[]>([]);
    const [allMemberItems, setAllMemberItems] = useState<any[]>([]);

    // Modal states
    const [scaleModalVisible, setScaleModalVisible] = useState(false);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [collectionHistory, setCollectionHistory] = useState<any[]>([]);
    const [isPrinting, setIsPrinting] = useState(false);
    const [offlineSyncHours, setOfflineSyncHours] = useState(6);

    const isMountedRef = useRef(true);
    const isRestoringDraftRef = useRef(false);
    const isCollectionBlocked = isSyncing || requiresOnlinePush;

    const applyCachedReferenceData = useCallback(
        (
            transporters: any[],
            members: any[],
            routes: any[],
            shifts: any[],
            cans: any[],
            options?: { autoSelectDefaults?: boolean }
        ) => {
            const autoSelectDefaults = options?.autoSelectDefaults ?? false;

            setCommonData((prev: any) => ({
                ...prev,
                transporters,
                members,
                routes,
                shifts,
                cans,
            }));

            setTransporterItems(toTransporterDropdownItems(transporters));
            setRouteItems(toRouteDropdownItems(routes));
            setShiftItems(toShiftDropdownItems(shifts));
            setCanItems(toMilkCanDropdownItems(cans));
            setMeasuringCanItems(toMilkCanDropdownItems(cans));

            const memberDropdownItems = toMemberDropdownItems(members);
            setAllMemberItems(memberDropdownItems);
            setMemberItems(memberDropdownItems);

            if (autoSelectDefaults && transporters.length === 1) {
                const onlyTransporter = transporters[0];
                setTransporterValue(onlyTransporter.id);
                setTransporter(onlyTransporter);
                autoSelectRouteForTransporter(
                    onlyTransporter,
                    routes,
                    setRouteValue,
                    setRoute
                );
            }

            if (autoSelectDefaults && shifts.length > 0) {
                const matchingShift = findShiftForCurrentTime(shifts);
                if (matchingShift) {
                    setShiftValue(matchingShift.id);
                }
            }
        },
        []
    );

    const loadCachedReferenceData = useCallback(
        async (autoSelectDefaults = false) => {
            const referenceData = await loadMemberKilosReferenceDataFromSQLite();
            const {
                transporters,
                members,
                routes,
                shifts,
                cans,
            } = referenceData;

            if (!isMountedRef.current) {
                return;
            }

            applyCachedReferenceData(
                transporters,
                members,
                routes,
                shifts,
                cans,
                { autoSelectDefaults }
            );

            if (autoSelectDefaults && cans.length > 0) {
                const storedUser = await AsyncStorage.getItem("user");
                if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    const savedCan = await getMeasuringCan(userData.member_id);
                    if (savedCan) {
                        const matchingCan = cans.find((c: any) => c.id === savedCan.id);
                        if (matchingCan) {
                            setMeasuringCanValue(matchingCan.id);
                            setMeasuringCan(matchingCan);
                        }
                    }
                }
            }
        },
        [applyCachedReferenceData]
    );

    useEffect(() => {
        void getOfflineReferenceSyncHours().then(setOfflineSyncHours);
    }, []);

    useFocusEffect(
        useCallback(() => {
            void getOfflineReferenceSyncHours().then(setOfflineSyncHours);
        }, [])
    );

    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: true,
            headerTitle: isOnline ? "Milk Collection" : "Milk Collection (Offline)",
            headerStyle: {
                backgroundColor: isOnline ? OFFLINE_HEADER_ONLINE : OFFLINE_HEADER_OFFLINE,
            },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "600" },
        });
    }, [navigation, isOnline]);

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
        autoConnectInnerPrinter,
    } = printerBluetooth;

    const restoreDraftFromSQLite = useCallback(async () => {
        try {
            const draft = await getOfflineCollectionDraft();
            if (!draft || draft.entries.length === 0) {
                return;
            }

            isRestoringDraftRef.current = true;

            setTransporterValue(draft.transporterValue);
            setShiftValue(draft.shiftValue);
            setRouteValue(draft.routeValue);
            setCenterValue(draft.centerValue);
            setMeasuringCanValue(draft.measuringCanValue);
            setMemberValue(draft.memberValue);
            setEntries(draft.entries);
            setTotalCans(draft.totalCans);
            setTotalQuantity(draft.totalQuantity);

            const [transporters, routes, measuringCans] = await Promise.all([
                getTransporters(),
                getRoutes(),
                getMeasuringCans(),
            ]);

            if (draft.transporterValue) {
                setTransporter(
                    (transporters || []).find((item: any) => item.id === draft.transporterValue) || null
                );
            }

            if (draft.routeValue) {
                setRoute(
                    (routes || []).find((item: any) => item.id === draft.routeValue) || null
                );
                const centers = await getRouteCenters(draft.routeValue);
                if (isMountedRef.current) {
                    setCommonData((prev: any) => ({
                        ...prev,
                        route_centers: centers || [],
                    }));
                    setCenterItems(
                        (centers || []).map((item: any) => ({
                            label: getRouteCenterDisplayName(item),
                            value: item.id,
                        }))
                    );
                }
            }

            if (draft.centerValue && draft.routeValue) {
                const centers = await getRouteCenters(draft.routeValue);
                setCenter(
                    (centers || []).find((item: any) => item.id === draft.centerValue) || null
                );
            }

            if (draft.measuringCanValue) {
                const cans = normalizeMemberKilosCans(measuringCans || []);
                setMeasuringCan(
                    cans.find((item: any) => item.id === draft.measuringCanValue) || null
                );
            }

            if (draft.memberValue) {
                const members = await getMembers();
                setMember(
                    (members || []).find((item: any) => item.id === draft.memberValue) || null
                );
            }

            console.log("[OFFLINE] Restored in-progress collection draft from SQLite");
        } catch (error) {
            console.error("[OFFLINE] Failed to restore collection draft:", error);
        } finally {
            setTimeout(() => {
                isRestoringDraftRef.current = false;
            }, 500);
        }
    }, []);

    const persistDraftToSQLite = useCallback(async () => {
        if (isRestoringDraftRef.current || isCollectionBlocked) {
            return;
        }

        const hasDraftContent =
            entries.length > 0 ||
            transporterValue != null ||
            routeValue != null ||
            shiftValue != null ||
            centerValue != null ||
            measuringCanValue != null ||
            journalCode.trim().length > 0 ||
            batchNo.trim().length > 0;

        try {
            if (!hasDraftContent) {
                await clearOfflineCollectionDraft();
                return;
            }

            await saveOfflineCollectionDraft({
                transporterValue,
                shiftValue,
                routeValue,
                centerValue,
                measuringCanValue,
                memberValue,
                journalCode,
                batchNo,
                entries,
                totalCans,
                totalQuantity,
            });
        } catch (error) {
            console.error("[OFFLINE] Failed to persist collection draft:", error);
        }
    }, [
        batchNo,
        centerValue,
        entries,
        isCollectionBlocked,
        journalCode,
        measuringCanValue,
        memberValue,
        routeValue,
        shiftValue,
        totalCans,
        totalQuantity,
        transporterValue,
    ]);

    // Initialize database and load locally stored reference data
    useEffect(() => {
        const init = async () => {
            try {
                await initDatabase();
                await loadCachedReferenceData(true);
                await restoreDraftFromSQLite();
                enableCollectionGateCheck();
                await refreshCollectionGate();
            } catch (error) {
                console.error('[OFFLINE] Failed to initialize:', error);
                Alert.alert("Database Error", "Failed to initialize offline storage");
            }
        };

        init();

        return () => {
            isMountedRef.current = false;
        };
    }, [
        enableCollectionGateCheck,
        loadCachedReferenceData,
        refreshCollectionGate,
        restoreDraftFromSQLite,
    ]);

    useFocusEffect(
        useCallback(() => {
            void loadCachedReferenceData(false);
            if (gateCheckEnabled) {
                void refreshCollectionGate();
            }
        }, [gateCheckEnabled, loadCachedReferenceData, refreshCollectionGate])
    );

    useEffect(() => {
        if (!gateCheckEnabled) {
            return;
        }

        const interval = setInterval(() => {
            void refreshCollectionGate();
        }, 30000);

        return () => clearInterval(interval);
    }, [gateCheckEnabled, refreshCollectionGate]);

    useEffect(() => {
        if (!isOnline) {
            enableCollectionGateCheck();
            void refreshCollectionGate();
        }
    }, [enableCollectionGateCheck, isOnline, refreshCollectionGate]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            void persistDraftToSQLite();
        }, 400);

        return () => clearTimeout(timeout);
    }, [persistDraftToSQLite]);

    useEffect(() => {
        if (canValue && Array.isArray(commonData.cans)) {
            const found = commonData.cans.find((c: any) => c.id === canValue);
            if (found) {
                setCan(found);
            }
        }
    }, [canValue, commonData.cans]);

    useEffect(() => {
        if (transporterValue && Array.isArray(commonData.transporters)) {
            const found = commonData.transporters.find(
                (item: any) => item.id === transporterValue
            );
            if (found) {
                setTransporter(found);
            }
        }
    }, [transporterValue, commonData.transporters]);

    useEffect(() => {
        if (routeValue && Array.isArray(commonData.routes)) {
            const found = commonData.routes.find((r: any) => r.id === routeValue);
            if (found) {
                setRoute(found);
            }
        }
    }, [routeValue, commonData.routes]);

    useEffect(() => {
        setJournalCode(
            resolveJournalCode(
                transporterValue,
                commonData.transporters,
                transporter
            )
        );
    }, [transporter, transporterValue, commonData.transporters]);

    useEffect(() => {
        setBatchNo(
            resolveBatchNo(routeValue, commonData.routes, route)
        );
    }, [route, routeValue, commonData.routes]);

    useEffect(() => {
        if (memberValue && Array.isArray(commonData.members)) {
            const found = commonData.members.find((m: any) => m.id === memberValue);
            if (found) {
                setMember(found);
            }
        }
    }, [memberValue, commonData.members]);

    useEffect(() => {
        if (measuringCanValue && Array.isArray(commonData.cans)) {
            const found = commonData.cans.find((c: any) => c.id === measuringCanValue);
            if (found) {
                setMeasuringCan(found);
            }
        } else if (!measuringCanValue) {
            setMeasuringCan(null);
        }
    }, [measuringCanValue, commonData.cans]);

    const clearRouteCenterSelection = useCallback(() => {
        setCenterValue(null);
        setCenter(null);
        setCenterItems([]);
        setCommonData((prev: any) => ({ ...prev, route_centers: [] }));
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadRouteCenters = async () => {
            if (routeValue == null) {
                clearRouteCenterSelection();
                return;
            }

            clearRouteCenterSelection();

            try {
                const centers = await fetchRouteCentersForRoute(routeValue, {
                    logContext: "OfflineMilkCollection",
                    preferOnline: isOnline,
                });

                if (cancelled) {
                    return;
                }

                setCommonData((prev: any) => ({ ...prev, route_centers: centers }));
                setCenterItems(toRouteCenterDropdownItems(centers));

                if (centers.length === 1) {
                    const onlyCenter = centers[0];
                    setCenterValue(onlyCenter.id);
                    setCenter({
                        id: onlyCenter.id,
                        center: getRouteCenterDisplayName(onlyCenter),
                    });
                }
            } catch (error) {
                if (cancelled) {
                    return;
                }
                console.error("[OFFLINE] Error loading route centers:", error);
                clearRouteCenterSelection();
            }
        };

        loadRouteCenters();

        return () => {
            cancelled = true;
        };
    }, [routeValue, isOnline, clearRouteCenterSelection]);

    const hasEntryForMemberAndCan = useCallback(
        (memberId: number | null | undefined, selectedCanId: number | null | undefined) => {
            if (memberId == null || selectedCanId == null) {
                return false;
            }
            return entries.some(
                (entry) => entry.member_id === memberId && entry.can_id === selectedCanId
            );
        },
        [entries]
    );

    const { handleMemberSearch, resetMemberDropdownItems } = useMemberDropdownSearch({
        members: commonData.members || [],
        setMembers: (members) =>
            setCommonData((prev: any) => ({ ...prev, members })),
        allMemberItems,
        setAllMemberItems,
        setMemberItems,
        logContext: "OfflineMilkCollection",
        remoteSearchEnabled: isOnline,
    });

    const handleTransporterSelect = useCallback(
        (val: number | null) => {
            if (val == null) {
                return;
            }
            setTransporterValue(val);
            const selectedTransporter = (commonData.transporters || []).find(
                (item: any) => item.id === val
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
        if (isCollectionBlocked) {
            Alert.alert(
                "Sync Required",
                isSyncing
                    ? "Please wait while pending collections are syncing."
                    : "You have pending collections to upload. Turn on WiFi or mobile data and wait for sync to complete before recording."
            );
            return;
        }

        try {
            if (scaleWeight === null || scaleWeight === undefined || !isFinite(scaleWeight) || scaleWeight < 0) {
                Alert.alert("No weight", "No valid weight available to record. Please ensure the scale is connected and displaying a valid weight.");
                return;
            }

            if (!measuringCan) {
                Alert.alert("Missing Measuring Can", "Select a measuring can before recording.");
                return;
            }

            const tare = getMilkCanTare(measuringCan);

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

            if (!isFinite(net) || net < 0) {
                Alert.alert(
                    "Invalid Weight",
                    `Net weight is invalid (${net.toFixed(2)} KG). Please check the scale weight and measuring can tare.`
                );
                return;
            }

            if (net > 1000) {
                Alert.alert(
                    "Suspicious Weight",
                    `Net weight seems unusually high (${net.toFixed(2)} KG). Please verify the scale reading.`
                );
                return;
            }

            const selectedMember =
                member ??
                (commonData.members || []).find((m: any) => m.id === memberValue);
            const memberNo = getMemberNumber(selectedMember);
            const memberName = getMemberDisplayName(selectedMember);
            const memberLabel = memberName
                ? memberNo
                    ? `${memberName} (${memberNo})`
                    : memberName
                : `Member #${memberValue}`;

            const entry = {
                member_id: memberValue,
                member_label: memberLabel,
                can_id: can.id,
                can_label: getMilkCanLabel(can),
                scale_weight: scaleWeight,
                tare_weight: tare,
                net,
                timestamp: new Date().toISOString(),
            };

            setEntries((prev) => [...prev, entry]);
            setTotalCans((prev) => prev + 1);
            setTotalQuantity((prev) => prev + net);

            setScaleWeight(null);
            setScaleWeightText("");
            setMemberValue(null);
            setMember(null);
            setMemberOpen(true);
            resetMemberDropdownItems();
            setCanOpen(false);
            setMeasuringCanOpen(false);
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

    const attemptAutoConnectPrinter = useCallback(async (): Promise<boolean> => {
        if (!autoConnectInnerPrinter) {
            return false;
        }

        const result = await autoConnectInnerPrinter();
        if (result) {
            await persistLastPrinter(result);
            await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));
            return true;
        }

        return false;
    }, [autoConnectInnerPrinter, persistLastPrinter]);

    const printReceipt = useCallback(async (receiptText: string, deviceOverride?: any): Promise<boolean> => {
        console.log('[OFFLINE-PRINT] Printing receipt...');

        let printerDevice = deviceOverride || connectedPrinterDevice;

        if (deviceOverride && !connectedPrinterDevice) {
            for (let i = 0; i < 5; i += 1) {
                await new Promise<void>((resolve) => setTimeout(() => resolve(), 200));
                if (connectedPrinterDevice) {
                    printerDevice = connectedPrinterDevice;
                    break;
                }
            }
        }

        if (!printerDevice) {
            if (!deviceOverride && !connectedPrinterDevice) {
                await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
                if (connectedPrinterDevice) {
                    return printReceipt(receiptText, connectedPrinterDevice);
                }
            }
            Alert.alert("Printer Not Available", "No printer connected. Please connect a printer to print the receipt.");
            return false;
        }

        if (!printTextToPrinter) {
            Alert.alert("Printer Not Available", "Print function is not available. Please check printer connection.");
            return false;
        }

        if (!connectedPrinterDevice && deviceOverride) {
            await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
        }

        try {
            let isStillConnected = false;
            if (printerDevice.type === 'ble' && printerDevice.bleDevice) {
                isStillConnected = (printerDevice.bleDevice as any).isConnected === true;
            } else if (printerDevice.type === 'classic' && printerDevice.classicDevice) {
                try {
                    isStillConnected = await printerDevice.classicDevice.isConnected();
                } catch {
                    isStillConnected = false;
                }
            }

            if (!isStillConnected) {
                Alert.alert("Printer Not Connected", "The printer is not connected. Please check the connection and try again.");
                return false;
            }
        } catch {
            Alert.alert("Printer Connection Error", "Unable to verify printer connection. Please check the printer and try again.");
            return false;
        }

        try {
            let printPromise: Promise<void>;
            try {
                printPromise = printTextToPrinter(receiptText);
                if (!printPromise || typeof printPromise.then !== 'function') {
                    Alert.alert("Print Error", "Print function error. Please try again.");
                    return false;
                }
            } catch {
                Alert.alert("Print Error", "Failed to start printing. Please check the printer connection.");
                return false;
            }

            await Promise.race([
                printPromise,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Print timeout')), 30000)
                )
            ]);

            console.log('[OFFLINE-PRINT] ✅ Receipt printed successfully');
            return true;
        } catch (error) {
            const errorMsg = (error as any)?.message || String(error);
            console.error('[OFFLINE-PRINT] Print error:', errorMsg);
            if (errorMsg.includes('timeout')) {
                Alert.alert("Print Timeout", "Printing took too long. Please check the printer and try again.");
            } else {
                Alert.alert("Print Error", "Failed to print receipt. Please check the printer connection and try again.");
            }
            return false;
        }
    }, [connectedPrinterDevice, printTextToPrinter]);

    const printOfflineCollectionReceipts = useCallback(async (receiptTexts: string[]) => {
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
                        connectedPrinter = connectedPrinterDevice;
                    }
                } catch (checkErr) {
                    console.warn("[OFFLINE-PRINT] Error checking existing connection:", checkErr);
                }
            }

            if (!connectedPrinter) {
                try {
                    const connected = await attemptAutoConnectPrinter();
                    if (connected && connectedPrinterDevice) {
                        connectedPrinter = connectedPrinterDevice;
                    }
                } catch (connectErr) {
                    console.error("[OFFLINE-PRINT] Error connecting:", connectErr);
                }
            }

            if (!connectedPrinter) {
                setPrinterModalVisible(true);
                try {
                    await AsyncStorage.setItem(
                        getPendingReceiptsStorageKey(),
                        JSON.stringify(receiptTexts)
                    );
                    await AsyncStorage.removeItem("pending_receipt");
                } catch (storageErr) {
                    console.error("[OFFLINE-PRINT] Storage error:", storageErr);
                }
                return;
            }

            await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));

            for (let index = 0; index < receiptTexts.length; index += 1) {
                const receiptText = receiptTexts[index];
                console.log(
                    `[OFFLINE-PRINT] Printing member receipt ${index + 1}/${receiptTexts.length}`
                );

                try {
                    await printReceipt(receiptText, connectedPrinter);
                } catch (printErr) {
                    console.error("[OFFLINE-PRINT] Error during printing:", printErr);
                    Alert.alert(
                        "Print Error",
                        `Collection was saved but receipt ${index + 1} of ${receiptTexts.length} failed to print.`
                    );
                    break;
                }

                if (index < receiptTexts.length - 1) {
                    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1200));
                }
            }
        } catch (printerError) {
            console.error("[OFFLINE-PRINT] Unexpected error:", printerError);
            Alert.alert(
                "Print Error",
                "Collection was saved but an error occurred while printing receipts."
            );
        } finally {
            setIsPrinting(false);
        }
    }, [
        attemptAutoConnectPrinter,
        connectedPrinterDevice,
        printReceipt,
    ]);

    // Save collection offline
    const saveCollection = async () => {
        if (isCollectionBlocked) {
            Alert.alert(
                "Sync Required",
                isSyncing
                    ? "Please wait while pending collections are syncing."
                    : "You have pending collections to upload. Turn on WiFi or mobile data and wait for sync to complete before saving."
            );
            return;
        }

        try {
            if (entries.length === 0) {
                Alert.alert("No Data", "Please record at least one can");
                return;
            }

            if (!shiftValue) {
                Alert.alert("Missing Shift", "Please select a shift before saving.");
                return;
            }

            if (!transporterValue) {
                Alert.alert("Missing Transporter", "Please select a transporter before saving.");
                return;
            }

            if (!routeValue) {
                Alert.alert("Missing Route", "Please select a route before saving.");
                return;
            }

            const selectedTransporterForSave =
                transporter ?? findTransporterById(commonData.transporters, transporterValue);
            const selectedRouteForSave =
                route ?? findRouteById(commonData.routes, routeValue);
            const capturedJournal =
                journalCode.trim() ||
                resolveJournalCode(
                    transporterValue,
                    commonData.transporters,
                    selectedTransporterForSave
                );
            const capturedBatch =
                batchNo.trim() ||
                resolveBatchNo(routeValue, commonData.routes, selectedRouteForSave);

            if (!capturedJournal) {
                Alert.alert(
                    "Missing Journal",
                    "Select a transporter to auto-generate a journal code."
                );
                return;
            }

            if (!capturedBatch) {
                Alert.alert(
                    "Missing Batch No",
                    "Select a route to auto-generate a batch number."
                );
                return;
            }

            setLoading(true);

            const capturedEntries = [...entries];
            const capturedTransporter = selectedTransporterForSave;
            const capturedRoute = selectedRouteForSave;
            const capturedCenter = center;

            const primaryEntry = capturedEntries[0];
            const primaryMember =
                (commonData.members || []).find((m: any) => m.id === primaryEntry?.member_id) ||
                null;
            const capturedMemberNumber = getMemberNumber(primaryMember);
            const capturedMemberName = getMemberDisplayName(primaryMember);

            const payload = buildMemberKilosJournalPayload({
                transporterId: transporterValue as number,
                routeId: routeValue as number,
                milkDeliveryShiftId: shiftValue as number,
                entries: capturedEntries,
                transporter: capturedTransporter,
                route: capturedRoute,
                journal: capturedJournal,
                batch_no: capturedBatch,
            });

            await insertOfflineData({
                endpoint: OFFLINE_SYNC_ENDPOINTS.MILK_JOURNALS,
                data: payload,
                summary_label: capturedMemberName || capturedMemberNumber || "Member kilos",
            });

            await clearOfflineCollectionDraft();

            console.log('[OFFLINE] Collection saved to SQLite for sync');
            setSuccessModalVisible(true);

            const receiptCommonData = {
                ...commonData,
                route_centers: commonData.route_centers?.length
                    ? commonData.route_centers
                    : capturedCenter
                      ? [capturedCenter]
                      : [],
            };

            const receiptTexts = buildOfflineCollectionReceipts({
                response: null,
                payload,
                localEntries: capturedEntries,
                commonData: receiptCommonData,
                transporterId: transporterValue,
                shiftId: shiftValue,
                routeId: routeValue,
                centerId: centerValue,
            });

            enableCollectionGateCheck();
            await refreshCollectionGate();
            void printOfflineCollectionReceipts(receiptTexts);

            // Clear form after a delay
            setTimeout(() => {
                setMemberValue(null);
                setMember(null);
                setCanValue(null);
                setCan(null);
                setEntries([]);
                setTotalCans(0);
                setTotalQuantity(0);
                setScaleWeight(null);
                setScaleWeightText("");
                resetMemberDropdownItems();
                setSuccessModalVisible(false);
            }, 2000);

        } catch (error: any) {
            console.error('[OFFLINE] Error saving collection:', error);
            Alert.alert("Error", "Failed to save collection: " + (error?.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

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

    const isAnyDropdownOpen =
        memberOpen ||
        transporterOpen ||
        shiftOpen ||
        routeOpen ||
        centerOpen ||
        canOpen ||
        measuringCanOpen;

    return (
        <View style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.scrollContent}
                style={isCollectionBlocked ? styles.blockedContent : undefined}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={!isAnyDropdownOpen}
            >
                <View style={styles.toolbarRow}>
                    <Text style={styles.toolbarTitle}>Record Kilos</Text>
                    <View style={styles.toolbarActions}>
                        {unsyncedCount > 0 && (
                            <View style={styles.headerPendingBadge}>
                                <Text style={styles.headerPendingText}>{unsyncedCount}</Text>
                            </View>
                        )}
                        <TouchableOpacity style={styles.headerIconButton} onPress={viewHistory}>
                            <MaterialIcons name="history" size={22} color="#1b7f74" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text
                    style={[
                        styles.cacheHint,
                        requiresOnlinePush && styles.cacheHintStale,
                    ]}
                >
                    {unsyncedCount > 0
                        ? requiresOnlinePush
                            ? `${unsyncedCount} pending record${unsyncedCount === 1 ? "" : "s"} — offline intake limit reached (${pendingAgeLabel}). Go online; the header sync icon will push automatically.`
                            : `${unsyncedCount} pending record${unsyncedCount === 1 ? "" : "s"} — oldest waiting ${pendingAgeLabel} (max ${offlineSyncHours}h). Use the header sync icon when online.`
                        : "No pending records waiting to push."}
                </Text>

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
                            {...getDropdownPickerModalProps("Select transporter")}
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
                            renderListItem={renderDropdownItem}
                            zIndex={DROPDOWN_STACK.transporter.zIndex}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndexInverse={DROPDOWN_STACK.transporter.zIndexInverse}
                        />
                    </View>
                    <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.shift.zIndex)]}>
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select shift")}
                            open={shiftOpen}
                            value={shiftValue}
                            items={shiftItems}
                            setOpen={(open) => {
                                setShiftOpen(open);
                                if (open) closeOtherDropdowns("shift");
                            }}
                            setValue={(val: any) => setShiftValue(val as number)}
                            setItems={setShiftItems}
                            placeholder="Select shift"
                            searchable
                            searchPlaceholder="Search shift..."
                            renderListItem={renderDropdownItem}
                            zIndex={DROPDOWN_STACK.shift.zIndex}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndexInverse={DROPDOWN_STACK.shift.zIndexInverse}
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.route.zIndex)]}>
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select route")}
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
                                clearRouteCenterSelection();
                            }}
                            setItems={setRouteItems}
                            placeholder="Select route"
                            searchable
                            searchPlaceholder="Search route..."
                            renderListItem={renderDropdownItem}
                            zIndex={DROPDOWN_STACK.route.zIndex}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndexInverse={DROPDOWN_STACK.route.zIndexInverse}
                        />
                    </View>
                    <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.center.zIndex)]}>
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select route center")}
                            open={centerOpen}
                            value={centerValue}
                            items={centerItems}
                            setOpen={(open) => {
                                setCenterOpen(open);
                                if (open) closeOtherDropdowns("center");
                            }}
                            setValue={(val: any) => {
                                setCenterValue(val as number);
                                const sel = (commonData.route_centers || []).find(
                                    (c: any) => c.id === val
                                );
                                if (sel) {
                                    setCenter({
                                        id: sel.id,
                                        center: getRouteCenterDisplayName(sel),
                                    });
                                }
                            }}
                            setItems={setCenterItems}
                            placeholder={
                                !routeValue
                                    ? "Select route first"
                                    : centerItems.length === 0
                                      ? "No centers for this route"
                                      : "Select route center"
                            }
                            searchable
                            searchPlaceholder="Search center..."
                            disabled={!routeValue || centerItems.length === 0}
                            renderListItem={renderDropdownItem}
                            zIndex={DROPDOWN_STACK.center.zIndex}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndexInverse={DROPDOWN_STACK.center.zIndexInverse}
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.can.zIndex)]}>
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select can")}
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
                                    setMeasuringCanValue(sel.id);
                                    setMeasuringCan(sel);
                                }
                            }}
                            setItems={setCanItems}
                            placeholder="Select can"
                            searchable
                            searchPlaceholder="Search can..."
                            renderListItem={renderDropdownItem}
                            zIndex={DROPDOWN_STACK.can.zIndex}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndexInverse={DROPDOWN_STACK.can.zIndexInverse}
                        />
                    </View>
                    <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.measuringCan.zIndex)]}>
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select measuring can")}
                            open={measuringCanOpen}
                            value={measuringCanValue}
                            items={measuringCanItems}
                            setOpen={(open) => {
                                setMeasuringCanOpen(open);
                                if (open) closeOtherDropdowns("measuringCan");
                            }}
                            setValue={(val: any) => {
                                setMeasuringCanValue(val as number);
                                const sel = (commonData.cans || []).find((c: any) => c.id === val);
                                if (sel) setMeasuringCan(sel);
                            }}
                            setItems={setMeasuringCanItems}
                            placeholder="Measuring Can"
                            searchable
                            searchPlaceholder="Search measuring can..."
                            renderListItem={renderDropdownItem}
                            zIndex={DROPDOWN_STACK.measuringCan.zIndex}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndexInverse={DROPDOWN_STACK.measuringCan.zIndexInverse}
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.member.zIndex)]}>
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select member")}
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
                                if (sel) setMember(sel);
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
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndexInverse={DROPDOWN_STACK.member.zIndexInverse}
                        />
                    </View>
                </View>

                <View style={styles.contentBelowDropdowns}>
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Scale</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Scale Wt"
                                value={
                                    connectedScaleDevice
                                        ? scaleWeight !== null &&
                                          scaleWeight !== undefined &&
                                          !isNaN(scaleWeight)
                                            ? scaleWeight.toFixed(2)
                                            : ""
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
                                            setScaleWeight(!isNaN(parsed) ? parsed : null);
                                        }
                                    }
                                }}
                            />
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Tare Wt</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Tare Wt"
                                value={
                                    measuringCan
                                        ? getMilkCanTare(measuringCan).toFixed(2)
                                        : "0.00"
                                }
                                editable={false}
                            />
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Net</Text>
                            <Text style={styles.value}>
                                {(() => {
                                    if (
                                        scaleWeight !== null &&
                                        scaleWeight !== undefined &&
                                        measuringCan &&
                                        isFinite(scaleWeight) &&
                                        scaleWeight >= 0
                                    ) {
                                        const net = scaleWeight - getMilkCanTare(measuringCan);
                                        if (isFinite(net) && net >= 0) {
                                            return `${net.toFixed(2)} KG`;
                                        }
                                    }
                                    return "--";
                                })()}
                            </Text>
                        </View>
                    </View>

                    {!connectedScaleDevice && (
                        <View style={styles.bluetoothReminder}>
                            <MaterialIcons name="bluetooth" size={16} color="#F59E0B" />
                            <Text style={styles.bluetoothReminderText}>
                                Ensure Bluetooth is enabled before connecting to a scale.
                            </Text>
                        </View>
                    )}

                    <View style={styles.bluetoothStatus}>
                        {connectedScaleDevice ? (
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                                <View style={styles.connectedDot} />
                                <Text style={styles.connectedText}>
                                    Connected: {connectedScaleDevice?.name || "Scale"}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.disconnectedText}>No scale connected</Text>
                        )}
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: "#facc15" }]}
                            onPress={() => setScaleModalVisible(true)}
                        >
                            <Text style={[styles.buttonText, { color: "#000" }]}>
                                {connectedScaleDevice ? "Change Scale" : "Connect Scale"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.button} onPress={takeWeight}>
                            <Text style={styles.buttonText}>Take Record</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ marginVertical: 16 }}>
                        <Text style={{ fontWeight: "bold" }}>Recorded Cans: {entries.length}</Text>
                        {entries.map((entry, idx) => (
                            <View key={idx} style={styles.entryRow}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.entryText}>
                                        {entry.member_label ? `${entry.member_label} - ` : ""}
                                        Can ({entry.can_label}) - Gross: {entry.scale_weight} - Tare:{" "}
                                        {entry.tare_weight} - Net: {entry.net}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => removeEntry(idx)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (loading || isCollectionBlocked) && styles.submitButtonDisabled,
                        ]}
                        onPress={saveCollection}
                        disabled={loading || isCollectionBlocked}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitText}>Save Collection</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={{ height: 24 }} />
            </ScrollView>

            <Modal
                visible={requiresOnlinePush && !isOnline && !isSyncing}
                transparent
                animationType="fade"
                onRequestClose={() => {}}
            >
                <View style={styles.staleBlockOverlay}>
                    <View style={styles.staleBlockCard}>
                        <MaterialIcons name="wifi-off" size={42} color="#dc2626" />
                        <Text style={styles.staleBlockTitle}>Go online to push</Text>
                        <Text style={styles.staleBlockMessage}>
                            {mandatorySyncError ||
                                `You have ${unsyncedCount} pending record${unsyncedCount === 1 ? "" : "s"}. The maximum offline intake time (${offlineSyncHours} hour${offlineSyncHours === 1 ? "" : "s"} since the first record) has been reached. Turn on WiFi or mobile data — the header sync icon will push your records automatically.`}
                        </Text>
                    </View>
                </View>
            </Modal>

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
                loadingMessage={isPrinting ? "Printing receipts..." : undefined}
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
                                    {collection.summary_label || collection.endpoint}
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
                                {collection.endpoint} · {collection.method}
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
    container: { flex: 1, backgroundColor: "#fff" },
    scrollContent: { padding: 16 },
    toolbarRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    toolbarTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111827",
    },
    toolbarActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerIconButton: {
        padding: 8,
    },
    headerPendingBadge: {
        backgroundColor: "#F59E0B",
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
        marginRight: 4,
    },
    headerPendingText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
    },
    cacheHint: {
        fontSize: 12,
        color: "#1E40AF",
        marginBottom: 12,
        lineHeight: 18,
    },
    cacheHintStale: {
        color: "#B91C1C",
        backgroundColor: "#FEE2E2",
        padding: 10,
        borderRadius: 6,
    },
    blockedContent: {
        opacity: 0.45,
    },
    staleBlockOverlay: {
        flex: 1,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    staleBlockCard: {
        width: "100%",
        maxWidth: 360,
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 24,
        alignItems: "center",
    },
    staleBlockTitle: {
        marginTop: 16,
        fontSize: 20,
        fontWeight: "700",
        color: "#111827",
        textAlign: "center",
    },
    staleBlockMessage: {
        marginTop: 12,
        fontSize: 15,
        lineHeight: 22,
        color: "#4B5563",
        textAlign: "center",
    },
    staleBlockButton: {
        marginTop: 20,
        backgroundColor: "#1b7f74",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    staleBlockButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 15,
    },
    cacheWarning: {
        fontSize: 12,
        color: "#92400E",
        marginBottom: 12,
        lineHeight: 18,
        backgroundColor: "#FEF3C7",
        padding: 10,
        borderRadius: 6,
    },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    col: { flex: 1, marginHorizontal: 4 },
    contentBelowDropdowns: { zIndex: 1, elevation: 1 },
    label: { fontSize: 14, marginBottom: 6, color: "#333" },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        padding: 8,
        borderRadius: 6,
        backgroundColor: "#fff",
    },
    value: { fontSize: 16, fontWeight: "600", marginTop: 8 },
    buttonRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    button: {
        backgroundColor: "#2563eb",
        padding: 12,
        borderRadius: 6,
        minWidth: 140,
        alignItems: "center",
    },
    buttonText: { color: "#fff", fontWeight: "600" },
    submitButton: {
        backgroundColor: "#16a34a",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 12,
    },
    submitButtonDisabled: { opacity: 0.6 },
    submitText: { color: "#fff", fontWeight: "700" },
    entryRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        backgroundColor: "#F9FAFB",
        borderRadius: 6,
        marginBottom: 8,
    },
    entryText: { fontSize: 13, color: "#374151" },
    bluetoothReminder: {
        marginVertical: 6,
        padding: 8,
        backgroundColor: "#FEF3C7",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#F59E0B",
        flexDirection: "row",
        alignItems: "center",
    },
    bluetoothReminderText: {
        marginLeft: 6,
        color: "#92400E",
        fontSize: 12,
        flex: 1,
    },
    bluetoothStatus: {
        marginVertical: 6,
        padding: 8,
        backgroundColor: "#f8fafc",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    connectedDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#22c55e",
        marginRight: 6,
    },
    connectedText: { color: "#22c55e", fontWeight: "600", fontSize: 12 },
    disconnectedText: { color: "#ef4444", fontWeight: "500", fontSize: 12, textAlign: "center" },
    historyItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
    },
    historyHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    historyMember: { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1 },
    historyDetails: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
    historyDate: { fontSize: 12, color: "#9CA3AF" },
    syncBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    syncBadgeText: { fontSize: 11, fontWeight: "600" },
});

