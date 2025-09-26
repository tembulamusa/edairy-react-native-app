import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

const TransporterKilosScreen = () => {
    const [route, setRoute] = useState("");
    const [shift, setShift] = useState("");
    const [reading, setReading] = useState("");
    const [tareWeight, setTareWeight] = useState("");
    const [netWeight, setNetWeight] = useState("");
    const [sessionTotal, setSessionTotal] = useState("");


    const sendMemberKilos = () => {
        // Simulate API call
        setTimeout(() => {
            console.log("Member kilos sent:", {
                route,
                shift,
                reading,
                tareWeight,
                netWeight,
                sessionTotal,
            });
            // ✅ Success message with member's name
            alert(`${memberName || "Member"}'s milk ${netWeight} recorded successfully!`);

            // Reset form
            setRoute("");
            setShift("");
            setReading("");
            setTareWeight("");
            setNetWeight("");
            setSessionTotal("");
        }, 1000);
    };


    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            {/* Route */}
            <View style={styles.inputWrapper}>
                <Picker selectedValue={route} onValueChange={setRoute}>
                    <Picker.Item label="Select Route/Transporter" value="" />
                    <Picker.Item label="Route 1" value="route1" />
                    <Picker.Item label="Route 2" value="route2" />
                </Picker>
            </View>

            {/* Shift */}
            <View style={styles.inputWrapper}>
                <Picker selectedValue={shift} onValueChange={setShift}>
                    <Picker.Item label="Select Shift" value="" />
                    <Picker.Item label="Shift A" value="ShiftA" />
                    <Picker.Item label="Shift B" value="ShiftB" />
                </Picker>
            </View>

            <View style={styles.row}>
                <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Reading"
                    value={reading}
                    onChangeText={setReading}
                />
                <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Tare Weight"
                    value={tareWeight}
                    onChangeText={setTareWeight}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Net Weight"
                    value={netWeight}
                    onChangeText={setNetWeight}
                />
            </View>

            {/* Session Total */}
            <TextInput
                style={styles.input}
                placeholder="Session Total"
                value={sessionTotal}
                onChangeText={setSessionTotal}
            />

            {/* Save Button */}
            <TouchableOpacity style={styles.button} onPress={() => sendMemberKilos()}>
                <Text style={styles.buttonText}>Save Record</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

export default TransporterKilosScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f4f6f8",
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
        marginBottom: 12,
    },
    radioRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 16,
        alignItems: "center",
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
    selected: {
        backgroundColor: "#00897b",
    },
    radioLabel: {
        fontSize: 14,
        color: "#333",
    },
    button: {
        backgroundColor: "#00897b",
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8,
    },
    buttonText: {
        color: "white",
        fontWeight: "bold",
        fontSize: 16,
    },
});
