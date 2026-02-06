import React, { useEffect, useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import SmsRetriever from "react-native-sms-retriever";
import makeRequest from "../utils/makeRequest";

type AcceptanceModalProps = {
    visible: boolean;
    amount: string;
    activeCashout: { id?: string; uuid?: string };
    onClose: () => void;
};

const AcceptanceModal: React.FC<AcceptanceModalProps> = ({
    visible,
    amount,
    activeCashout,
    onClose,
}) => {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState<string[]>([]);

    // 🟩 When modal opens, request OTP and start SMS listener
    useEffect(() => {
        if (visible && activeCashout?.id) {
            handleRequestOtp();
            startSmsListener();
        } else {
            stopSmsListener();
            setOtp("");
            setMessage("");
            setErrors([]);
        }
        return stopSmsListener;
    }, [visible]);

    // 🟩 SMS listening and auto-fill
    const startSmsListener = async () => {
        try {
            await SmsRetriever.startSmsRetriever();
            const subscription = SmsRetriever.addSmsListener(event => {
                const msg = event.message || "";
                // ✅ Example: "Your DTB OTP is 123456"
                const otpMatch = msg.match(/\b\d{6}\b/);
                if (otpMatch) {
                    const detectedOtp = otpMatch[0];
                    setOtp(detectedOtp);
                    setMessage("OTP auto-filled from SMS");
                }
                SmsRetriever.removeSmsListener();
            });

            // store subscription if needed
        } catch (error) {
            console.log("Error starting SMS retriever:", error);
        }
    };

    const stopSmsListener = () => {
        try {
            SmsRetriever.removeSmsListener();
        } catch (error) {
            console.log("Error removing SMS listener:", error);
        }
    };

    // 🔹 Request OTP
    const handleRequestOtp = async () => {
        if (!activeCashout?.uuid) return;

        try {
            setLoading(true);
            setMessage("");
            const [status, response] = await makeRequest({
                url: `loan-acceptance-otp-request?id=${activeCashout.uuid}`,
                method: "GET",
            });
            if ([200, 201].includes(status)) {
                setMessage("OTP has been sent to your phone.");
            } else {
                setMessage(response?.message || "Failed to request OTP");
                setErrors(response?.errors || []);
            }
        } catch (error) {
            console.error("OTP request error:", error);
            setMessage("Failed to send OTP. Try again.");
        } finally {
            setLoading(false);
        }
    };

    // 🔹 Confirm OTP
    const handleConfirmOtp = async () => {
        if (!otp || otp.length !== 6) {
            setErrors(["OTP must be exactly 6 digits"]);
            return;
        }

        if (!activeCashout?.uuid) {
            setErrors(["Invalid cashout data. Please try again."]);
            return;
        }

        try {
            setLoading(true);
            setMessage("");
            setErrors([]);
            const [status, response] = await makeRequest({
                url: "loan-acceptance-otp-confirm",
                method: "POST",
                data: { otp, id: activeCashout.uuid } as any,
            });
            if ([200, 201].includes(status)) {
                setMessage("OTP confirmed successfully.");
                onClose();
            } else {
                setMessage(response?.message || "Failed to confirm OTP");
                setErrors(response?.errors || []);
            }
        } catch (error) {
            console.error("OTP confirm error:", error);
            setMessage("Failed to confirm OTP. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <View style={styles.modalOverlay}>
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.titleSection}>
                                <Text style={styles.modalTitle}>Confirm Cashout</Text>
                            </View>
                            <View style={styles.contentSection}>
                                    <Text>Cashout amount: {amount} KES</Text>

                                {loading && <ActivityIndicator size="small" color="#0f766e" style={{ marginVertical: 10 }} />}
                                {message ? <Text style={styles.message}>{message}</Text> : null}

                                {errors?.map((err, idx) => (
                                    <Text key={idx} style={{ color: "red", marginBottom: 2 }}>{err}</Text>
                                ))}

                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter OTP"
                                    value={otp}
                                    onChangeText={setOtp}
                                    keyboardType="numeric"
                                    maxLength={6}
                                />

                                <TouchableOpacity onPress={handleRequestOtp}>
                                    <Text style={styles.resendLink}>Resend OTP</Text>
                                </TouchableOpacity>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: "#0f766e" }]}
                                        onPress={handleConfirmOtp}
                                        disabled={!otp}
                                    >
                                        <Text style={styles.modalButtonText} numberOfLines={1}>Confirm OTP</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: "gray" }]}
                                        onPress={onClose}
                                    >
                                        <Text style={styles.modalButtonText} numberOfLines={1}>Cancel</Text>
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

export default AcceptanceModal;

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        minWidth: "90%",
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 12,
    },
    titleSection: {
        width: "100%",
        backgroundColor: "#0f766e",
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#fff",
        textAlign: "center",
    },
    contentSection: {
        padding: 20,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 10,
        marginVertical: 12,
    },
    message: {
        fontSize: 13,
        color: "#444",
        marginBottom: 8,
    },
    resendLink: {
        fontSize: 13,
        color: "#0f766e",
        marginBottom: 16,
        textAlign: "right",
        textDecorationLine: "underline",
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 16,
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
