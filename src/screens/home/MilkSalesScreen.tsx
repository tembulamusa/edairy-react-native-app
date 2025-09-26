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

const MilkSaleScreen = () => {
    const [route, setRoute] = useState("");
    const [session, setSession] = useState("");
    const [saleType, setSaleType] = useState("cash");
    const [customerName, setCustomerName] = useState("");
    const [quantity, setQuantity] = useState("");
    const [rate, setRate] = useState("");
    const [sessionTotal, setSessionTotal] = useState("");

    // auto calculate total when qty or rate changes
    const handleCalculation = (qty: string, r: string) => {
        setQuantity(qty);
        setRate(r);
        const q = parseFloat(qty) || 0;
        const rt = parseFloat(r) || 0;
        setSessionTotal((q * rt).toString());
    };

    const saveMilkSale = () => {
        const data = {
            route,
            session,
            saleType,
            customerName,
            quantity,
            rate,
            sessionTotal,
        };
        console.log("Milk Sale Data:", data);
        Alert.alert("Success", "Milk Sale recorded successfully!");
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            {/* Route Picker */}
            <View style={styles.inputWrapper}>
                <Picker selectedValue={route} onValueChange={setRoute}>
                    <Picker.Item label="Select Route/Transporter" value="" />
                    <Picker.Item label="Route A" value="routeA" />
                    <Picker.Item label="Route B" value="routeB" />
                </Picker>
            </View>

            {/* Session Picker */}
            <View style={styles.inputWrapper}>
                <Picker selectedValue={session} onValueChange={setSession}>
                    <Picker.Item label="Select Session" value="" />
                    <Picker.Item label="Morning" value="morning" />
                    <Picker.Item label="Evening" value="evening" />
                </Picker>
            </View>

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

            {/* Customer Name */}
            <TextInput
                style={styles.input}
                placeholder="Customer Name (Optional)"
                value={customerName}
                onChangeText={setCustomerName}
            />

            {/* Quantity & Rate */}
            <View style={styles.row}>
                <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Quantity"
                    keyboardType="numeric"
                    value={quantity}
                    onChangeText={(val) => handleCalculation(val, rate)}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Rate"
                    keyboardType="numeric"
                    value={rate}
                    onChangeText={(val) => handleCalculation(quantity, val)}
                />
            </View>

            {/* Session Total */}
            <TextInput
                style={styles.input}
                placeholder="Session Total"
                value={sessionTotal}
                editable={false}
            />

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={saveMilkSale}>
                <Text style={styles.saveButtonText}>Save Milk Sale</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

export default MilkSaleScreen;

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
    row: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    radioRow: {
        flexDirection: "row",
        marginBottom: 16,
        justifyContent: "flex-start",
        paddingHorizontal: 4,
    },
    radioOption: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 20,
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
