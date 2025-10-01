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

type StoreSaleModalProps = {
    visible: boolean;
    onClose: () => void;
    onSave: (formData: any) => Promise<void>;
    commonData: {
        members: { id: number; first_name: string; last_name: string }[];
        stores: { id: number; name: string }[];
        stock_items: { id: number; name: string; unit_price: number }[];
    };
};

const StoreSaleModal: React.FC<StoreSaleModalProps> = ({
    visible,
    onClose,
    onSave,
    commonData,
}) => {
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

    // Load dropdowns whenever commonData changes
    useEffect(() => {
        if (commonData?.members) {
            setMemberItems(
                commonData.members.map((m) => ({
                    label: `${m.first_name} ${m.last_name}`,
                    value: m.id,
                }))
            );
        }
        if (commonData?.stores) {
            setStoreItems(
                commonData.stores.map((s) => ({
                    label: s.description,
                    value: s.id,
                }))
            );
        }
        if (commonData?.stock_items) {
            setStockItems(
                commonData.stock_items.map((s) => ({
                    label: s.name,
                    value: s.id,
                    unit_price: s.unit_price,
                }))
            );
        }
    }, [commonData]);

    const addStockEntry = (stockId: number) => {
        const stock = commonData.stock_items.find((s) => s.id === stockId);
        if (stock && !entries.find((e) => e.id === stock.id)) {
            setEntries([...entries, { ...stock, quantity: "" }]);
        }
        setStockValue(null);
    };

    const handleSave = async () => {
        if (!memberValue || !storeValue || !transactionDate || entries.length === 0) {
            Alert.alert("Validation", "Please complete all fields.");
            return;
        }

        const items = entries.map((e) => ({
            stock_item_id: e.id,
            quantity: parseFloat(e.quantity || "0"),
            unit_price: e.unit_price,
            total: parseFloat(e.quantity || "0") * e.unit_price,
        }));

        setSaving(true);
        try {
            await onSave({
                member_id: memberValue,
                store_id: storeValue,
                transaction_date: transactionDate.toISOString().split("T")[0],
                items,
            });
            onClose();
            setEntries([]);
            setMemberValue(null);
            setStoreValue(null);
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to save sale");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={styles.fullModal}>
                {/* Header with close button */}
                <View style={styles.header}>
                    <Text style={styles.title}>New Sale</Text>
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
                            onConfirm={(date) => {
                                setTransactionDate(date);
                                setShowDatePicker(false);
                            }}
                            onCancel={() => setShowDatePicker(false)}
                        />
                    </View>
                </View>

                {/* Stock selection */}
                <Text style={styles.label}>Add Stock Item</Text>
                <DropDownPicker
                    open={stockOpen}
                    value={stockValue}
                    items={stockItems}
                    setOpen={setStockOpen}
                    setValue={(val) => {
                        setStockValue(val);
                        if (val) addStockEntry(val as number);
                    }}
                    setItems={setStockItems}
                    placeholder="Select Stock Item"
                    zIndex={2000}
                    zIndexInverse={2500}
                    style={styles.dropdown}
                    dropDownContainerStyle={styles.dropdownBox}
                />

                {/* Entries list */}
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item, index }) => (
                        <View style={styles.entry}>
                            <Text style={{ flex: 1 }}>{item.name}</Text>
                            <TextInput
                                style={styles.entryInput}
                                keyboardType="numeric"
                                placeholder="Qty"
                                value={item.quantity}
                                onChangeText={(val) => {
                                    const updated = [...entries];
                                    updated[index].quantity = val;
                                    setEntries(updated);
                                }}
                            />
                            <Text style={styles.priceText}>
                                @ {item.unit_price} ={" "}
                                {item.quantity
                                    ? (parseFloat(item.quantity) * item.unit_price).toFixed(2)
                                    : "0.00"}
                            </Text>
                        </View>
                    )}
                />

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
                            <Text style={styles.buttonText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
});
