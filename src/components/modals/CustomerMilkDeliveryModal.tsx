import React, { useCallback, useEffect, useRef, useState, memo } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    InteractionManager,
} from "react-native";
// @ts-ignore
import Icon from "react-native-vector-icons/MaterialIcons";
import DropDownPicker from "react-native-dropdown-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderDropdownItem } from "../../assets/styles/all";
import { globalStyles, getDropdownPickerModalProps } from "../../styles";
import { resolveDropDownPickerValue, toShiftDropdownItems } from "../../utils/dropdownItems";
import { toCustomerDropdownItems } from "../../utils/referenceDataFetch";
import { toTransporterDropdownItems } from "../../utils/transporter";
import {
    describeShiftPeriod,
    findShiftForCurrentTime,
    getCurrentShiftPeriod,
} from "../../utils/shift";
import { isAppInForeground } from "../../utils/appLifecycle";
import {
    getMeasuringCan,
    getMeasuringCans,
    initDatabase,
    saveMeasuringCan,
    saveMeasuringCans,
    insertOfflineData,
    OFFLINE_SYNC_ENDPOINTS,
    MILK_DELIVERY_SYNC_KEY,
} from "../../services/offlineDatabase";
import { normalizeMemberKilosCans } from "../../services/offlineReferenceData";
import { checkConnectivity } from "../../services/offlineSync";
import { useSync } from "../../context/SyncContext";
import {
    assertOfflineReferenceAvailable,
    getOfflineBlockedMessage,
} from "../../utils/offlineSaveGate";
import { REFERENCE_DATA_FETCH_LIMIT } from "../../utils/referenceDataFetch";
import { getMilkCanLabel, getMilkCanTare, toMilkCanDropdownItems } from "../../utils/milkCan";
import useBluetoothService from "../../hooks/useBluetoothService";
import BluetoothConnectionModal from "./BluetoothConnectionModal";
import makeRequest from "../utils/makeRequest";
import fetchCommonData from "../utils/fetchCommonData";

type CustomerMilkDeliveryModalProps = {
    visible: boolean;
    onClose: () => void;
    onSave: (formData: any) => void | Promise<void>;
    commonData: {
        customers?: any[];
        transporters?: any[];
        shifts?: any[];
    };
};

const DROPDOWN_STACK = {
    transporter: { zIndex: 4000, zIndexInverse: 1000 },
    shift: { zIndex: 3500, zIndexInverse: 1500 },
    customer: { zIndex: 3000, zIndexInverse: 2000 },
    measuringCan: { zIndex: 2500, zIndexInverse: 2500 },
} as const;

const getDropdownColStyle = (zIndex: number) => ({
    zIndex,
    elevation: zIndex / 1000,
});

const RequiredLabel = ({ children }: { children: string }) => (
    <Text style={styles.label}>
        {children}
        <Text style={styles.requiredMark}> *</Text>
    </Text>
);

type MilkDeliveryFormFieldsProps = {
    transactionDate: Date;
    transporterOpen: boolean;
    transporterValue: number | null;
    transporterItems: any[];
    transporterDisabled: boolean;
    shiftOpen: boolean;
    shiftValue: number | null;
    shiftItems: any[];
    setTransporterOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setTransporterItems: React.Dispatch<React.SetStateAction<any[]>>;
    setShiftOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setShiftValue: React.Dispatch<React.SetStateAction<number | null>>;
    setShiftItems: React.Dispatch<React.SetStateAction<any[]>>;
    closeOtherDropdowns: (current: string) => void;
    handleTransporterSelect: (val: number | null) => void;
};

const MilkDeliveryFormFields = memo(function MilkDeliveryFormFields({
    transactionDate,
    transporterOpen,
    transporterValue,
    transporterItems,
    transporterDisabled,
    shiftOpen,
    shiftValue,
    shiftItems,
    setTransporterOpen,
    setTransporterItems,
    setShiftOpen,
    setShiftValue,
    setShiftItems,
    closeOtherDropdowns,
    handleTransporterSelect,
}: MilkDeliveryFormFieldsProps) {
    return (
        <>
            <RequiredLabel>Transaction Date</RequiredLabel>
            <View style={[styles.dateField, styles.dateFieldDisabled]}>
                <Text style={styles.dateText}>
                    {transactionDate.toISOString().split("T")[0]}
                </Text>
                <Icon name="date-range" size={20} color="#9ca3af" />
            </View>

            <View style={styles.row}>
                <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.transporter.zIndex)]}>
                    <RequiredLabel>Transporter</RequiredLabel>
                    <DropDownPicker
                        {...getDropdownPickerModalProps("Select transporter")}
                        open={transporterOpen}
                        value={transporterValue}
                        items={transporterItems}
                        setOpen={(open) => {
                            setTransporterOpen(open);
                            if (open) closeOtherDropdowns("transporter");
                        }}
                        setValue={(callback) => {
                            const next = resolveDropDownPickerValue(callback, transporterValue);
                            handleTransporterSelect(next as number | null);
                        }}
                        setItems={setTransporterItems}
                        placeholder="Select transporter"
                        searchable
                        searchPlaceholder="Search transporter..."
                        disabled={transporterDisabled}
                        renderListItem={renderDropdownItem}
                        zIndex={DROPDOWN_STACK.transporter.zIndex}
                        zIndexInverse={DROPDOWN_STACK.transporter.zIndexInverse}
                        style={globalStyles.basedropdown}
                        dropDownContainerStyle={[
                            globalStyles.basedropdown,
                            globalStyles.dropdownListContainer,
                        ]}
                    />
                </View>
                <View style={[styles.col, getDropdownColStyle(DROPDOWN_STACK.shift.zIndex)]}>
                    <RequiredLabel>Shift</RequiredLabel>
                    <DropDownPicker
                        {...getDropdownPickerModalProps("Select shift")}
                        open={shiftOpen}
                        value={shiftValue}
                        items={shiftItems}
                        setOpen={(open) => {
                            setShiftOpen(open);
                            if (open) closeOtherDropdowns("shift");
                        }}
                        setValue={(callback) => {
                            const next = resolveDropDownPickerValue(callback, shiftValue);
                            setShiftValue(next as number | null);
                        }}
                        setItems={setShiftItems}
                        placeholder="Select shift"
                        searchable
                        searchPlaceholder="Search shift..."
                        renderListItem={renderDropdownItem}
                        zIndex={DROPDOWN_STACK.shift.zIndex}
                        zIndexInverse={DROPDOWN_STACK.shift.zIndexInverse}
                        style={globalStyles.basedropdown}
                        dropDownContainerStyle={[
                            globalStyles.basedropdown,
                            globalStyles.dropdownListContainer,
                        ]}
                    />
                </View>
            </View>
        </>
    );
});

const CustomerMilkDeliveryModal: React.FC<CustomerMilkDeliveryModalProps> = ({
    visible,
    onClose,
    onSave,
    commonData,
}) => {
    const [saving, setSaving] = useState(false);
    const {
        collectionGate,
        isSyncing,
        enableCollectionGateCheck,
        refreshCollectionGate,
    } = useSync();
    const { requiresOnlinePush } = collectionGate;
    const isOfflineSaveBlocked = isSyncing || requiresOnlinePush;
    const [transactionDate] = useState(new Date());
    const [deliveryNote, setDeliveryNote] = useState("");
    const [transporterDisabled, setTransporterDisabled] = useState(false);

    const [scaleWeight, setScaleWeight] = useState<number | null>(null);
    const [scaleWeightText, setScaleWeightText] = useState("");
    const [measuringCan, setMeasuringCan] = useState<any | null>(null);
    const [cans, setCans] = useState<any[]>([]);
    const [measuringCanOpen, setMeasuringCanOpen] = useState(false);
    const [measuringCanValue, setMeasuringCanValue] = useState<number | null>(null);
    const [measuringCanItems, setMeasuringCanItems] = useState<any[]>([]);
    const [scaleModalVisible, setScaleModalVisible] = useState(false);
    const isMountedRef = useRef(true);
    const autoConnectAttemptedRef = useRef(false);

    const {
        devices: scaleDevices,
        connectToDevice: connectToScaleDevice,
        scanForDevices: scanForScaleDevices,
        connectedDevice: connectedScaleDevice,
        lastMessage,
        isScanning: isScanningScale,
        isConnecting: isConnectingScale,
        disconnect: disconnectScale,
    } = useBluetoothService({ deviceType: "scale", autoConnectOnMount: false });

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const [customerOpen, setCustomerOpen] = useState(false);
    const [customerValue, setCustomerValue] = useState<number | null>(null);
    const [customerItems, setCustomerItems] = useState<any[]>([]);

    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState<any[]>([]);

    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [shiftItems, setShiftItems] = useState<any[]>([]);

    const closeOtherDropdowns = useCallback((current: string) => {
        if (current !== "customer") setCustomerOpen(false);
        if (current !== "transporter") setTransporterOpen(false);
        if (current !== "shift") setShiftOpen(false);
        if (current !== "measuringCan") setMeasuringCanOpen(false);
    }, []);

    const isAnyDropdownOpen =
        customerOpen || transporterOpen || shiftOpen || measuringCanOpen;

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
                measuring_can_tare_weight: getMilkCanTare(selected),
            });
        } catch (error) {
            console.error("[CustomerMilkDelivery] Failed to save measuring can:", error);
        }
    }, []);

    const applyMeasuringCanSelection = useCallback((selected: any) => {
        if (!selected) {
            return;
        }
        setMeasuringCanValue(selected.id);
        setMeasuringCan(selected);
    }, []);

    const handleTransporterSelect = useCallback((val: number | null) => {
        if (val == null) {
            return;
        }
        setTransporterValue(val);
    }, []);

    const applyTransporterDefaults = useCallback(
        async (transporters: any[]) => {
            let selectedId: number | null = null;

            try {
                const userDataString = await AsyncStorage.getItem("user");
                if (userDataString) {
                    const userData = JSON.parse(userDataString);
                    const userGroups: string[] = userData?.user_groups || [];

                    if (userGroups.includes("transporter") && userData?.member_id) {
                        const matchedTransporter = (transporters || []).find(
                            (t: any) => t.member_id === userData.member_id
                        );
                        if (matchedTransporter) {
                            selectedId = matchedTransporter.id;
                            if (!userGroups.includes("employee")) {
                                setTransporterDisabled(true);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("[CustomerMilkDelivery] Failed to load user for transporter defaults", error);
            }

            if (selectedId == null && transporters.length === 1) {
                selectedId = transporters[0].id;
            }

            if (selectedId != null) {
                handleTransporterSelect(selectedId);
            } else {
                setTransporterValue(null);
                setTransporterDisabled(false);
            }
        },
        [handleTransporterSelect]
    );

    useEffect(() => {
        if (!visible) {
            return;
        }

        const customers = commonData?.customers || [];
        const transporters = commonData?.transporters || [];
        const shifts = commonData?.shifts || [];

        setCustomerItems(toCustomerDropdownItems(customers));
        setTransporterItems(toTransporterDropdownItems(transporters));
        setShiftItems(toShiftDropdownItems(shifts));

        setDeliveryNote("");
        setCustomerValue(null);
        setScaleWeight(null);
        setScaleWeightText("");
        setMeasuringCan(null);
        setCans([]);
        setMeasuringCanValue(null);
        setMeasuringCanItems([]);
        setMeasuringCanOpen(false);
        setTransporterDisabled(false);

        const matchingShift = findShiftForCurrentTime(shifts);
        if (matchingShift) {
            setShiftValue(matchingShift.id);
            console.log(
                `[CustomerMilkDelivery] Auto-selected shift: ${matchingShift.name} (${describeShiftPeriod(getCurrentShiftPeriod())})`
            );
        } else {
            setShiftValue(null);
        }

        applyTransporterDefaults(transporters);
    }, [visible, commonData, applyTransporterDefaults]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        let cancelled = false;

        const loadMeasuringCans = async () => {
            try {
                await initDatabase();

                let loadedCans = normalizeMemberKilosCans(await getMeasuringCans());

                const online = await checkConnectivity();
                if (online) {
                    try {
                        const freshCans = await fetchCommonData({
                            name: "milk-cans",
                            cachable: false,
                            direct: true,
                            logContext: "CustomerMilkDelivery",
                            params: { limit: REFERENCE_DATA_FETCH_LIMIT },
                        });

                        if (Array.isArray(freshCans) && freshCans.length > 0) {
                            await saveMeasuringCans(freshCans);
                            loadedCans = normalizeMemberKilosCans(freshCans);
                        }
                    } catch (refreshError) {
                        console.warn(
                            "[CustomerMilkDelivery] Milk cans refresh failed, using SQLite cache:",
                            refreshError
                        );
                    }
                }

                if (cancelled) {
                    return;
                }

                setCans(loadedCans);
                setMeasuringCanItems(toMilkCanDropdownItems(loadedCans));

                const userDataString = await AsyncStorage.getItem("user");
                const userData = userDataString ? JSON.parse(userDataString) : null;
                const userId = userData?.member_id ?? userData?.user_id;
                const savedCan = userId ? await getMeasuringCan(userId) : null;

                if (savedCan) {
                    const matchedCan = loadedCans.find((can: any) => can.id === savedCan.id);
                    if (matchedCan) {
                        applyMeasuringCanSelection(matchedCan);
                    }
                }
            } catch (error) {
                console.error("[CustomerMilkDelivery] Failed to load measuring cans:", error);
                if (!cancelled) {
                    setCans([]);
                    setMeasuringCanItems([]);
                    setMeasuringCanValue(null);
                    setMeasuringCan(null);
                }
            }
        };

        loadMeasuringCans();

        return () => {
            cancelled = true;
        };
    }, [visible, applyMeasuringCanSelection]);

    useEffect(() => {
        if (measuringCanValue && cans.length > 0) {
            const found = cans.find((can) => can.id === measuringCanValue);
            if (found) {
                setMeasuringCan(found);
            }
        } else if (!measuringCanValue) {
            setMeasuringCan(null);
        }
    }, [measuringCanValue, cans]);

    useEffect(() => {
        if (!visible || !isMountedRef.current || !isAppInForeground()) {
            return;
        }

        try {
            if (lastMessage !== null && lastMessage !== undefined && connectedScaleDevice) {
                const weight = parseFloat(String(lastMessage));
                if (!isNaN(weight) && isFinite(weight) && weight >= 0 && weight <= 10000) {
                    setScaleWeight(weight);
                    setScaleWeightText("");
                }
            } else if (!connectedScaleDevice) {
                setScaleWeight(null);
            }
        } catch (error) {
            console.error("[CustomerMilkDelivery] Error processing scale weight:", error);
            setScaleWeight(null);
        }
    }, [lastMessage, connectedScaleDevice, visible]);

    useEffect(() => {
        if (connectedScaleDevice && visible) {
            setScaleWeightText("");
        }
    }, [connectedScaleDevice, visible]);

    useEffect(() => {
        if (!visible) {
            autoConnectAttemptedRef.current = false;
            return;
        }

        if (autoConnectAttemptedRef.current || connectedScaleDevice) {
            return;
        }

        const autoConnectToLastScale = async () => {
            if (!isMountedRef.current || connectedScaleDevice) {
                return;
            }

            autoConnectAttemptedRef.current = true;

            try {
                const lastScale = await AsyncStorage.getItem("last_device_scale");
                if (!lastScale) {
                    return;
                }

                const deviceData = JSON.parse(lastScale);
                const deviceId =
                    deviceData.id || deviceData.address || deviceData.address_or_id;
                if (!deviceId) {
                    return;
                }

                await scanForScaleDevices();
                await new Promise((resolve) => setTimeout(resolve, 2500));

                if (!isMountedRef.current || !visible) {
                    return;
                }

                await connectToScaleDevice(deviceId);
            } catch (error) {
                console.error("[CustomerMilkDelivery] Scale auto-connect failed:", error);
            }
        };

        const timeout = setTimeout(autoConnectToLastScale, 1500);
        return () => clearTimeout(timeout);
    }, [visible, connectToScaleDevice, scanForScaleDevices, connectedScaleDevice]);

    const persistLastScale = useCallback(async (device: any) => {
        if (!device) {
            return;
        }

        try {
            const payload = {
                id: device?.id || device?.address || device?.address_or_id,
                address: device?.address || device?.id || device?.address_or_id,
                name: device?.name || device?.label || "Scale",
                type: device?.type || "classic",
                saved_at: new Date().toISOString(),
            };

            if (!payload.id || !payload.address) {
                return;
            }

            await AsyncStorage.setItem("last_device_scale", JSON.stringify(payload));
        } catch (error) {
            console.error("[CustomerMilkDelivery] persistLastScale error", error);
        }
    }, []);

    const computeNetWeight = useCallback((): number | null => {
        if (scaleWeight === null || scaleWeight === undefined || !isFinite(scaleWeight) || scaleWeight < 0) {
            return null;
        }

        const tare = getMilkCanTare(measuringCan);
        const net = parseFloat((scaleWeight - tare).toFixed(2));
        if (!isFinite(net) || net <= 0) {
            return null;
        }

        return net;
    }, [scaleWeight, measuringCan]);

    const handleSave = async () => {
        if (!customerValue || !transporterValue || !shiftValue) {
            Alert.alert("Validation", "Please select customer, transporter, and shift.");
            return;
        }

        if (!measuringCan) {
            Alert.alert("Validation", "Please select a measuring can.");
            return;
        }

        if (
            scaleWeight === null ||
            scaleWeight === undefined ||
            !isFinite(scaleWeight) ||
            scaleWeight < 0
        ) {
            Alert.alert(
                "Validation",
                "Enter a valid scale weight or connect a scale before submitting."
            );
            return;
        }

        const parsedQty = computeNetWeight();
        if (parsedQty == null) {
            const tare = getMilkCanTare(measuringCan);
            Alert.alert(
                "Validation",
                `Net weight must be greater than zero. Scale: ${scaleWeight.toFixed(2)} KG, tare: ${tare.toFixed(2)} KG.`
            );
            return;
        }

        const trimmedNote = deliveryNote.trim();
        if (!trimmedNote) {
            Alert.alert("Validation", "Please enter a delivery note.");
            return;
        }

        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                customer_id: customerValue,
                transporter_id: transporterValue,
                milk_delivery_shift_id: shiftValue,
                transaction_date: transactionDate.toISOString().split("T")[0],
                quantity_accepted: parseFloat(parsedQty.toFixed(2)),
                delivery_note_number: trimmedNote,
            };

            const online = await checkConnectivity();

            if (!online) {
                if (isOfflineSaveBlocked) {
                    Alert.alert(
                        "Go Online to Push",
                        getOfflineBlockedMessage({
                            isSyncing,
                            requiresOnlinePush,
                            maxOfflineHours: Math.round(
                                collectionGate.maxOfflineIntakeMs / (60 * 60 * 1000)
                            ) || undefined,
                        })
                    );
                    return;
                }

                const moduleReady = await assertOfflineReferenceAvailable(MILK_DELIVERY_SYNC_KEY);
                if (!moduleReady.allowed) {
                    Alert.alert("Offline Unavailable", moduleReady.message || "Cannot save offline.");
                    return;
                }

                const customerLabel =
                    customerItems.find((item) => item.value === customerValue)?.label ||
                    `Customer #${customerValue}`;

                await insertOfflineData({
                    endpoint: OFFLINE_SYNC_ENDPOINTS.MILK_DELIVERIES,
                    data: payload,
                    summary_label: customerLabel,
                });

                enableCollectionGateCheck();
                await refreshCollectionGate();

                onClose();
                setTimeout(() => {
                    InteractionManager.runAfterInteractions(() => {
                        void onSave({ offline: true, ...payload, summary_label: customerLabel });
                    });
                }, 300);
                return;
            }

            const [status, response] = await makeRequest({
                url: "milk-deliveries",
                method: "POST",
                data: payload,
            });

            if (![200, 201].includes(status)) {
                const message =
                    typeof response?.message === "string"
                        ? response.message
                        : typeof response?.error === "string"
                          ? response.error
                          : "Failed to save milk delivery";
                console.error("[MilkDelivery] Online save failed:", {
                    status,
                    payload,
                    response,
                });
                Alert.alert("Error", message);
                return;
            }

            const savedData = response?.data ?? response;
            onClose();
            setTimeout(() => {
                InteractionManager.runAfterInteractions(() => {
                    void onSave(savedData);
                });
            }, 300);
        } catch (err: any) {
            console.error("[MilkDelivery] Online save error:", err);
            Alert.alert("Error", err?.message || "Failed to save milk delivery");
        } finally {
            if (isMountedRef.current) {
                setSaving(false);
            }
        }
    };

    const netWeightDisplay = (() => {
        const net = computeNetWeight();
        return net !== null ? `${net.toFixed(2)} KG` : "--";
    })();

    const handleScaleConnect = useCallback(
        async (deviceId: string) => {
            setScaleModalVisible(false);
            await new Promise((resolve) => setTimeout(resolve, 300));

            const result = await connectToScaleDevice(deviceId);
            if (result) {
                const connectedDevice = scaleDevices?.find(
                    (d) => d.id === deviceId || d.address === deviceId
                );
                if (connectedDevice) {
                    await persistLastScale(connectedDevice);
                }
            }
            return result;
        },
        [connectToScaleDevice, persistLastScale, scaleDevices]
    );

    return (
        <>
        <Modal visible={visible} animationType="slide" transparent={false}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <View style={styles.fullModal}>
                    <View style={styles.headerWrapper}>
                        <View style={styles.header}>
                            <Text style={styles.title}>New Milk Delivery</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Icon name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.contentScroll}
                        contentContainerStyle={styles.contentContainer}
                        keyboardShouldPersistTaps="always"
                        scrollEnabled={!isAnyDropdownOpen}
                        onScrollBeginDrag={() => {
                            if (customerOpen) setCustomerOpen(false);
                            if (transporterOpen) setTransporterOpen(false);
                            if (shiftOpen) setShiftOpen(false);
                            if (measuringCanOpen) setMeasuringCanOpen(false);
                        }}
                    >
                        <MilkDeliveryFormFields
                            transactionDate={transactionDate}
                            transporterOpen={transporterOpen}
                            transporterValue={transporterValue}
                            transporterItems={transporterItems}
                            transporterDisabled={transporterDisabled}
                            shiftOpen={shiftOpen}
                            shiftValue={shiftValue}
                            shiftItems={shiftItems}
                            setTransporterOpen={setTransporterOpen}
                            setTransporterItems={setTransporterItems}
                            setShiftOpen={setShiftOpen}
                            setShiftValue={setShiftValue}
                            setShiftItems={setShiftItems}
                            closeOtherDropdowns={closeOtherDropdowns}
                            handleTransporterSelect={handleTransporterSelect}
                        />

                        <View style={styles.row}>
                            <View
                                style={[
                                    styles.col,
                                    getDropdownColStyle(DROPDOWN_STACK.customer.zIndex),
                                ]}
                            >
                                <RequiredLabel>Customer</RequiredLabel>
                                <DropDownPicker
                                    {...getDropdownPickerModalProps("Select customer")}
                                    open={customerOpen}
                                    value={customerValue}
                                    items={customerItems}
                                    setOpen={(open) => {
                                        setCustomerOpen(open);
                                        if (open) closeOtherDropdowns("customer");
                                    }}
                                    setValue={(callback) => {
                                        const next = resolveDropDownPickerValue(
                                            callback,
                                            customerValue
                                        );
                                        setCustomerValue(next as number | null);
                                    }}
                                    setItems={setCustomerItems}
                                    placeholder="Select customer"
                                    searchable
                                    searchPlaceholder="Search customer..."
                                    renderListItem={renderDropdownItem}
                                    zIndex={DROPDOWN_STACK.customer.zIndex}
                                    zIndexInverse={DROPDOWN_STACK.customer.zIndexInverse}
                                    style={globalStyles.basedropdown}
                                    dropDownContainerStyle={[
                                        globalStyles.basedropdown,
                                        globalStyles.dropdownListContainer,
                                    ]}
                                />
                            </View>
                            <View style={styles.col}>
                                <RequiredLabel>Delivery Note</RequiredLabel>
                                <TextInput
                                    style={[styles.input, styles.noteInputCompact]}
                                    placeholder="Enter delivery note"
                                    value={deliveryNote}
                                    onChangeText={setDeliveryNote}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                    editable={!saving}
                                />
                            </View>
                        </View>

                        <View style={getDropdownColStyle(DROPDOWN_STACK.measuringCan.zIndex)}>
                            <RequiredLabel>Measuring Can</RequiredLabel>
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
                                    const selected = cans.find((can) => can.id === val);
                                    if (selected) {
                                        setMeasuringCan(selected);
                                        persistSelectedMilkCan(selected);
                                    }
                                }}
                                setItems={setMeasuringCanItems}
                                placeholder="Measuring Can"
                                searchable
                                searchPlaceholder="Search measuring can..."
                                disabled={measuringCanItems.length === 0 || saving}
                                renderListItem={renderDropdownItem}
                                zIndex={DROPDOWN_STACK.measuringCan.zIndex}
                                zIndexInverse={DROPDOWN_STACK.measuringCan.zIndexInverse}
                                style={globalStyles.basedropdown}
                                dropDownContainerStyle={[
                                    globalStyles.basedropdown,
                                    globalStyles.dropdownListContainer,
                                ]}
                            />
                        </View>

                        <RequiredLabel>Quantity (KG)</RequiredLabel>
                        <View style={styles.row}>
                            <View style={styles.col}>
                                <Text style={styles.fieldLabel}>Scale</Text>
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
                                    editable={!connectedScaleDevice && !saving}
                                    onChangeText={(text) => {
                                        if (connectedScaleDevice) {
                                            return;
                                        }

                                        const cleaned = text.replace(/[^0-9.]/g, "");
                                        if ((cleaned.match(/\./g) || []).length > 1) {
                                            return;
                                        }

                                        setScaleWeightText(cleaned);

                                        if (cleaned === "" || cleaned === ".") {
                                            setScaleWeight(null);
                                        } else {
                                            const parsed = parseFloat(cleaned);
                                            setScaleWeight(!isNaN(parsed) ? parsed : null);
                                        }
                                    }}
                                />
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.fieldLabel}>Tare Wt</Text>
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
                                <Text style={styles.fieldLabel}>Net</Text>
                                <Text style={styles.netValue}>{netWeightDisplay}</Text>
                            </View>
                        </View>

                        {!connectedScaleDevice && (
                            <View style={styles.bluetoothReminder}>
                                <Icon name="bluetooth" size={16} color="#F59E0B" />
                                <Text style={styles.bluetoothReminderText}>
                                    Ensure Bluetooth is enabled before connecting to a scale.
                                </Text>
                            </View>
                        )}

                        <View style={styles.scaleStatus}>
                            {isConnectingScale && !connectedScaleDevice ? (
                                <View style={styles.scaleStatusRow}>
                                    <ActivityIndicator size="small" color="#3b82f6" />
                                    <Text style={styles.scaleStatusText}>Connecting to scale...</Text>
                                </View>
                            ) : isScanningScale ? (
                                <View style={styles.scaleStatusRow}>
                                    <ActivityIndicator size="small" color="#3b82f6" />
                                    <Text style={styles.scaleStatusText}>Scanning for devices...</Text>
                                </View>
                            ) : connectedScaleDevice ? (
                                <View style={styles.scaleStatusRow}>
                                    <View style={styles.connectedDot} />
                                    <Text style={styles.scaleConnectedText}>
                                        Connected:{" "}
                                        {connectedScaleDevice?.name ||
                                            connectedScaleDevice?.address ||
                                            "Scale"}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setScaleModalVisible(true)}
                                        disabled={saving}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={styles.scaleLinkText}>Change</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.scaleStatusRow}>
                                    <View style={styles.disconnectedDot} />
                                    <Text style={styles.scaleDisconnectedText}>
                                        No scale connected
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setScaleModalVisible(true)}
                                        disabled={saving}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={styles.scaleLinkText}>Connect Scale</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onClose}
                            disabled={saving}
                        >
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton, saving && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Submit</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>

        <BluetoothConnectionModal
            visible={visible && scaleModalVisible}
            onClose={() => setScaleModalVisible(false)}
            type="device-list"
            deviceType="scale"
            title="Select Scale Device"
            message="Make sure Bluetooth is enabled and location permissions are granted for device scanning."
            devices={scaleDevices}
            connectToDevice={handleScaleConnect}
            scanForDevices={async () => {
                await scanForScaleDevices();
            }}
            isScanning={isScanningScale}
            isConnecting={isConnectingScale}
            connectedDevice={connectedScaleDevice}
            disconnect={disconnectScale}
        />
        </>
    );
};

export default CustomerMilkDeliveryModal;

const styles = StyleSheet.create({
    fullModal: { flex: 1, backgroundColor: "#fff" },
    headerWrapper: { backgroundColor: "#1b7f74" },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
    },
    title: { fontSize: 20, fontWeight: "bold", color: "#fff" },
    contentScroll: { flex: 1 },
    contentContainer: { padding: 16, paddingBottom: 24 },
    row: { flexDirection: "row", gap: 12 },
    col: { flex: 1 },
    label: { fontSize: 14, marginBottom: 6, marginTop: 12, color: "#333" },
    requiredMark: { color: "#dc2626" },
    dateField: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 6,
        padding: 10,
        marginTop: 0,
    },
    dateFieldDisabled: {
        backgroundColor: "#f3f4f6",
        borderColor: "#e5e7eb",
    },
    dateText: { color: "#6b7280" },
    input: {
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 6,
        padding: 10,
        fontSize: 16,
        color: "#111827",
        backgroundColor: "#fff",
    },
    noteInput: {
        minHeight: 80,
    },
    noteInputCompact: {
        minHeight: 42,
        flex: 1,
    },
    fieldLabel: {
        fontSize: 14,
        marginBottom: 6,
        color: "#333",
    },
    scaleLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    scaleLinkText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#2563eb",
        marginLeft: 8,
    },
    netValue: {
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 6,
        padding: 10,
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
        backgroundColor: "#f9fafb",
        minHeight: 42,
        textAlignVertical: "center",
    },
    bluetoothReminder: {
        marginTop: 8,
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
    scaleStatus: {
        marginTop: 8,
        padding: 8,
        backgroundColor: "#f8fafc",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    scaleStatusRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
    },
    scaleStatusText: {
        marginLeft: 6,
        color: "#3b82f6",
        fontWeight: "500",
        fontSize: 12,
    },
    connectedDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#22c55e",
        marginRight: 6,
    },
    disconnectedDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#ef4444",
        marginRight: 6,
    },
    scaleConnectedText: { color: "#22c55e", fontWeight: "600", fontSize: 12 },
    scaleChangeText: {
        marginLeft: 8,
        color: "#2563eb",
        fontSize: 10,
        fontWeight: "500",
        textDecorationLine: "underline",
    },
    scaleDisconnectedText: { color: "#ef4444", fontWeight: "500", fontSize: 12 },
    actions: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: "#eee",
    },
    button: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginHorizontal: 6,
    },
    cancelButton: { backgroundColor: "#6b7280" },
    saveButton: { backgroundColor: "#16a34a" },
    buttonText: { color: "#fff", fontWeight: "600" },
});
