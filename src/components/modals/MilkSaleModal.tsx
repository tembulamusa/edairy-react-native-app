import React, { useEffect, useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import DropDownPicker from "react-native-dropdown-picker";
import makeRequest from "../utils/makeRequest";

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
                // transaction_date: transactionDate.toISOString().split("T")[0],
                sale_type: paymentType,
                quantity: parseFloat(litres),
                // price: parseFloat(price),
                // total,
            };
            const [status, response] = await makeRequest({
                url: "milk-sale",
                method: "POST",
                data,
            });

            Alert.alert("response", JSON.stringify(response));
            if (![200, 201].includes(status)) {
                if (!response?.errors) {
                    Alert.alert("Error", response?.message || "Failed to save sale");
                } else {
                    setErrors(response?.errors || {});
                }
                return;
            } else {
                Alert.alert("Success", "Sale recorded successfully");
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
            <View style={styles.fullModal}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>New Sale</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Icon name="close" size={28} color="#333" />
                    </TouchableOpacity>
                </View>

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
                            zIndex={2500}
                            zIndexInverse={2000}
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
                            searchable={true}
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
                            searchable={true}
                            placeholder="Select customer"
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
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
                            searchable={true}
                            placeholder="Select Shift"
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
                            zIndex={1000}
                            zIndexInverse={500}
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
                            name={paymentType === "cash" ? "radio-button-checked" : "radio-button-unchecked"}
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
                            name={paymentType === "credit" ? "radio-button-checked" : "radio-button-unchecked"}
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
                        style={[styles.button, styles.saveButton]}
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
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    title: { fontSize: 20, fontWeight: "700" },
    label: { marginTop: 12, fontWeight: "600", fontSize: 14 },
    dropdown: { marginTop: 6 },
    dropdownBox: { borderColor: "#ccc" },
    row: { flexDirection: "row", justifyContent: "space-between" },
    col: { flex: 1, marginRight: 8 },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        padding: 8,
        marginTop: 6,
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: "#ccc",
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "600",
    },
    totalValue: {
        fontSize: 16,
        fontWeight: "700",
        color: "#007AFF",
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 20,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
        marginLeft: 10,
    },
    cancelButton: { backgroundColor: "#ccc" },
    saveButton: { backgroundColor: "#007AFF" },
    buttonText: { color: "#fff", fontWeight: "600" },
    radioGroup: {
        flexDirection: "row",
        marginTop: 8,
    },
    radioOption: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 20,
    },
    radioText: {
        marginLeft: 6,
        fontSize: 14,
    },
});
