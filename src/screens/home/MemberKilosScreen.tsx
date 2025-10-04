import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Keyboard,
    TouchableWithoutFeedback
} from "react-native";
import ConnectScaleModal from "../../components/modals/ConnectScaleModal";
import useBluetoothClassic from "../../hooks/useBluetoothService.ts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import fetchCommonData from "../../components/utils/fetchCommonData.ts";
import makeRequest from "../../components/utils/makeRequest.ts";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all.tsx";

const MemberKilosScreen = () => {
    const [modalVisible, setModalVisible] = useState(false);
    const [can, setCan] = useState<any>({});
    const [totalCans, setTotalCans] = useState<number>(0);
    const [grossWeight, setGrossWeight] = useState("");
    const [scaleWeight, setScaleWeight] = useState<number | null>(null);
    const [totalQuantity, setTotalQuantity] = useState<number | null>(null);
    const [transporter, setTransporter] = useState<any>(null);
    const [route, setRoute] = useState<any>(null);
    const [center, setCenter] = useState<any>(null);
    const [shift, setShift] = useState<any>(null);
    const [member, setMember] = useState<any>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const deviceUid = null;
    const [commonData, setCommonData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<any>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState(
        commonData.transporters?.map((t: any) => ({ label: t.full_names, value: t.id })) || []
    );
    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [shiftItems, setShiftItems] = useState(
        commonData.shifts?.map((s: any) => ({ label: s.name, value: s.id })) || []
    );
    const [canOpen, setCanOpen] = useState(false);
    const [canValue, setCanValue] = useState<number | null>(null);
    const [canItems, setCanItems] = useState(
        commonData.cans?.map((c: any) => ({ label: c.can_id || `Can ${c.id}`, value: c.id })) || []
    );

    const [memberOpen, setMemberOpen] = useState(false);
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState(
        commonData.members?.map((m: any) => ({ label: `${m.first_name} ${m.last_name}`, value: m.id })) || []
    );

    // Dropdown states for routes
    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [routeItems, setRouteItems] = useState(
        commonData.routes?.map((r: any) => ({ label: r.route_name, value: r.id })) || []
    );
    // Dropdown states for centers
    const [centerOpen, setCenterOpen] = useState(false);
    const [centerValue, setCenterValue] = useState<number | null>(null);
    const [centerItems, setCenterItems] = useState(
        commonData.centers?.map((c: any) => ({ label: c.centre, value: c.id })) || []
    );
    const {
        devices,
        connectedDevice,
        lastMessage,
        scanForDevices,
        connectToDevice,
    } = useBluetoothClassic();

    // load cached commonData
    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [transporters, routes, shifts, members, cans, centers] = await Promise.all([
                    fetchCommonData({ name: "transporters" }),
                    fetchCommonData({ name: "routes" }),
                    fetchCommonData({ name: "shifts" }),
                    fetchCommonData({ name: "members" }),
                    fetchCommonData({ name: "cans" }),
                    fetchCommonData({ name: "centers" }),
                ]);
                const allData = { transporters, routes, shifts, members, cans, centers };
                setCommonData(allData);
            } catch (error: any) {
                Alert.alert("Error", 'Failed to load common data');
            }
        };

        loadCommonData();
    }, []);

    // when setting canItems, mark as disabled if already used in entries
    useEffect(() => {
        if (!commonData) return;
        setTransporterItems(
            (commonData?.transporters || []).map((t: any) => ({
                label: t.full_names,
                value: t.id,
            }))
        );

        setRouteItems(
            (commonData?.routes || []).map((r: any) => ({
                label: `${r.route_name}(${r.route_code})`,
                value: r.id,
            }))
        );

        setShiftItems(
            (commonData?.shifts || []).map((s: any) => ({
                label: s.name,
                value: s.id,
            }))
        );

        setMemberItems(
            (commonData?.members || []).map((m: any) => ({
                label: `${m.first_name} ${m.last_name}`,
                value: m.id,
            }))
        );

        setCanItems(
            (commonData?.cans || []).map((c: any) => ({
                label: c.can_id || `Can ${c.id}`,
                value: c.id,
                disabled: entries.some((e) => e.can_id === c.id), // 🔑 disable if already picked
            }))
        );
        setCenterItems(
            (commonData?.centers || []).map((c: any) => ({
                label: c.centre,
                value: c.id,
            }))
        );
    }, [commonData, entries]); // 👈 re-run when entries change

    useEffect(() => {
        if (!commonData?.centers) return;
        if (route?.id) {
            // filter by route_id
            const filtered = commonData?.centers
                .filter((c: any) => c.route_id === route.id)
                .map((c: any) => ({
                    label: c.centre,
                    value: c.id,
                }));

            setCenterItems(filtered);
        } else {
            // reset if no route selected
            setCenterItems([]);
            setCenter(null);
            setCenterValue(null);
        }
    }, [commonData, route]);

    useEffect(() => {
        if (lastMessage) {
            const parsed = parseFloat(lastMessage);
            if (!isNaN(parsed)) {
                setScaleWeight(parsed);
                setGrossWeight(lastMessage);
            }
        }
    }, [lastMessage]);

    const sendMemberKilos = async () => {
        const requiredFields = [
            { field: transporter, name: "transporter" },
            { field: route, name: "route" },
            { field: member, name: "member" },
            { field: shift, name: "shift" },
            { field: center, name: "center" },
        ];

        const missing = requiredFields.find(r => !r.field);
        if (missing) {
            Alert.alert("Missing Data", `Please select a ${missing.name}.`);
            return;
        }

        if (entries.length === 0) {
            Alert.alert("Missing Data", "Please add at least one can entry.");
            return;
        }
        setLoading(true);
        try {
            const payload = {
                cans: entries,
                total_cans: entries.length,
                total_quantity: entries.reduce((sum, e) => sum + e.net, 0),
                device_uid: connectedDevice?.id || null,
                is_manual_entry: !connectedDevice,
                transporter_id: transporter?.id || null,
                center_id: center?.id || null,
                route_id: route?.id || null,
                shift_id: shift?.id || null,
                member_id: member?.id || null,
            };
            console.log("📤 Sending payload:", payload);

            const [status, response] = await makeRequest({
                url: "member-kilos",
                method: "POST",
                data: payload,
            });

            if (![200, 201].includes(status)) {
                Alert.alert(`Error ${status}`, response?.message || "Failed to submit data");
                return;
            }

            Alert.alert("Success", `Milk kilos for ${member.first_name} sent successfully!`);
            setEntries([]);
            setTotalCans(0);
            setMember(null);
            setMemberValue(null);
            setCan(null);
            setCanValue(null);
            setTotalQuantity(0);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to send data");
        } finally {
            setLoading(false);
        }
    };


    const takeWeight = () => {
        if (scaleWeight !== null && can?.id && typeof can.tare_weight === "number") {
            const net = scaleWeight - can.tare_weight;

            const newEntry = {
                can_id: can.id,              // ✅ always store numeric id
                can_label: can.can_id,       // (optional) keep original label if you want to display it
                tare_weight: can.tare_weight,
                scale_weight: scaleWeight,
                net,
            };

            setEntries((prev) => [...prev, newEntry]);
            setTotalQuantity((prev) => (prev ?? 0) + net);
            setTotalCans((prev) => prev + 1);

            // reset form
            setTimeout(() => {
                setScaleWeight(null);
                setGrossWeight("");
                setCan({});
                setCanValue(null); // ✅ reset selected can
            }, 1000);
        } else {
            Alert.alert("Error", "Please select a valid can and weight");
        }
    };


    // Helper function
    const handleDropdownOpen = (dropdownName: string) => {
        setTransporterOpen(dropdownName === "transporter");
        setRouteOpen(dropdownName === "route");
        setShiftOpen(dropdownName === "shift");
        setMemberOpen(dropdownName === "member");
        setCanOpen(dropdownName === "can");
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Member Kilos</Text>


            {/* Transporter Dropdown */}
            {/* <TouchableWithoutFeedback onPress={() => {
                setTransporterOpen(false);
                setRouteOpen(false);
                setShiftOpen(false);
                setMemberOpen(false);
                setCanOpen(false);
                Keyboard.dismiss();
            }}> */}
            {/* <View style={{ flex: 1, zIndex: 3000 }}> */}
            <View style={styles.row}>
                <View style={styles.col}>
                    <DropDownPicker
                        open={transporterOpen}
                        value={transporterValue}
                        items={transporterItems}
                        setOpen={setTransporterOpen}
                        setValue={setTransporterValue}
                        setItems={setTransporterItems}
                        placeholder="Select transporter"
                        searchable={true}
                        searchPlaceholder="Search transporter"
                        onChangeValue={(val) => {
                            setTransporterValue(val);
                            const selected = commonData?.transporters?.find((t: any) => t.id === val);
                            if (selected) setTransporter(selected);
                        }}
                        renderListItem={renderDropdownItem} // ✅ now works as named import
                        zIndex={5000}
                        zIndexInverse={2000}
                    />
                </View>

                <View style={styles.col}>
                    {/* Shift Dropdown */}
                    <DropDownPicker
                        open={shiftOpen}
                        value={shiftValue}
                        items={shiftItems}
                        setOpen={setShiftOpen}
                        setValue={setShiftValue}
                        setItems={setShiftItems}
                        placeholder="Select shift"
                        searchable={true}
                        searchPlaceholder="Search shift"
                        onChangeValue={(val) => {
                            setShiftValue(val);
                            const selected = commonData?.shifts?.find((s: any) => s.id === val);
                            if (selected) setShift(selected);
                        }}
                        renderListItem={renderDropdownItem} // ✅ now works as named import
                        zIndex={4500}
                        zIndexInverse={2000}
                    />
                </View>
            </View>
            <View style={styles.row}>
                {/* Route Dropdown */}
                <View style={styles.col}>
                    <DropDownPicker
                        open={routeOpen}
                        value={routeValue}
                        items={routeItems}
                        setOpen={setRouteOpen}
                        setValue={setRouteValue}
                        setItems={setRouteItems}
                        placeholder="Select route"
                        searchable={true}
                        searchPlaceholder="Search route"
                        onChangeValue={(val) => {
                            setRouteValue(val);
                            const selected = commonData?.routes?.find((r: any) => r.id === val);
                            if (selected) setRoute(selected);
                        }}
                        renderListItem={renderDropdownItem} // ✅ now works as named import
                        zIndex={4000}
                        zIndexInverse={2000}
                    />
                </View>
                {/* Center Dropdown (filtered by route) */}
                <View style={styles.col}>
                    <DropDownPicker
                        open={centerOpen}
                        value={centerValue}
                        items={centerItems}
                        setOpen={setCenterOpen}
                        setValue={setCenterValue}
                        setItems={setCenterItems}
                        placeholder="Select center"
                        searchable={true}
                        searchPlaceholder="Search center"
                        onChangeValue={(val) => {
                            setCenterValue(val);
                            const selected = centerItems.find((c: any) => c.value === val); // ✅ match value, not commonData
                            if (selected) {
                                setCenter({ id: selected.value, centre: selected.label }); // store full object
                            }
                        }}
                        renderListItem={renderDropdownItem}
                        zIndex={3500} // lower than route
                        zIndexInverse={1500}
                    />
                </View>
            </View>
            {/* Member Dropdown */}
            <View style={styles.row}>
                <View style={styles.col}>
                    <DropDownPicker
                        open={memberOpen}
                        value={memberValue}
                        items={memberItems}
                        setOpen={setMemberOpen}
                        setValue={setMemberValue}
                        setItems={setMemberItems}
                        placeholder="Select member"
                        searchable={true}
                        searchPlaceholder="Search member"
                        onChangeValue={(val) => {
                            setMemberValue(val);
                            const selected = commonData?.members?.find((m: any) => m.id === val);
                            if (selected) setMember(selected);
                        }}
                        renderListItem={renderDropdownItem} // ✅ now works as named import
                        zIndex={1000}
                        zIndexInverse={2000}
                    />
                </View>
                {/* Can Dropdown */}
                <View style={styles.col}>
                    <DropDownPicker
                        open={canOpen}
                        value={canValue}
                        items={canItems}
                        setOpen={setCanOpen}
                        setValue={setCanValue}
                        setItems={setCanItems}
                        placeholder="Select can"
                        searchable={true}
                        searchPlaceholder="Search can"
                        onChangeValue={(val) => {
                            setCanValue(val);
                            const selected = commonData?.cans?.find((c: any) => c.id === val);
                            if (selected) setCan(selected);
                        }}
                        renderListItem={renderDropdownItem}
                        zIndex={1000}
                        zIndexInverse={2000}
                    />
                </View>

            </View>
            {/* </View> */}
            {/* </TouchableWithoutFeedback> */}
            <View style={styles.row}>
                <View style={styles.col}>
                    <Text style={styles.label}>Scale</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Scale Wt"
                        value={scaleWeight !== null ? `${scaleWeight}` : ""}
                        keyboardType="numeric"
                        editable={!connectedDevice}
                        onChangeText={(text) => {
                            if (!connectedDevice) {
                                const num = parseFloat(text);
                                if (!isNaN(num)) setScaleWeight(num);
                            }
                        }}
                    />
                </View>

                <View style={styles.col}>
                    <Text style={styles.label}>Can{can?.id}</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Can Wt"
                        value={can?.tare_weight ? `${can?.tare_weight}` : ""}
                        editable={false} // never editable
                    />
                </View>

                <View style={styles.col}>
                    <Text style={styles.label}>Net</Text>
                    <Text style={styles.value}>
                        {scaleWeight !== null && can?.tare_weight
                            ? `${(scaleWeight - can.tare_weight).toFixed(2)} KG`
                            : "--"}
                    </Text>
                </View>
            </View>


            {
                connectedDevice && (
                    <Text>
                        Connected Device: {connectedDevice?.name} ({connectedDevice?.id})
                    </Text>
                )
            }

            {/* BUTTONS */}
            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={styles.buttonText}>
                        {connectedDevice ? "Change Scale" : "Connect Scale"}
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


            <View style={{ marginVertical: 16 }}>
                <Text style={{ fontWeight: "bold" }}>Recorded Cans: {entries?.length}</Text>
                {entries.map((e, idx) => (
                    <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 4 }}>
                        <Text>
                            Can ({e.can_label}) - Gross: {e.scale_weight} - Tare: {e.tare_weight} - Net: {e.net}
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                setEntries((prev) => prev.filter((_, i) => i !== idx));
                                setTotalCans((prev) => prev - 1);
                                setTotalQuantity((prev) => (prev ?? 0) - e.net);
                            }}
                        >
                            <Text style={{ color: "red" }}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>



            <TouchableOpacity style={styles.submitButton} onPress={sendMemberKilos}>
                <Text style={styles.submitText}>Send Kilos</Text>
            </TouchableOpacity>

            {/* MODAL */}
            <ConnectScaleModal
                visible={modalVisible}
                filterDevice="scale"
                onClose={() => setModalVisible(false)}
                devices={devices}
                scanForDevices={scanForDevices}
                onDeviceSelect={async (device) => {
                    const connected = await connectToDevice(device.id);
                    if (connected) {
                        Alert.alert("Connected", `Connected to ${connected.name}`);
                    }
                    setModalVisible(false);
                }}
            />
        </View >
    );
};

export default MemberKilosScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: "#fff"
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 20
    },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
    },
    buttonRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginVertical: 16,
    },
    button: {
        flex: 1,
        backgroundColor: "#2196F3",
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 4,
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontWeight: "bold"
    },
    submitButton: {
        backgroundColor: "green",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    submitText: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    col: {
        flex: 1,
        alignItems: "center",
        marginHorizontal: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 4
    },
    value: {
        fontSize: 16,
        fontWeight: "bold"
    },
});
