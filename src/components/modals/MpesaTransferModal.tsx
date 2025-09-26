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
} from "react-native";
import makeRequest from "../utils/makeRequest"; // ✅ adjust path

type MpesaTransferModalProps = {
    visible: boolean;
    amount: string;
    activeCashout: { id?: string };
    onConfirm: (otp: string) => void; // confirm handler with otp
    onClose: () => void;
};

const MpesaTransferModal: React.FC<MpesaTransferModalProps> = ({
    visible,
    amount,
    activeCashout,
    onClose,

}) => {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState([]);
    const [scaId, setScaId] = useState('');
    const [transferData, setTransferData] = useState();

    // Auto-trigger OTP when modal opens
    useEffect(() => {
        if (visible && activeCashout?.id) {
            handleRequestOtp();
        } else {
            setOtp("");
            setMessage("");
        }
    }, [visible]);

    const handleRequestOtp = async () => {
        if (!activeCashout?.id) return;

        try {
            setLoading(true);
            setMessage("");
            const endpoint = `mpesa-acceptance-otp-request?id=${activeCashout['uuid']}`;
            const [status, response] = await makeRequest({
                url: endpoint,
                method: "GET",
            });
            if ([200, 201].includes(status)) {

                setMessage("OTP has been sent to your phone.");
                if (!(response?.scaId && response?.transferData)) {
                    setErrors(['could not find scaId and/or transferData'])
                    return;
                }
                setScaId(response?.scaId);
                setTransferData(response?.transferData);
            } else {
                setMessage(response?.message || "Failed to request OTP");
                setErrors(response?.[0]?.details?.['errors'] ?? response?.errors);
            }
        } catch (error) {
            console.error("OTP request error:", error);
            setMessage("Failed to send OTP. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmOtp = async () => {
        // Validate OTP
        if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            setErrors(["OTP must be exactly 6 digits"]);
            return;
        }
        try {
            setLoading(true);
            setMessage("");
            setErrors([]);

            const endpoint = `mpesa-acceptance-otp-confirm`;
            const [status, response] = await makeRequest({
                url: endpoint,
                method: "POST",
                data: {
                    'otp': otp,
                    'id': activeCashout['uuid'],
                    'scaId': scaId,
                    'transferData': transferData
                },
            });
            if ([200, 201].includes(status)) {
                setMessage("OTP confirmed successfully.");
                onClose()
                onApproved({ ...activeCashout, status: "mpesarequested" });
            } else {
                setMessage(response?.message || "Failed to confirm OTP");
                setErrors(response?.errors ?? [response?.error]);
            }
        } catch (error) {
            console.error("OTP confirm error:", error);
            setMessage("Failed to confirm OTP. Try again.");
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
                    <Text style={styles.modalTitle}>Confirm Cashout</Text>
                    <Text>Cashout amount: {amount} KES</Text>

                    {loading && (
                        <ActivityIndicator
                            size="small"
                            color="#0f766e"
                            style={{ marginVertical: 10 }}
                        />
                    )}

                    {message ? <Text style={styles.message}>{message}</Text> : null}
                    <View>{errors?.map((err, idx) => (
                        <Text key={idx} style={{ color: "red", marginBottom: 2 }}>{err}</Text>
                    ))}
                    </View>
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
                            onPress={() => handleConfirmOtp()}
                            disabled={!otp}
                        >
                            <Text style={styles.modalButtonText}>Confirm OTP</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: "gray" }]}
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

export default MpesaTransferModal;

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
