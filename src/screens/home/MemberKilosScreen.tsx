// src/screens/MemberKilosScreen.tsx
import React, { useState, useEffect, useRef } from "react";
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
import useBluetoothClassic from "../../hooks/useBluetoothService.ts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import fetchCommonData from "../../components/utils/fetchCommonData.ts";
import makeRequest from "../../components/utils/makeRequest.ts";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all.tsx";
import CashoutFormModal from "../../components/modals/CashoutFormModal.tsx";
import SuccessModal from "../../components/modals/SuccessModal.tsx";
import { printReceiptWithPrinter } from "../../components/utils/printReceipt.ts";
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
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    // --- Scale hook for weight operations ---
    const scaleBluetooth = useBluetoothClassic({ deviceType: "scale" });

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

    // Printer hook no longer needed - using direct BluetoothManager in printReceipt utility

    // Update scale weight when data is received from connected device
    useEffect(() => {
        if (lastMessage && connectedScaleDevice) {
            const weight = parseFloat(lastMessage);
            if (!isNaN(weight)) {
                setScaleWeight(weight);
                console.log(`⚖️ Scale weight updated: ${weight} KG`);
            }
        }
    }, [lastMessage, connectedScaleDevice]);

    // Auto-connect to scale on mount
    useEffect(() => {
        const connectToLastScale = async () => {
            try {
                console.log('🔌 Auto-connect starting');

                // Printer connection is handled separately when needed

                // Try to connect to scale
                const lastUsedScale = await AsyncStorage.getItem('last_device_scale');
                if (lastUsedScale) {
                    const scaleData = JSON.parse(lastUsedScale);
                    console.log('🔌 Auto-connecting to last scale:', scaleData.name || scaleData.address);
                    await connectToScaleDevice(scaleData.address);
                } else {
                    console.log('ℹ️ No last scale found in storage');
                }
            } catch (error) {
                console.error("Failed to auto-connect to scale:", error);
            }
        };
        connectToLastScale();
    }, []); // Only run once on mount

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
                const [transporters, routes, shifts, members, cans, centers, measuringCans] =
                    await Promise.all([
                        fetchCommonData({ name: "transporters" }),
                        fetchCommonData({ name: "routes" }),
                        fetchCommonData({ name: "shifts" }),
                        fetchCommonData({ name: "members", cachable: false }),
                        fetchCommonData({ name: "cans" }),
                        fetchCommonData({ name: "centers" }),
                        fetchCommonData({ name: "measuring_cans", cachable: false }),
                    ]);
                const allData = { transporters, routes, shifts, members, cans, centers, measuring_can: measuringCans };
                setCommonData(allData);

                // populate dropdown items
                setTransporterItems((transporters || []).map((t: any) => ({ label: t.full_names, value: t.id })));
                setShiftItems((shifts || []).map((s: any) => ({ label: s.name, value: s.id })));
                setRouteItems((routes || []).map((r: any) => ({ label: `${r.route_name} (${r.route_code})`, value: r.id })));
                setMemberItems((members || []).map((m: any) => ({ label: `${m.first_name} ${m.last_name}`, value: m.id })));
                setCanItems((cans || []).map((c: any) => ({ label: c.can_id || `Can ${c.id}`, value: c.id })));
                setMeasuringCanItems((measuringCans || []).map((c: any) => ({ label: c.can_id || `Can ${c.id}`, value: c.id })));
                setCenterItems((centers || []).map((c: any) => ({ label: c.centre, value: c.id })));
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

    // Keep selected measuring can details fully loaded
    const [measuringCan, setMeasuringCan] = useState<any | null>(null);
    useEffect(() => {
        if (measuringCanValue && Array.isArray(commonData.measuring_can)) {
            const found = commonData.measuring_can.find((c: any) => c.id === measuringCanValue);
            if (found) setMeasuringCan(found);
        }
    }, [measuringCanValue, commonData.measuring_can]);

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
        const tare = measuringCan.tare_weight; // Always use measuring can's tare
        const net = parseFloat((scaleWeight - tare).toFixed(2));
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
        setCanValue(null);
    };

    // Format receipt for member kilos
    const formatMemberKilosReceipt = (responseData: any) => {
        const selectedMember = commonData.members?.find((m: any) => m.id === memberValue);
        const selectedTransporter = commonData.transporters?.find((t: any) => t.id === transporterValue);
        const selectedShift = commonData.shifts?.find((s: any) => s.id === shiftValue);
        const selectedRoute = commonData.routes?.find((r: any) => r.id === routeValue);
        const selectedCenter = commonData.centers?.find((c: any) => c.id === centerValue);

        let receipt = "";
        receipt += "      E-DAIRY LIMITED\n";
        receipt += "      P.O. Box [P.O. Box Number]\n";
        receipt += "\n\n";
        receipt += "      MEMBER KILOS RECEIPT\n";
        receipt += "================================\n";
        receipt += `Date: ${new Date().toISOString().split("T")[0]}\n`;
        receipt += `Member: ${selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : 'N/A'}\n`;
        receipt += `Transporter: ${selectedTransporter?.full_names || 'N/A'}\n`;
        receipt += `Shift: ${selectedShift?.name || 'N/A'}\n`;
        receipt += `Route: ${selectedRoute?.route_name || 'N/A'}\n`;
        receipt += `Center: ${selectedCenter?.centre || 'N/A'}\n`;
        receipt += "--------------------------------\n";
        receipt += `Total Cans: ${totalCans}\n`;
        receipt += `Total Quantity: ${totalQuantity?.toFixed(2)} KG\n`;
        receipt += "--------------------------------\n";
        receipt += "Cans Details:\n";

        entries.forEach((entry, index) => {
            receipt += `${index + 1}. Can ${entry.can_label} - Net: ${entry.net} KG\n`;
        });

        receipt += "--------------------------------\n";
        receipt += `TOTAL NET WEIGHT: ${totalQuantity?.toFixed(2)} KG\n`;
        receipt += "================================\n";
        receipt += "Thank you for your delivery!\n";
        receipt += "================================\n";
        receipt += "Powered by eDairy.africa\n";
        receipt += "\n\n";

        return receipt;
    };

    // --- sendMemberKilos: post entries, basic error handling ---
    const sendMemberKilos = async () => {
        if (!memberValue) { Alert.alert("Validation", "Please select a member."); return; }
        if (entries.length === 0) { Alert.alert("Nothing to send", "No recorded cans to send."); return; }

        setLoading(true);
        try {
            const payload = {
                member_id: memberValue,
                transporter_id: transporterValue,
                route_id: routeValue,
                center_id: centerValue,
                shift_id: shiftValue,
                cans: entries,
                total_cans: totalCans,
                total_quantity: totalQuantity,
                is_manual_entry: !connectedScaleDevice, // 👈 automatically true if no device
                device_uid: connectedScaleDevice?.id ?? null, // 👈 include device id if connected
            };
            // Alert.alert("data center id", payload.center_id?.toString() ?? "N/A");                     
            const [status, response] = await makeRequest({
                url: "member-kilos", // adjust to your real endpoint
                method: "POST",
                data: payload as any,
            });
            if ([200, 201].includes(status)) {
                // Show success modal with loading state
                setSuccessModalVisible(true);
                setIsPrinting(true);

                // Prepare receipt text
                const receiptText = formatMemberKilosReceipt(response?.data);

                // Print receipt in the background
                try {
                    console.log('🔌 Starting print process...');

                    // Print receipt (this will handle connect, print, disconnect)
                    const printSuccess = await printReceiptWithPrinter(receiptText);

                    if (printSuccess) {
                        console.log('✅ Receipt printed successfully');
                    } else {
                        console.warn('⚠️ Printing failed or no printer configured');
                    }

                    // Reconnect to scale if there was one connected prior
                    const lastScale = await AsyncStorage.getItem('last_device_scale');
                    if (lastScale) {
                        const scaleData = JSON.parse(lastScale);
                        try {
                            console.log('🔄 Reconnecting to scale...');
                            await connectToScaleDevice(scaleData.address);
                            console.log('✅ Reconnected to scale');
                        } catch (reErr) {
                            console.warn('⚠️ Failed to reconnect to scale:', reErr);
                        }
                    }
                } catch (printerError) {
                    console.error("❌ Printer error:", printerError);
                    // Don't show error to user - just log it
                } finally {
                    setIsPrinting(false);

                    // Clear local records
                    setEntries([]);
                    setTotalCans(0);
                    setTotalQuantity(0);
                    setMemberValue(null);
                    setCanValue(null);
                    setCan(null);
                }
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
                                    setValue={(val: any) => { setCenterValue(val as number); const sel = centerItems.find((c: any) => c.value === val); if (sel) setCenter({ id: sel.value, centre: sel.label }); }}
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
                                        const sel = (commonData.measuring_can || []).find((c: any) => c.id === val);
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
                                    value={scaleWeightText}
                                    keyboardType="decimal-pad"
                                    editable={!connectedScaleDevice}
                                    onChangeText={(text) => {
                                        if (!connectedScaleDevice) {
                                            // Allow only digits and a single decimal
                                            const cleaned = text.replace(/[^0-9.]/g, "");
                                            if ((cleaned.match(/\./g) || []).length > 1) return;

                                            setScaleWeightText(cleaned);

                                            // Convert to number if valid
                                            const num = parseFloat(cleaned);
                                            if (!isNaN(num)) setScaleWeight(num);
                                            else setScaleWeight(null);
                                        }
                                    }}
                                    onBlur={() => {
                                        // Format to 2 decimals when done typing
                                        if (scaleWeight !== null) {
                                            const formatted = scaleWeight.toFixed(2);
                                            setScaleWeightText(formatted);
                                        }
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
                                        Connected: {connectedScaleDevice.name || 'Unknown Device'}
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
