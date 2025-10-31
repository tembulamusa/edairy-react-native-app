import React, { useEffect, useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    Alert,
    FlatList,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Icon from "react-native-vector-icons/MaterialIcons";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all";
import makeRequest from "../utils/makeRequest";
import BluetoothConnectionModal from "./BluetoothConnectionModal";
import useBluetoothClassic from "../../hooks/useBluetoothService";

type StoreSaleModalProps = {
    visible: boolean;
    onClose: () => void;
    onSave: (formData: any) => Promise<void>;
    commonData: {
        members: { id: number; first_name: string; last_name: string }[];
        stores: { id: number; description: string }[];
        stock_items: { id: number; name: string; unit_price: number }[];
    };
};

const StoreSaleModal: React.FC<StoreSaleModalProps> = ({
    visible,
    onClose,
    onSave,
    commonData,
}) => {
    const [errors, setErrors] = useState<any | null>({});
    const [transactionDate, setTransactionDate] = useState<Date>(new Date());
    const [saving, setSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Members
    const [memberOpen, setMemberOpen] = useState(false);
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberItems, setMemberItems] = useState<any[]>([]);

    // Stores
    const [storeOpen, setStoreOpen] = useState(false);
    const [storeValue, setStoreValue] = useState<number | null>(null);
    const [storeItems, setStoreItems] = useState<any[]>([]);

    // Stock selection
    const [stockOpen, setStockOpen] = useState(false);
    const [stockValue, setStockValue] = useState<number | null>(null);
    const [stockItems, setStockItems] = useState<any[]>([]);

    // Entries list
    const [entries, setEntries] = useState<
        { id: number; name: string; unit_price: number; quantity: string }[]
    >([]);

    // Payment type
    const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");

    // Bluetooth Printer
    const [printerModalVisible, setPrinterModalVisible] = useState(false);
    const { 
        devices: printerDevices, 
        connectToDevice: connectToPrinter, 
        scanForDevices: scanForPrinters, 
        connectedDevice: connectedPrinter, 
        isScanning: isScanningPrinters, 
        isConnecting: isConnectingPrinter,
        printText,
        printRaw
    } = useBluetoothClassic({ deviceType: 'printer' });

    // Load dropdowns whenever commonData changes
    useEffect(() => {
        if (commonData?.members) {
            setMemberItems([
                { label: "No Member / Guest", value: null },
                ...commonData.members.map((m) => ({
                    label: `${m?.first_name} ${m?.last_name}`,
                    value: m.id,
                })),
            ]);
        }
        if (commonData?.stores) {
            setStoreItems(
                commonData.stores.map((s) => ({
                    label: s.description || `Store ${s.id}`,
                    value: s.id,
                }))
            );
        }
        if (commonData?.stock_items) {
            setStockItems(
                commonData.stock_items.map((s) => ({
                    label: s.item?.description || `Item ${s.id}`,
                    value: s.id,
                    unit_price: s.selling_price, // for reference
                }))
            );
        }
    }, [commonData]);

    // Reset payment type if member unselected
    useEffect(() => {
        if (!memberValue) setPaymentType("cash");
    }, [memberValue]);

    const addStockEntry = (stockId: number) => {
        const stock = commonData.stock_items.find((s) => s.id === stockId);
        if (stock && !entries.find((e) => e.id === stock.id)) {
            setEntries([...entries, { ...stock, quantity: 1 }]);
        }
        // setStockValue(null);
    };
    // ✅ Compute overall total
    const overallTotal = entries.reduce((sum, e) => {
        const qty = parseFloat(e.quantity || "0");
        return sum + qty * e.selling_price;
    }, 0);

    // Format receipt for printing
    const formatReceipt = (saleData: any) => {
        const selectedStore = commonData.stores?.find(s => s.id === storeValue);
        const selectedMember = commonData.members?.find(m => m.id === memberValue);
        
        let receipt = "";
        receipt += "================================\n";
        receipt += "        STORE SALE RECEIPT\n";
        receipt += "================================\n";
        receipt += `Store: ${selectedStore?.description || 'N/A'}\n`;
        receipt += `Date: ${transactionDate.toISOString().split("T")[0]}\n`;
        receipt += `Member: ${selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : 'Guest'}\n`;
        receipt += `Payment: ${paymentType.toUpperCase()}\n`;
        receipt += "--------------------------------\n";
        
        entries.forEach((item, index) => {
            const qty = parseFloat(item.quantity || "0");
            const total = qty * item.selling_price;
            receipt += `${index + 1}. ${item?.item?.description || 'Item'}\n`;
            receipt += `   Qty: ${qty} x ${item.selling_price.toFixed(2)} = ${total.toFixed(2)}\n`;
        });
        
        receipt += "--------------------------------\n";
        receipt += `TOTAL: ${overallTotal.toFixed(2)} KES\n`;
        receipt += "================================\n";
        receipt += "Thank you for your business!\n";
        receipt += "================================\n\n\n";
        
        return receipt;
    };

    // Print receipt function
    const printReceipt = async (saleData: any) => {
        if (!connectedPrinter || !printText) {
            console.log("No printer connected or print function not available");
            return;
        }

        try {
            const receiptText = formatReceipt(saleData);
            console.log("🖨️ Printing receipt...");
            await printText(receiptText);
            console.log("✅ Receipt printed successfully");
        } catch (error) {
            console.error("❌ Print error:", error);
            Alert.alert("Print Error", "Failed to print receipt. Please check printer connection.");
        }
    };

    const handleSave = async () => {
        if (!storeValue || !transactionDate || entries.length === 0) {
            Alert.alert("Validation", "Please complete store, date, and items.");
            return;
        }
        setSaving(true);
        setErrors({});
        try {
            let items = entries.map((e) => ({
                stock_id: e.id,
                quantity: parseFloat(e.quantity || "0"),
                unit_price: e.unit_price,
                total: parseFloat(e.quantity || "0") * e.unit_price,
            }));

            let data = {
                member_id: memberValue,
                store_id: storeValue,
                transaction_date: transactionDate.toISOString().split("T")[0],
                sale_type: paymentType,
                items,
            }
            const [status, response] = await makeRequest({
                url: "store-sale",
                method: "POST",
                data,
            });

            if (![200, 201].includes(status)) {
                if (!response?.errors) {
                    Alert.alert("Error", response?.message || "Failed to save sale");
                }
                else {
                    setErrors(response?.errors || {});
                    Alert.alert("Error", JSON.stringify(response));
                }
                return;
            } else {
                Alert.alert("Success", "Sale recorded successfully");
                
                // Print receipt if printer is connected
                if (connectedPrinter) {
                    await printReceipt(response?.data);
                }
                
                setEntries([]);
                setMemberValue(null);
                setStoreValue(null);
                onSave(response?.data);
                onClose();
            }

        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to save sale");
            return
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={styles.fullModal}>
                {/* Header with close button */}
                <View style={styles.header}>
                    <Text style={styles.title}>New Store Sale</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Icon name="close" size={28} color="#333" />
                    </TouchableOpacity>
                </View>

                {/* Member */}
                <Text style={styles.label}>Member</Text>
                <DropDownPicker
                    open={memberOpen}
                    value={memberValue}
                    items={memberItems}
                    setOpen={setMemberOpen}
                    setValue={setMemberValue}
                    setItems={setMemberItems}
                    placeholder="Select Member"
                    zIndex={3000}
                    zIndexInverse={1000}
                    searchable={true}
                    searchPlaceholder="Search members..."
                    style={styles.dropdown}
                    dropDownContainerStyle={styles.dropdownBox}
                    
                />

                {/* Pair: Store + Date */}
                <View style={styles.row}>
                    <View style={styles.half}>
                        <Text style={styles.label}>Store</Text>
                        <DropDownPicker
                            open={storeOpen}
                            value={storeValue}
                            items={storeItems}
                            setOpen={setStoreOpen}
                            setValue={setStoreValue}
                            setItems={setStoreItems}
                            placeholder="Select Store"
                            zIndex={2500}
                            zIndexInverse={2000}
                            searchable={true}
                            searchPlaceholder="Search stores..."
                            style={styles.dropdown}
                            dropDownContainerStyle={styles.dropdownBox}
                        />
                    </View>

                    <View style={styles.half}>
                        <Text style={styles.label}>Transaction Date</Text>
                        <TouchableOpacity
                            style={styles.datePicker}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text>{transactionDate.toISOString().split("T")[0]}</Text>
                            <Icon name="date-range" size={20} color="#333" />
                        </TouchableOpacity>
                        <DateTimePickerModal
                            isVisible={showDatePicker}
                            mode="date"
                            date={transactionDate}
                            maximumDate={new Date()}
                            onConfirm={(date) => {
                                setTransactionDate(date);
                                setShowDatePicker(false);
                            }}
                            onCancel={() => setShowDatePicker(false)}
                        />
                    </View>
                </View>

                {/* // Stock selection */}
                <Text style={styles.label}>Add Stock Item</Text>


                <DropDownPicker
                    open={stockOpen}
                    value={stockValue}
                    items={stockItems}
                    setOpen={setStockOpen}
                    setValue={setStockValue}
                    setItems={setStockItems}
                    placeholder="Select Stock Item"
                    searchable={true}
                    searchPlaceholder="Search stock..."
                    onChangeValue={(val) => {
                        setStockValue(val);
                        if (val) {
                            addStockEntry(val);  // ✅ Add entry when selected
                        }
                    }}
                    renderListItem={renderDropdownItem}
                    zIndex={1000}
                    zIndexInverse={2000}
                />

                {/* Entries list */}
                <Text style={[styles.label, { marginTop: 12 }]}>Selected items</Text>
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item, index }) => (
                        <View style={styles.entry}>
                            <Text style={{ flex: 1, textTransform: "capitalize" }}>
                                {item?.item?.description}
                            </Text>
                            <TextInput
                                style={[
                                    styles.entryInput,
                                    saving && { backgroundColor: "#f5f5f5", color: "#888" },
                                ]}
                                keyboardType="numeric"
                                placeholder="1"
                                value={item.quantity ?? 1}
                                onChangeText={(val) => {
                                    if (!saving) {
                                        const updated = [...entries];
                                        updated[index].quantity = val;
                                        setEntries(updated);
                                    }
                                }}
                                editable={!saving}   // ✅ disable editing
                            />
                            <Text style={styles.priceText}>
                                @ {item.selling_price} ={" "}
                                {item.quantity
                                    ? (parseFloat(item.quantity) * item.selling_price).toFixed(2)
                                    : "0.00"}
                            </Text>
                            <TouchableOpacity
                                onPress={() =>
                                    !saving &&
                                    setEntries(entries.filter((e) => e.id !== item.id))
                                }
                                style={[styles.removeButton, saving && { opacity: 0.4 }]}
                                disabled={saving}   // ✅ disable deleting
                            >
                                <Icon name="delete" size={22} color="#d11a2a" />
                            </TouchableOpacity>
                        </View>
                    )}
                />
                {/* Overall Total */}
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Overall Total:</Text>
                    <Text style={styles.totalValue}>{overallTotal.toFixed(2)}</Text>
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
                        onPress={() => memberValue && setPaymentType("credit")}
                        disabled={!memberValue}
                    >
                        <Icon
                            name={
                                paymentType === "credit"
                                    ? "radio-button-checked"
                                    : "radio-button-unchecked"
                            }
                            size={20}
                            color={memberValue ? "#007AFF" : "#ccc"}
                        />
                        <Text
                            style={[
                                styles.radioText,
                                { color: memberValue ? "#000" : "#aaa" },
                            ]}
                        >
                            Credit
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Printer Connection Section */}
                <View style={styles.printerSection}>
                    <Text style={styles.label}>Printer</Text>
                    <View style={styles.printerStatusContainer}>
                        {connectedPrinter ? (
                            <View style={styles.printerConnected}>
                                <View style={styles.printerStatusIndicator} />
                                <Text style={styles.printerStatusText}>
                                    Connected: {connectedPrinter.name || 'Printer'}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.printerDisconnected}>
                                <View style={[styles.printerStatusIndicator, { backgroundColor: '#ef4444' }]} />
                                <Text style={styles.printerStatusText}>
                                    No printer connected
                                </Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.printerButton}
                            onPress={() => setPrinterModalVisible(true)}
                        >
                            <Text style={styles.printerButtonText}>
                                {connectedPrinter ? "Change Printer" : "Connect Printer"}
                            </Text>
                        </TouchableOpacity>
                    </View>
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
                            <Text style={styles.buttonText}>submit</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Bluetooth Printer Connection Modal */}
                <BluetoothConnectionModal
                    visible={printerModalVisible}
                    onClose={() => setPrinterModalVisible(false)}
                    type="device-list"
                    deviceType="printer"
                    title="Select Printer Device"
                    devices={printerDevices}
                    connectToDevice={connectToPrinter}
                    scanForDevices={scanForPrinters}
                    isScanning={isScanningPrinters}
                    isConnecting={isConnectingPrinter}
                    connectedDevice={connectedPrinter}
                />
            </View>
        </Modal>
    );
};

export default StoreSaleModal;

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
    half: { flex: 1, marginRight: 8 },
    datePicker: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        padding: 10,
        marginTop: 6,
    },
    entry: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    entryInput: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        padding: 6,
        width: 60,
        marginHorizontal: 10,
        textAlign: "center",
    },
    priceText: { fontWeight: "600" },
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
});
