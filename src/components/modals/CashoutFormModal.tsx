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
import makeRequest from "../utils/makeRequest";

type CashoutFormModalProps = {
    selectedMember: any;
    visible: boolean;
    memberId: number;
    customer_type: string;
    onSubmit?: (data: { cashout: {} }) => void;
    onClose: () => void;
};

const CashoutFormModal: React.FC<CashoutFormModalProps> = ({
    selectedMember,
    memberId,
    visible,
    customer_type,
    onSubmit,
    onClose,
}) => {
    const [amount, setAmount] = useState("");
    const [memberLimit, setMemberLimit] = useState("0");
    const [loading, setLoading] = useState(false);
    const [fetchingLimit, setFetchingLimit] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [minCashout, setMinCashoutLimit] = useState('1000');

    // 🔹 Fetch member credit limit when modal opens or memberId changes
    useEffect(() => {
        const fetchMemberLimit = async () => {
            if (!memberId) return;

            setFetchingLimit(true);
            try {
                const endpoint = `member-credit-limit?member=${selectedMember?.member_id ?? selectedMember?.id}`;
                const [status, response] = await makeRequest({
                    url: endpoint,
                    method: "GET",
                });
                if (status === 200 && response?.data) {
                    setMemberLimit(
                        response?.data?.credit_limit?.toString() || "0"
                    );
                } else {
                    Alert.alert("Error", "Failed to fetch member credit limit");
                }
            } catch (err) {
                console.error("Error fetching member credit limit:", err);
                Alert.alert("Error", "Could not load member credit limit.");
            } finally {
                setFetchingLimit(false);
            }
        };

        if (visible) {
            setAmount("");
            fetchMemberLimit();
        }
    }, [visible, memberId]);

    // 🔹 Handle cashout submit
    const handleSubmit = async () => {
        if (!amount) {
            Alert.alert("Error", "Please enter an amount.");
            return;
        }

        if (parseFloat(amount) > parseFloat(memberLimit) || parseFloat(amount) < parseFloat(minCashout)) {
            Alert.alert(
                "Limit Exceeded",
                `Amount cannot exceed credit limit of ${memberLimit} KES`
            );
            return;
        }

        try {
            setLoading(true);
            setErrors([]);
            setMessage(null);

            const endpoint = `loan-request`;
            let data = {amount, 
                member_id: selectedMember?.member_id ?? selectedMember?.id,
                customer_type: customer_type,
             } as any;
            const [status, response] = await makeRequest({
                url: endpoint,
                method: "POST",
                data,
            });
            if (![200, 201].includes(status)) {
                setErrors(response?.errors || ["Something went wrong."]);
                return;
            }

            Alert.alert("Success", "Loan application request sent successfully");

            if (onSubmit) onSubmit({ cashout: response?.loan });
            onClose();
        } catch (error) {
            console.error("Loan request error:", error);
            Alert.alert("Error", "Failed to send request. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Request Cashout</Text>
                    {fetchingLimit ? (
                        <ActivityIndicator size="large" color="#0f766e" />
                    ) : (
                        <>
                            <Text>Credit Limit: {memberLimit} KES</Text>

                            <Text style={{ marginTop: 8 }}>Enter Amount</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter Amount"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                            />
                        </>
                    )}

                    {loading && (
                        <ActivityIndicator
                            size="small"
                            color="#0f766e"
                            style={{ marginBottom: 10 }}
                        />
                    )}

                    {message && <Text>{message}</Text>}
                    {errors.length > 0 && (
                        <View>
                            {errors.map((err, idx) => (
                                <Text
                                    key={idx}
                                    style={{ color: "red", marginBottom: 2 }}
                                >
                                    {err}
                                </Text>
                            ))}
                        </View>
                    )}

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[
                                styles.modalButton,
                                { backgroundColor: "#0f766e" },
                            ]}
                            onPress={handleSubmit}
                            disabled={loading || fetchingLimit}
                        >
                            <Text style={styles.modalButtonText}>Submit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.modalButton,
                                { backgroundColor: "gray" },
                            ]}
                            onPress={onClose}
                        >
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
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        width: "90%",
        backgroundColor: "#fff",
        padding: 20,
        borderRadius: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 16,
        color: "#0f766e",
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 10,
    },
    modalButton: {
        flex: 1,
        marginHorizontal: 5,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: "center",
    },
    modalButtonText: {
        color: "#fff",
        fontWeight: "600",
    },
});
