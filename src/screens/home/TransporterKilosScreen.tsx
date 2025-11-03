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
import { printReceiptWithPrinter } from "../../components/utils/printReceipt.ts";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
                    selectedVehicle?.name || 'N/A',
                    selectedRoute?.route_name || 'N/A',
                    selectedShift?.name || 'N/A',
                    transactionDate,
                    capturedNetWeight
                );
            } catch (formatError) {
                console.error("Error formatting receipt:", formatError);
                // Create a simple receipt if formatting fails
                receiptText = `TRANSPORTER KILOS RECEIPT\nDate: ${transactionDate.toISOString().split("T")[0]}\nNet Weight: ${capturedNetWeight.toFixed(2)} KG\n`;
            }

            // Show success alert
            Alert.alert("Success", `Transporter kilos sent successfully!`);

            // Print receipt in the background
            setIsPrinting(true);
            try {
                console.log('🔌 Starting print process...');
                const printSuccess = await printReceiptWithPrinter(receiptText);
                if (printSuccess) {
                    console.log('✅ Receipt printed successfully');
                } else {
                    console.warn('⚠️ Printing failed or no printer configured');
                }
            } catch (printerError) {
                console.error("❌ Printer error:", printerError);
                // Don't show error to user - just log it
            } finally {
                setIsPrinting(false);
            }

            // Clear form and navigate
            setNetWeight("");
            setTransporterValue(null);
            setVehicleValue(null);
            setRouteValue(null);
            setShiftValue(null);

            // Navigate after a short delay to allow printing to complete
            setTimeout(() => {
                navigation.navigate("Home" as never);
            }, 1000);
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
                                                {item.vehicle?.name || item.registration_number || 'N/A'}
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
                                setValue={setTransporterValue}
                                setItems={setTransporterItems}
                                placeholder="Select transporter"
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
                                style={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                    borderRadius: 6,
                                }}
                                dropDownContainerStyle={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                }}
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
                                style={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                    borderRadius: 6,
                                }}
                                dropDownContainerStyle={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                }}
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
                                style={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                    borderRadius: 6,
                                }}
                                dropDownContainerStyle={{
                                    borderWidth: 1,
                                    borderColor: "#ddd",
                                }}
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
