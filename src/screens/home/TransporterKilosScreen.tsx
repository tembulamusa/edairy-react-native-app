import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import fetchCommonData from "../../components/utils/fetchCommonData.ts";
import makeRequest from "../../components/utils/makeRequest.ts";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all.tsx";
import Icon from "react-native-vector-icons/MaterialIcons";

const TransporterKilosScreen = () => {
    const [commonData, setCommonData] = useState<any>({});
    const navigation = useNavigation();
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
    const [loading, setLoading] = useState(false); // <-- new

    // load common data
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
                label: v.name,
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
    }, [commonData]);

    const sendKilos = async () => {
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

            if (![200, 201].includes(status)) {
                Alert.alert(
                    `Error ${status}`,
                    response?.message || "Failed to submit data"
                );
                return;
            }

            Alert.alert("Success", `Transporter kilos sent successfully!`);
            setNetWeight("");
            setTransporterValue(null);
            setVehicleValue(null);
            setRouteValue(null);
            setShiftValue(null);
            navigation.navigate("Home" as never);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to send data");
        } finally {
            setLoading(false); // re-enable button
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Transporter Kilos</Text>

            {/* Transporter & Transaction Date */}
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
                        searchable
                        renderListItem={renderDropdownItem}
                        zIndex={5000}
                        zIndexInverse={2000}
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
                        searchable
                        renderListItem={renderDropdownItem}
                        zIndex={4000}
                        zIndexInverse={3000}
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
                        searchable
                        renderListItem={renderDropdownItem}
                        zIndex={2500}
                        zIndexInverse={1000}
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
                        searchable
                        renderListItem={renderDropdownItem}
                        zIndex={1500}
                        zIndexInverse={500}
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
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.submitText}>Send Kilos</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

export default TransporterKilosScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#fff" },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
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
