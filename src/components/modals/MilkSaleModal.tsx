import React, { useCallback, useEffect, useState, useRef } from "react";
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
} from "react-native";
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from "react-native-vector-icons/MaterialIcons";
import DropDownPicker from "react-native-dropdown-picker";
import makeRequest from "../utils/makeRequest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import useBluetoothService from "../../hooks/useBluetoothService";
import BluetoothConnectionModal from "./BluetoothConnectionModal";

type MilkSaleModalProps = {
    visible: boolean;
    onClose: () => void;
    onSave: (formData: any) => Promise<void>;
    commonData: {
        customers: { id: number; first_name: string; last_name: string }[];
        shifts: { id: number; description: string }[];
        transporters: { id: number; first_name: string; last_name: string }[];
    };
};

const MilkSaleModal: React.FC<MilkSaleModalProps> = ({
    visible,
    onClose,
    onSave,
    commonData,
}) => {
    const [errors, setErrors] = useState<any | null>({});
    // const [transactionDate] = useState<Date>(new Date());
    const [saving, setSaving] = useState(false);

    // Dropdowns
    const [shiftOpen, setShiftOpen] = useState(false);
    const [shiftValue, setShiftValue] = useState<number | null>(null);
    const [shiftItems, setShiftItems] = useState<any[]>([]);

    const [customerOpen, setCustomerOpen] = useState(false);
    const [customerValue, setCustomerValue] = useState<number | null>(null);
    const [customerItems, setCustomerItems] = useState<any[]>([]);

    const [transporterOpen, setTransporterOpen] = useState(false);
    const [transporterValue, setTransporterValue] = useState<number | null>(null);
    const [transporterItems, setTransporterItems] = useState<any[]>([]);

    const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");

    // New fields
    const [litres, setLitres] = useState<string>(""); // store as string for TextInput
    const [price, setPrice] = useState<string>("");  // store as string
    const total = (parseFloat(litres) || 0) * (parseFloat(price) || 0);

    const [pendingPrintData, setPendingPrintData] = useState<any | null>(null);
    const [printerModalVisible, setPrinterModalVisible] = useState(false);

    const {
        devices: printerDevices,
        connectToDevice: connectToPrinterDevice,
        scanForDevices: scanForPrinters,
        connectedDevice: connectedPrinter,
        isConnecting: isConnectingPrinter,
        isScanning: isScanningPrinters,
        printText,
    } = useBluetoothService({ deviceType: "printer" });

    const printerDevicesRef = useRef<any[]>(printerDevices || []);
    useEffect(() => {
        printerDevicesRef.current = printerDevices || [];
    }, [printerDevices]);

    // Load dropdowns whenever commonData changes
    useEffect(() => {
        try {
            setTransporterItems(
                commonData?.transporters?.map((m) => ({
                    label: `${m.first_name} ${m.last_name}`,
                    value: m.id,
                })) || []
            );

            setCustomerItems(
                commonData?.customers?.map((c) => ({
                    label: `${c.first_name} ${c.last_name}`,
                    value: c.id,
                })) || []
            );

            setShiftItems([
                { label: "All Shifts", value: "all" },
                ...(commonData?.shifts || []).map((shift) => ({
                    label: shift.description || `Shift ${shift.id}`,
                    value: shift.id,
                })),
            ]);
        } catch (error: any) {
            Alert.alert("Error", `Failed to load common data: ${error.message || error}`);
        }
    }, [commonData]);

    useEffect(() => {
        if (!customerValue) setPaymentType("cash");
    }, [customerValue]);

    const wait = useCallback(
        (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms)),
        []
    );

    const persistLastPrinter = useCallback(async (device: any) => {
        if (!device) return;
        try {
            const payload = {
                id: device?.id || device?.address || device?.address_or_id,
                address: device?.address || device?.id || device?.address_or_id,
                name: device?.name || device?.label || "Printer",
                type: device?.type || "classic",
                saved_at: new Date().toISOString(),
            };

            if (!payload.id || !payload.address) return;

            await AsyncStorage.setItem("last_device_printer", JSON.stringify(payload));
        } catch (error) {
            console.error("[MilkSale] persistLastPrinter error", error);
        }
    }, []);

    const formatReceipt = useCallback(() => {
        const transporter = transporterItems.find(item => item.value === transporterValue);
        const customer = customerItems.find(item => item.value === customerValue);
        const shift = shiftItems.find(item => item.value === shiftValue);

        let receipt = "";
        receipt += "      E-DAIRY LIMITED\n";
        receipt += "      P.O. Box [P.O. Box Number]\n";
        receipt += "\n\n";
        receipt += "      Phone: [Phone Number]\n";
        receipt += "================================\n";
        receipt += "         MILK SALE RECEIPT\n";
        receipt += "================================\n";
        receipt += `Date: ${new Date().toISOString()}\n`;
        receipt += `Transporter: ${transporter?.label || 'N/A'}\n`;
        receipt += `Customer: ${customer?.label || 'N/A'}\n`;
        receipt += `Shift: ${shift?.label || 'N/A'}\n`;
        receipt += `Payment: ${paymentType.toUpperCase()}\n`;
        receipt += "--------------------------------\n";
        receipt += `Litres: ${(parseFloat(litres) || 0).toFixed(2)}\n`;
        receipt += `Price/Litre: ${(parseFloat(price) || 0).toFixed(2)}\n`;
        receipt += `Total: ${total.toFixed(2)}\n`;
        receipt += "================================\n";
        receipt += "Thank you for your business!\n";
        receipt += "================================\n\n";

        return receipt;
    }, [transporterItems, transporterValue, customerItems, customerValue, shiftItems, shiftValue, paymentType, litres, price, total]);

    const connectToStoredPrinter = useCallback(async () => {
        if (connectedPrinter) {
            await persistLastPrinter(connectedPrinter);
            return connectedPrinter;
        }
 
        try {
             const stored = await AsyncStorage.getItem("last_device_printer");
             if (!stored) return null;
 
             const data = JSON.parse(stored);
             const deviceId = data?.id || data?.address || data?.address_or_id;
             if (!deviceId) return null;

            await scanForPrinters();
            await wait(2000);

             const result = await connectToPrinterDevice(deviceId);
             if (result) {
                 await persistLastPrinter(result);
                 return result;
             }
        } catch (error) {
            console.error("[MilkSale] connectToStoredPrinter error", error);
        }
        return null;
    }, [connectedPrinter, connectToPrinterDevice, persistLastPrinter, scanForPrinters, wait]);

    const connectToAnyAvailablePrinter = useCallback(async () => {
        try {
            console.log("[MilkSale] AUTO-CONNECT: Scanning for InnerPrinter...");
            await scanForPrinters();
            await wait(2000);
            const devices = printerDevicesRef.current || [];
            console.log("[MilkSale] AUTO-CONNECT: Found", devices.length, "printer devices");
            
            if (devices.length === 0) {
                console.log("[MilkSale] AUTO-CONNECT: No printers found in scan");
                return null;
            }
            
            // Filter for InnerPrinter devices first (case-insensitive)
            const innerPrinters = devices.filter(device => {
                const deviceName = (device.name || '').toLowerCase();
                return deviceName.includes('innerprinter') || deviceName.includes('inner');
            });
            
            let targetPrinter;
            if (innerPrinters.length > 0) {
                targetPrinter = innerPrinters[0];
                console.log("[MilkSale] AUTO-CONNECT: Found InnerPrinter device:", targetPrinter.name || targetPrinter.id);
            } else {
                // Fallback to first available printer if no InnerPrinter found
                targetPrinter = devices[0];
                console.log("[MilkSale] AUTO-CONNECT: No InnerPrinter found, using first available printer:", targetPrinter.name || targetPrinter.id);
            }
            
            const deviceId = targetPrinter?.id || targetPrinter?.address || targetPrinter?.address_or_id;
            
            if (!deviceId) {
                console.log("[MilkSale] AUTO-CONNECT: Target printer missing device id");
                return null;
            }
            
            console.log("[MilkSale] AUTO-CONNECT: Attempting connection to", targetPrinter.name || deviceId);
            const result = await connectToPrinterDevice(deviceId);
            if (result) {
                await persistLastPrinter(result);
                return result;
            }
        } catch (error) {
            console.error("[MilkSale] connectToAnyAvailablePrinter error", error);
        }
        return null;
    }, [scanForPrinters, connectToPrinterDevice, persistLastPrinter, wait]);

    const printReceipt = useCallback(async () => {
        if (!printText) {
            Alert.alert("Print Error", "Printer interface not available.");
            return;
        }

        const receipt = formatReceipt();
        await printText(receipt);
        if (connectedPrinter) {
            await persistLastPrinter(connectedPrinter);
        }
    }, [printText, formatReceipt, connectedPrinter, persistLastPrinter]);

    const attemptAutoConnectPrinter = useCallback(async (): Promise<boolean> => {
        if (connectedPrinter || isConnectingPrinter) {
            return true;
        }

        // First, try stored printer
        const stored = await connectToStoredPrinter();
        if (stored) return true;

        // If stored printer failed or doesn't exist, try any available printer
        console.log("[MilkSale] AUTO-CONNECT: Trying to connect to any available printer...");
        const anyPrinter = await connectToAnyAvailablePrinter();
        return !!anyPrinter;
    }, [connectedPrinter, isConnectingPrinter, connectToStoredPrinter, connectToAnyAvailablePrinter]);

    const handlePrintAfterSale = useCallback(async (saleData?: any) => {
        if (connectedPrinter && printText) {
            await printReceipt();
            return;
        }

        setPendingPrintData(saleData || true);
        const autoConnected = await attemptAutoConnectPrinter();

        if (!autoConnected) {
            Alert.alert(
                "Printer Not Connected",
                "Unable to auto-connect to a printer. Please select a printer manually to complete printing.",
                [
                    {
                        text: "OK",
                        onPress: () => setPrinterModalVisible(true),
                    },
                ]
            );
        }
    }, [connectedPrinter, printText, printReceipt, attemptAutoConnectPrinter]);

    useEffect(() => {
        if (connectedPrinter && pendingPrintData) {
            (async () => {
                await printReceipt();
                setPendingPrintData(null);
            })();
        }
    }, [connectedPrinter, pendingPrintData, printReceipt]);

    useEffect(() => {
        if (connectedPrinter) {
            persistLastPrinter(connectedPrinter);
        }
    }, [connectedPrinter, persistLastPrinter]);

    useEffect(() => {
        if (visible) {
            attemptAutoConnectPrinter();
        }
    }, [visible, attemptAutoConnectPrinter]);

    const handleSave = async () => {
        if (!transporterValue || !litres || !price) {
            Alert.alert("Validation", "Please fill all required fields.");
            return;
        }
        setSaving(true);
        setErrors({});
        try {
            let data = {
                customer_id: customerValue,
                transporter_id: transporterValue,
                shift_id: shiftValue,
                sale_type: paymentType,
                quantity: parseFloat(litres),
                price: parseFloat(price),
                total_amount: total,
            };
            const [status, response] = await makeRequest({
                url: "milk-sale",
                method: "POST",
                data,
            });

            if (![200, 201].includes(status)) {
                if (!response?.errors) {
                    Alert.alert("Error", response?.message || "Failed to save sale");
                } else {
                    setErrors(response?.errors || {});
                }
                return;
            } else {
                Alert.alert("Success", "Sale recorded successfully");
                try {
                    await handlePrintAfterSale(response?.data);
                } catch (printError) {
                    console.error("[MilkSale] print error", printError);
                }

                onSave(response?.data);
                onClose();
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to save sale");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <View style={styles.fullModal}>
                    {/* Header */}
                    <View style={styles.headerWrapper}>
                        <View style={styles.header}>
                            <Text style={styles.title}>New Milk Sale</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Icon name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.contentScroll}
                        contentContainerStyle={styles.contentContainer}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                    {/* Transporter + Customer */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Transporter</Text>
                            <DropDownPicker
                                open={transporterOpen}
                                value={transporterValue}
                                items={transporterItems}
                                setOpen={setTransporterOpen}
                                setValue={setTransporterValue}
                                setItems={setTransporterItems}
                                placeholder="Select Transporter"
                                listMode="SCROLLVIEW"
                                zIndex={2500}
                                zIndexInverse={2000}
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                searchable
                                searchPlaceholder="Search transporter..."
                            />
                        </View>

                        <View style={styles.col}>
                            <Text style={styles.label}>Customer</Text>
                            <DropDownPicker
                                open={customerOpen}
                                value={customerValue}
                                items={customerItems}
                                setOpen={setCustomerOpen}
                                setValue={setCustomerValue}
                                setItems={setCustomerItems}
                                placeholder="Select customer"
                                listMode="SCROLLVIEW"
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                searchable
                                zIndex={2000}
                                zIndexInverse={2500}
                            />
                        </View>
                    </View>

                    {/* Shift */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <DropDownPicker
                                open={shiftOpen}
                                value={shiftValue}
                                items={shiftItems}
                                setOpen={setShiftOpen}
                                setValue={setShiftValue}
                                setItems={setShiftItems}
                                placeholder="Select Shift"
                                listMode="SCROLLVIEW"
                                style={styles.dropdown}
                                dropDownContainerStyle={styles.dropdownBox}
                                searchable
                                zIndex={1500}
                                zIndexInverse={1000}
                            />
                        </View>
                    </View>

                    {/* Litres & Price */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.label}>Litres</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={litres}
                                onChangeText={setLitres}
                                placeholder="Enter litres"
                            />
                        </View>
                        <View style={styles.col}>
                            <Text style={styles.label}>Price per Litre</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={price}
                                onChangeText={setPrice}
                                placeholder="Enter price"
                            />
                        </View>
                    </View>

                    {/* Total */}
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>{total.toFixed(2)}</Text>
                    </View>

                    {/* Payment type */}
                    <Text style={styles.label}>Payment Type</Text>
                    <View style={styles.radioGroup}>
                        <TouchableOpacity
                            style={styles.radioOption}
                            onPress={() => setPaymentType("cash")}
                        >
                            <Icon
                                name={
                                    paymentType === "cash"
                                        ? "radio-button-checked"
                                        : "radio-button-unchecked"
                                }
                                size={20}
                                color="#007AFF"
                            />
                            <Text style={styles.radioText}>Cash</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.radioOption}
                            onPress={() => customerValue && setPaymentType("credit")}
                            disabled={!customerValue}
                        >
                            <Icon
                                name={
                                    paymentType === "credit"
                                        ? "radio-button-checked"
                                        : "radio-button-unchecked"
                                }
                                size={20}
                                color={customerValue ? "#007AFF" : "#ccc"}
                            />
                            <Text
                                style={[
                                    styles.radioText,
                                    { color: customerValue ? "#000" : "#aaa" },
                                ]}
                            >
                                Credit
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {!connectedPrinter && (
                        <View style={styles.printerSection}>
                            <Text style={styles.label}>Printer</Text>
                            <View style={styles.printerStatusContainer}>
                                <View style={styles.printerDisconnected}>
                                    <View style={[styles.printerStatusIndicator, { backgroundColor: '#ef4444' }]} />
                                    <Text style={styles.printerStatusText}>
                                        {isConnectingPrinter
                                            ? "Connecting to InnerPrinter..."
                                            : "No printer connected"}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.printerButton, isConnectingPrinter && { opacity: 0.6 }]}
                                    onPress={() => setPrinterModalVisible(true)}
                                    disabled={isConnectingPrinter}
                                >
                                    <Text style={styles.printerButtonText}>
                                        {isConnectingPrinter ? "Connecting..." : "Connect Printer"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Buttons */}
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

                <BluetoothConnectionModal
                    visible={printerModalVisible}
                    onClose={() => setPrinterModalVisible(false)}
                    type="device-list"
                    deviceType="printer"
                    title="Select Printer Device"
                    devices={printerDevices}
                    connectToDevice={connectToPrinterDevice}
                    scanForDevices={scanForPrinters}
                    isScanning={isScanningPrinters}
                    isConnecting={isConnectingPrinter}
                    connectedDevice={connectedPrinter}
                />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default MilkSaleModal;

const styles = StyleSheet.create({
    fullModal: {
        flex: 1,
        backgroundColor: "#fff",
        padding: 20,
        paddingTop: 40,
    },
    headerWrapper: {
        marginHorizontal: -20,
        marginTop: -40,
        marginBottom: 20,
        paddingTop: 52,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: "#047857",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    title: { fontSize: 20, fontWeight: "700", color: "#fff" },
    contentScroll: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 24,
    },
    label: { marginTop: 12, fontWeight: "600", fontSize: 14 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    col: { flex: 1, marginHorizontal: 4 },
    dropdown: {
        marginTop: 6,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
    },
    dropdownBox: {
        borderColor: "#e2e8f0",
        borderWidth: 1,
        borderRadius: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 6,
        fontSize: 14,
        color: "#111827",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "600",
    },
    totalValue: {
        fontSize: 16,
        fontWeight: "700",
        color: "#047857",
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 24,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 8,
        marginLeft: 10,
    },
    cancelButton: { backgroundColor: "#e2e8f0" },
    saveButton: { backgroundColor: "#16a34a" },
    buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
    radioGroup: {
        flexDirection: "row",
        marginTop: 8,
    },
    radioOption: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 24,
    },
    radioText: {
        marginLeft: 6,
        fontSize: 14,
    },
    printerSection: {
        marginTop: 24,
        borderWidth: 1,
        borderColor: "#f3f4f6",
        borderRadius: 8,
        padding: 12,
    },
    printerStatusContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
    },
    printerDisconnected: {
        flexDirection: "row",
        alignItems: "center",
    },
    printerStatusIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#22c55e",
        marginRight: 8,
    },
    printerStatusText: {
        fontSize: 14,
        color: "#111827",
    },
    printerButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: "#047857",
    },
    printerButtonText: {
        color: "#fff",
        fontWeight: "600",
    },
});
