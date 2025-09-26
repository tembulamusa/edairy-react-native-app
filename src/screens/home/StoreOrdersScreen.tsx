import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

const StoreOrdersScreen = () => {
    const [store, setStore] = useState("");
    const [supplierNumber, setSupplierNumber] = useState("");
    const [saleType, setSaleType] = useState("cash");
    const [amountPaid, setAmountPaid] = useState("");

    // Items array state
    const [items, setItems] = useState([{ id: Date.now(), item: "", quantity: "" }]);

    // Add new item
    const addItem = () => {
        setItems((prev) => [...prev, { id: Date.now(), item: "", quantity: "" }]);
    };

    // Update item field
    const updateItem = (id: number, field: string, value: string) => {
        setItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
        );
    };

    // Submit order
    const submitStoreOrder = () => {
        const orderData = {
            store,
            supplierNumber,
            saleType,
            amountPaid,
            items,
        };

        console.log("Store order submitted:", orderData);
        Alert.alert("Success", "Store Order recorded successfully!");
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            {/* Select Store */}
            <View style={styles.inputWrapper}>
                <Picker selectedValue={store} onValueChange={setStore}>
                    <Picker.Item label="Select Store" value="" />
                    <Picker.Item label="Store A" value="storeA" />
                    <Picker.Item label="Store B" value="storeB" />
                </Picker>
            </View>

            {/* Supplier Number */}
            <TextInput
                style={styles.input}
                placeholder="Supplier Number"
                value={supplierNumber}
                onChangeText={setSupplierNumber}
            />

            {/* Dynamic Items */}
            <Text style={styles.label}>Items</Text>
            {items.map((entry) => (
                <View key={entry.id} style={{ marginBottom: 12 }}>
                    <View style={styles.inputWrapper}>
                        <Picker
                            selectedValue={entry.item}
                            onValueChange={(val) => updateItem(entry.id, "item", val)}
                        >
                            <Picker.Item label="Select Item" value="" />
                            <Picker.Item label="Item A" value="itemA" />
                            <Picker.Item label="Item B" value="itemB" />
                        </Picker>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder="Quantity"
                        value={entry.quantity}
                        onChangeText={(val) => updateItem(entry.id, "quantity", val)}
                    />
                </View>
            ))}

            {/* Add Item Button */}
            <TouchableOpacity style={styles.addButton} onPress={addItem}>
                <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>

            {/* Sale Type */}
            <Text style={styles.label}>Sale Type</Text>
            <View style={styles.radioRow}>
                {["cash", "credit"].map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={styles.radioOption}
                        onPress={() => setSaleType(type)}
                    >
                        <View
                            style={[
                                styles.radioCircle,
                                saleType === type && styles.radioSelected,
                            ]}
                        />
                        <Text style={styles.radioLabel}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Amount Paid */}
            <TextInput
                style={styles.input}
                placeholder="Amount Paid (Optional)"
                value={amountPaid}
                onChangeText={setAmountPaid}
                keyboardType="numeric"
            />

            {/* Save Record Button */}
            <TouchableOpacity style={styles.saveButton} onPress={submitStoreOrder}>
                <Text style={styles.saveButtonText}>Save Record</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

export default StoreOrdersScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f4f6f8",
    },
    label: {
        marginBottom: 6,
        marginLeft: 2,
        fontSize: 14,
        color: "#333",
    },
    inputWrapper: {
        backgroundColor: "white",
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    input: {
        backgroundColor: "white",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    radioRow: {
        flexDirection: "row",
        marginBottom: 16,
        justifyContent: "space-between",
        paddingHorizontal: 4,
    },
    radioOption: {
        flexDirection: "row",
        alignItems: "center",
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: "#00897b",
        marginRight: 6,
    },
    radioSelected: {
        backgroundColor: "#00897b",
    },
    radioLabel: {
        fontSize: 14,
        color: "#333",
    },
    addButton: {
        backgroundColor: "#c6ff00",
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8,
        marginBottom: 12,
    },
    addButtonText: {
        color: "#333",
        fontWeight: "bold",
        fontSize: 16,
    },
    saveButton: {
        backgroundColor: "#00897b",
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    saveButtonText: {
        color: "white",
        fontWeight: "bold",
        fontSize: 16,
    },
});
