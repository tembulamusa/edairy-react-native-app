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
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
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
    const navigation = useNavigation();
    const [amount, setAmount] = useState("");
    const [memberLimit, setMemberLimit] = useState("0");
    const [loading, setLoading] = useState(false);
    const [fetchingLimit, setFetchingLimit] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [minCashout, setMinCashoutLimit] = useState('1000');
    const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);

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
            setSubmittedSuccessfully(false);
            fetchMemberLimit();
        }
    }, [visible, memberId]);

    // 🔹 Handle cashout submit
    const handleSubmit = async () => {
        if (!amount) {
            Alert.alert("Error", "Please enter an amount.");
            return;
        }

        const amountValue = parseFloat(amount);
        const limitValue = parseFloat(memberLimit);
        const minValue = parseFloat(minCashout);

        if (amountValue < minValue) {
            Alert.alert(
                "Amount Too Low",
                `The minimum cashout amount is ${minCashout} KES. Please enter an amount of ${minCashout} KES or more.`
            );
            return;
        }

        if (amountValue > limitValue) {
            Alert.alert(
                "Limit Exceeded",
                `The amount exceeds your credit limit of ${memberLimit} KES. Please enter an amount within your available limit.`
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

            setSubmittedSuccessfully(true);
            Alert.alert("Success", "Loan application request sent successfully", [
                {
                    text: "OK",
                    onPress: () => {
                        onClose();
                        // Navigate to Cashouts tab and pass member ID for auto-selection
                        navigation.navigate("Cashouts" as never, {
                            memberId: selectedMember?.member_id ?? selectedMember?.id ?? memberId,
                        } as never);
                    },
                },
            ]);

            if (onSubmit) onSubmit({ cashout: response?.loan });
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
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <View style={styles.modalOverlay}>
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 0 }}
                        keyboardShouldPersistTaps="handled"
                        style={{ width: "100%" }}
                    >
                        <View style={styles.modalContent}>
                    <View style={styles.titleSection}>
                        <Text style={styles.modalTitle}>Request Cashout</Text>
                    </View>
                    <View style={styles.contentSection}>
                    {fetchingLimit ? (
                        <ActivityIndicator size="large" color="#0f766e" />
                    ) : (
                        <>
                            <View style={styles.infoContainer}>
                                <Text style={styles.infoLabel}>Credit Limit:</Text>
                                <Text style={styles.infoValue}>{memberLimit} KES</Text>
                            </View>

                            <Text style={styles.label}>Enter Amount</Text>
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

                    {message && <Text style={styles.messageText}>{message}</Text>}
                    {errors.length > 0 && (
                        <View style={styles.errorContainer}>
                            {errors.map((err, idx) => (
                                <Text
                                    key={idx}
                                    style={styles.errorText}
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
                                { backgroundColor: "gray" },
                            ]}
                            onPress={onClose}
                        >
                            <Text style={styles.modalButtonText}>
                                {submittedSuccessfully ? "Close" : "Cancel"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.modalButton,
                                { backgroundColor: "#0f766e" },
                            ]}
                            onPress={handleSubmit}
                            disabled={loading || fetchingLimit || submittedSuccessfully}
                        >
                            <Text style={styles.modalButtonText}>Submit</Text>
                        </TouchableOpacity>
                    </View>
                    </View>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default CashoutFormModal;

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        width: "90%",
        backgroundColor: "#fff",
        padding: 0,
        borderRadius: 16,
        alignSelf: "center",
        overflow: "hidden",
    },
    titleSection: {
        width: "100%",
        backgroundColor: "#0f766e",
        paddingVertical: 20,
        paddingHorizontal: 30,
    },
    contentSection: {
        padding: 30,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#fff",
        textAlign: "center",
    },
    input: {
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
        padding: 14,
        marginTop: 8,
        marginBottom: 16,
        fontSize: 16,
        backgroundColor: "#f9fafb",
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    modalButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: "500",
        color: "#374151",
        marginBottom: 8,
    },
    infoContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#f3f4f6",
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
    },
    infoLabel: {
        fontSize: 15,
        fontWeight: "500",
        color: "#6b7280",
    },
    infoValue: {
        fontSize: 16,
        fontWeight: "700",
        color: "#0f766e",
    },
    errorContainer: {
        marginTop: 12,
        marginBottom: 8,
    },
    errorText: {
        color: "#dc2626",
        fontSize: 14,
        marginBottom: 4,
    },
    messageText: {
        color: "#16a34a",
        fontSize: 14,
        marginTop: 8,
        marginBottom: 8,
    },
});
