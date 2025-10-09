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
import makeRequest from "../utils/makeRequest";

type MpesaTransferModalProps = {
    visible: boolean;
    amount: string;
    transferType: "mpesa" | "wallet";
    memberId: string | number;
    onClose: () => void;
};

const MpesaTransferModal: React.FC<MpesaTransferModalProps> = ({
    visible,
    transferType,
    amount,
    memberId,
    onClose,
}) => {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState<string[]>([]);
    const [scaId, setScaId] = useState("");
    const [transferData, setTransferData] = useState<any>(null);

    useEffect(() => {
        if (visible && memberId) {
            // 🚀 If transfer is wallet, skip OTP and process directly
            if (transferType === "wallet") {
                handleWalletTransfer();
            } else {
                handleRequestOtp();
            }
        } else {
            resetModal();
        }
    }, [visible]);

    const resetModal = () => {
        setOtp("");
        setMessage("");
        setErrors([]);
        setScaId("");
        setTransferData(null);
    };

    // ✅ WALLET TRANSFER — no OTP
    const handleWalletTransfer = async () => {
        try {
            setLoading(true);
            setMessage("Processing wallet transfer...");

            const [status, response] = await makeRequest({
                url: "wallet-transfer",
                method: "POST",
                data: {
                    member_id: memberId,
                    amount: amount,
                },
            });

            if ([200, 201].includes(status)) {
                setMessage("Wallet transfer completed successfully!");
                setErrors([]);
            } else {
                setMessage(response?.message || "Wallet transfer failed");
                setErrors(response?.errors ?? [response?.error]);
            }
        } catch (error) {
            console.error("Wallet transfer error:", error);
            setMessage("Wallet transfer failed. Try again.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ M-Pesa OTP Request
    const handleRequestOtp = async () => {
        try {
            setLoading(true);
            setMessage("Requesting OTP...");
            const endpoint = `mpesa-acceptance-otp-request`;
            const data = {
                amount: amount,
                transferType: transferType,
                id: memberId,
            };
            const [status, response] = await makeRequest({
                url: endpoint,
                data: data,
                method: "POST",
            });
            if ([200, 201].includes(status)) {
                setMessage("OTP has been sent to your phone.");
                if (!(response?.scaId && response?.transferData)) {
                    setErrors(["Could not find scaId or transferData"]);
                    return;
                }
                setScaId(response.scaId);
                setTransferData(response.transferData);
            } else {
                setMessage(response?.message || "Failed to request OTP");
                setErrors(response?.errors ?? [response?.error]);
            }
        } catch (error) {
            console.error("OTP request error:", error);
            setMessage("Failed to send OTP. Try again.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ M-Pesa OTP Confirmation
    const handleConfirmOtp = async () => {
        if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            setErrors(["OTP must be exactly 6 digits"]);
            return;
        }
        try {
            setLoading(true);
            setMessage("Confirming OTP...");
            setErrors([]);

            const endpoint = `mpesa-acceptance-otp-confirm`;
            const [status, response] = await makeRequest({
                url: endpoint,
                method: "POST",
                data: {
                    otp,
                    id: memberId,
                    scaId,
                    transferData,
                },
            });

            if ([200, 201].includes(status)) {
                setMessage("OTP confirmed successfully!");
                onClose();
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
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Confirm Cashout</Text>
                    <Text>Amount: {amount} KES</Text>
                    <Text>Transfer type: {transferType}</Text>

                    {loading && (
                        <ActivityIndicator size="small" color="#0f766e" style={{ marginVertical: 10 }} />
                    )}

                    {message ? <Text style={styles.message}>{message}</Text> : null}

                    {errors.length > 0 && (
                        <View>
                            {errors.map((err, idx) => (
                                <Text key={idx} style={{ color: "red" }}>
                                    {err}
                                </Text>
                            ))}
                        </View>
                    )}

                    {/* Only show OTP input if type is not wallet */}
                    {transferType !== "wallet" && (
                        <>
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
                        </>
                    )}

                    <View style={styles.modalActions}>
                        {transferType !== "wallet" && (
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: "#0f766e" }]}
                                onPress={handleConfirmOtp}
                                disabled={!otp}
                            >
                                <Text style={styles.modalButtonText}>Confirm OTP</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: "gray" }]}
                            onPress={onClose}
                        >
                            <Text style={styles.modalButtonText}>Close</Text>
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
