import React, { useState, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    Alert,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import makeRequest from "../utils/makeRequest";

type CashoutFormModalProps = {
    visible: boolean;
    creditLimit?: string;
    onSubmit?: (data: { cashout: {} }) => void;
    onClose: () => void;
};

const CashoutFormModal: React.FC<CashoutFormModalProps> = ({
    visible,
    onSubmit,
    onClose,
}) => {
    const [amount, setAmount] = useState("");
    const [limit, setLimit] = useState('');
    const [userPhone, setUserPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState();
    const [errors, setErrors] = useState([]);

    // 🔹 Fetch phone number from AsyncStorage whenever modal opens
    useEffect(() => {
        const fetchUserPhone = async () => {
            try {
                const storedUser = await AsyncStorage.getItem("user");
                if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    setLimit(userData['member_details']['credit_limit']);
                    setUserPhone(userData['member_details']['primary_phone_number'])
                }
            } catch (err) {
                console.error("Failed to load user phone:", err);
            }
        };

        if (visible) {
            setAmount("");
            fetchUserPhone();
        }
    }, [visible]);

    const handleSubmit = async () => {
        if (!amount) {
            Alert.alert("Error", "Please enter an amount.");
            return;
        }

        if (parseFloat(amount) > parseFloat(limit)) {
            Alert.alert(
                "Limit Exceeded",
                `Amount cannot exceed your credit limit of ${limit} KES`
            );
            return;
        }

        try {
            setLoading(true);

            const endpoint = `loan-request`;
            const [status, response] = await makeRequest({
                url: endpoint,
                method: "POST",
                data: { amount, phone: userPhone },
            });

            if (![200, 201].includes(status)) {
                setErrors(response?.errors || []);
                return;
            }

            // ✅ Success
            Alert.alert("Success", "Loan application request sent successfully");
            if (onSubmit) {
                onSubmit({ cashout: response?.loan }); // depends on API response shape
            }

            // ✅ Update user next_level in AsyncStorage
            const storedUser = await AsyncStorage.getItem("user");
            if (storedUser) {
                const userData = JSON.parse(storedUser);

                const updatedUser = {
                    ...userData,
                    member_details: {
                        ...userData.member_details,
                        next_level: "pending",
                    },
                };

                await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
            }

            onClose();
        } catch (error) {
            console.error("Loan request error:", error);
            Alert.alert("Error", "Failed to send request. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Request Cashout</Text>

                    <Text>Maximum Limit</Text>
                    <Text style={{ marginBottom: 2, marginTop: 2 }}>{limit}</Text>
                    <Text style={{ margin: 3, marginTop: 5 }}>Enter Amount</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Amount"
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                    />
                    <TextInput
                        style={[styles.input, { backgroundColor: "#f3f4f6", color: "#6b7280" }]}
                        value={userPhone}
                        editable={false}
                    />

                    {loading && <ActivityIndicator size="small" color="#0f766e" style={{ marginBottom: 10 }} />}
                    {message ? <Text>{message}</Text> : null}
                    <View>{errors?.map((err, idx) => (
                        <Text key={idx} style={{ color: "red", marginBottom: 2 }}>{err}</Text>
                    ))}
                    </View>
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: "#0f766e" }]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            <Text style={styles.modalButtonText}>Submit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.modalButton, { backgroundColor: "gray" }]} onPress={onClose}>
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default CashoutFormModal;

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
    modalContent: { width: "90%", backgroundColor: "#fff", padding: 20, borderRadius: 12 },
    modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16, color: "#0f766e" },
    input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, marginBottom: 12 },
    modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
    modalButton: { flex: 1, marginHorizontal: 5, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
    modalButtonText: { color: "#fff", fontWeight: "600" },
});
