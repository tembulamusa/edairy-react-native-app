import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from "react-native";
import ConnectScaleModal from "../../components/modals/ConnectScaleModal";
import useBluetoothClassic from "../../hooks/useBluetoothService.ts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import fetchCommonData from "../../components/utils/fetchCommonData.ts";
import makeRequest from "../../components/utils/makeRequest.ts";
import DropDownPicker from "react-native-dropdown-picker";

const MemberKilosScreen = () => {
    const [modalVisible, setModalVisible] = useState(false);
    const [can, setCan] = useState<any>({});
    const [totalCans, setTotalCans] = useState<number>(0);
    const [grossWeight, setGrossWeight] = useState("");
    const [scaleWeight, setScaleWeight] = useState<number | null>(null);
    const [totalQuantity, setTotalQuantity] = useState<number | null>(null);
    const [transporter, setTransporter] = useState<any>(null);
    const [route, setRoute] = useState<any>(null);
    const [shift, setShift] = useState<any>(null);
    const [member, setMember] = useState<any>(null);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const deviceUid = null;
    const [commonData, setCommonData] = useState<any>({ cans: [{ name: "Can 1", id: 1, weight: 3.00 }, { name: "Can 2", id: 2, weight: 2.50 }], transporters: [{ name: "reuben", id: 1, idNo: 123 }, { name: "john", id: 2, idNo: 456 }] });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<any>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Dropdown states
    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState(
        commonData.transporters?.map((t: any) => ({ label: t.name, value: t.id })) || []
    );

    // dropdown for states shifts
    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [shiftItems, setShiftItems] = useState(
        commonData.shifts?.map((s: any) => ({ label: s.name, value: s.id })) || []
    );
    // Dropdown states for Cans
    const [canOpen, setCanOpen] = useState(false);
    const [canValue, setCanValue] = useState<number | null>(null);
    const [canItems, setCanItems] = useState(
        commonData.cans?.map((c: any) => ({ label: c.name || `Can ${c.id}`, value: c.id })) || []
    );

    // Dropdown states for Members
    const [memberOpen, setMemberOpen] = useState(false);
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState(
        commonData.members?.map((m: any) => ({ label: m.name, value: m.id })) || []
    );

    // Dropdown states for routes
    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [routeItems, setRouteItems] = useState(
        commonData.routes?.map((r: any) => ({ label: r.name, value: r.id })) || []
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
            const data = await AsyncStorage.getItem("commonData");
            if (data) {
                setCommonData(JSON.parse(data));
            }
        };
        loadCommonData();
    }, []);

    // update weight when message changes
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
        setLoading(true);
        try {
            const payload = {
                can,
                total_cans: totalCans,
                total_weight: totalQuantity,
                device_uid: connectedDevice?.id || null,
                is_manual_entry: !connectedDevice,
                transporter_id: transporter?.id || null,
                route_id: route?.id || null,
                shift_id: shift?.id || null,
                member_id: member?.id || null,
                can_id: can?.id || null,
            };
            console.log("📤 Sending payload:", payload);

            const [status, response] = await makeRequest({
                url: "member-kilos",
                method: "POST",
                data: payload,
            });

            if (![200, 201].includes(status)) {
                const msg = response?.message || "Failed to submit data";

                Alert.alert("Error", msg);
                return;
            }
            Alert.alert("Success", "Pretend submitted successfully");
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to send data");
        } finally {
            setLoading(false);
        }
    };

    const takeWeight = () => {
        if (scaleWeight !== null) {
            if (can && typeof can.weight === "number" && !isNaN(can.weight)) {
                const net = scaleWeight - can.weight;
                setTotalQuantity((prev) => (prev ?? 0) + net);
                setTotalCans((prev) => prev + 1);
            } else {
                Alert.alert("Error", "Please enter a valid can with weight");
            }

            // reset after 3s
            setTimeout(() => {
                setScaleWeight(null);
                setGrossWeight("");
                setCan({});
            }, 3000);
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
            <View style={styles.row}>
                <View style={styles.col}>
                    <DropDownPicker
                        open={transporterOpen}
                        value={transporterValue}
                        items={transporterItems}
                        setOpen={(val) => val && handleDropdownOpen("transporter")}
                        setValue={(val) => {
                            setTransporterValue(val);
                            const selected = commonData.transporters.find((t: any) => t.id === val);
                            if (selected) setTransporter(selected);
                            setTransporterOpen(false);
                        }} setItems={setTransporterItems}
                        searchable={true}
                        searchPlaceholder="Search transporter"
                        placeholder="Select transporter"
                        zIndex={3000}
                        zIndexInverse={1000}
                    />
                </View>
                {/* Route Dropdown */}
                <View style={styles.col}>
                    <DropDownPicker
                        open={routeOpen}
                        value={routeValue}
                        items={routeItems}
                        setOpen={(val) => val && handleDropdownOpen("route")}
                        setValue={(val) => {
                            setRouteValue(val);
                            const selected = commonData.routes.find((r: any) => r.id === val);
                            if (selected) setRoute(selected);
                            setRouteOpen(false);
                        }} setItems={setRouteItems}
                        searchable={true}
                        searchPlaceholder="Search route"
                        placeholder="Select route"
                        zIndex={3000}
                        zIndexInverse={1000}
                    />
                </View>
            </View>
            <View style={styles.row}>
                <View style={styles.col}>
                    {/* Shift Dropdown */}
                    <DropDownPicker
                        open={shiftOpen}
                        value={shiftValue}
                        items={shiftItems}
                        setOpen={(val) => val && handleDropdownOpen("shift")}
                        setValue={(val) => {
                            setShiftOpen(val);
                            const selected = commonData.shifts.find((s: any) => s.id === val);
                            if (selected) setShift(selected);
                            setShiftOpen(false);
                        }}
                        setItems={setShiftItems}
                        searchable={true}
                        searchPlaceholder="Search shift"
                        placeholder="Select shift"
                        zIndex={2000}
                        zIndexInverse={1000}
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
                        setOpen={(val) => val && handleDropdownOpen("member")}
                        setValue={(val) => {
                            setMemberValue(val);
                            const selected = commonData.members.find((m: any) => m.id === val);
                            if (selected) setMember(selected);
                            setMemberOpen(false);
                        }}
                        setItems={setMemberItems}
                        searchable={true}
                        searchPlaceholder="Search member"
                        placeholder="Select member"
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
                        setOpen={(val) => val && handleDropdownOpen("can")}
                        setValue={(val) => {
                            setCanValue(val);
                            const selected = commonData.cans.find((c: any) => c.id === val);
                            if (selected) setCan(selected);
                            setCanOpen(false);
                        }}
                        setItems={setCanItems}
                        searchable={true}
                        searchPlaceholder="Search can"
                        placeholder="Select can"
                        zIndex={1000}
                        zIndexInverse={2000}
                    />
                </View>
            </View>

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
                    <Text style={styles.label}>Can</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Can Wt"
                        value={can?.weight ? `${can.weight}` : ""}
                        editable={false} // never editable
                    />
                </View>

                <View style={styles.col}>
                    <Text style={styles.label}>Net</Text>
                    <Text style={styles.value}>
                        {scaleWeight !== null && can?.weight
                            ? `${(scaleWeight - can.weight).toFixed(2)} KG`
                            : "--"}
                    </Text>
                </View>
            </View>


            {connectedDevice && (
                <Text>
                    Connected Device: {connectedDevice?.name} ({connectedDevice?.id})
                </Text>
            )}

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

            <TouchableOpacity style={styles.submitButton} onPress={sendMemberKilos}>
                <Text style={styles.submitText}>Send Kilos</Text>
            </TouchableOpacity>

            {/* MODAL */}
            <ConnectScaleModal
                visible={modalVisible}
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
        </View>
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
