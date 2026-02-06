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
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
    const [isMemberOnly, setIsMemberOnly] = useState(false);
    const [alternativePhone, setAlternativePhone] = useState("");
    const [showPhoneInput, setShowPhoneInput] = useState(false);
    const [userPhoneNumber, setUserPhoneNumber] = useState("");
    const [useMyNumber, setUseMyNumber] = useState(true);

    useEffect(() => {
        if (visible && memberId) {
            checkUserRole();
        } else {
            resetModal();
        }
    }, [visible]);

    const checkUserRole = async () => {
        try {
            const userDataString = await AsyncStorage.getItem("user");
            if (userDataString) {
                const userData = JSON.parse(userDataString);
                const userGroups = userData?.user_groups || [];

                const memberOnly =
                    !userGroups.includes("transporter") &&
                    !userGroups.includes("employee");

                setIsMemberOnly(memberOnly);

                // Store user's phone number for display from member_details
                setUserPhoneNumber(userData?.member_details?.primary_phone || userData?.primary_phone || userData?.phone_number || userData?.member_phone || "");

                // Auto-request OTP for wallet transfers or non-members
                if (!memberOnly || transferType === "wallet") {
                    handleRequestOtp();
                }
            }
        } catch (error) {
            console.error("Error checking user role:", error);
            // Default to auto-request if error
            handleRequestOtp();
        }
    };

    const resetModal = () => {
        setOtp("");
        setMessage("");
        setErrors([]);
        setScaId("");
        setTransferData(null);
        setAlternativePhone("");
        setShowPhoneInput(false);
        setIsMemberOnly(false);
        setUserPhoneNumber("");
        setUseMyNumber(true);
    };

    const handleRequestOtp = async (phoneNumber?: string) => {
        try {
            setLoading(true);
            setMessage("Requesting OTP...");
            const endpoint = `cash-transfer-otp-request`;
            const data = {
                amount: amount,
                transferType: transferType,
                member_id: memberId,
                ...(phoneNumber && { phone_number: phoneNumber }),
            };
            const [status, response] = await makeRequest({
                url: endpoint,
                data: data as any,
                method: "POST",
            });
            Alert.alert("Error", JSON.stringify(response));
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

    const handleToggleNumber = (useMy: boolean) => {
        setUseMyNumber(useMy);
        if (!useMy) {
            setShowPhoneInput(true);
            setMessage("Enter the phone number to receive OTP");
        } else {
            setShowPhoneInput(false);
            setAlternativePhone("");
            setMessage("");
        }
    };

    const handleRequestOtpWithPhone = () => {
        if (!useMyNumber && !alternativePhone.trim()) {
            setErrors(["Please enter a phone number"]);
            return;
        }
        const phoneToUse = useMyNumber ? undefined : alternativePhone;
        handleRequestOtp(phoneToUse);
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

            const endpoint = `complete-cash-transfer`;
            const [status, response] = await makeRequest({
                url: endpoint,
                method: "POST",
                data: {
                    otp,
                    memberId: memberId,
                    scaId,
                    transferData,
                    transferType: transferType
                } as any,
            });

            if ([200, 201].includes(status)) {
                setMessage("OTP confirmed successfully!");
                Alert.alert("Thank You", "Mpesa withdrawal request sent")
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
                                <Text style={styles.modalTitle}>Confirm Withdrawal</Text>
                            </View>
                            <View style={styles.contentSection}>
                                <Text>Amount: {amount} KES</Text>
                                <Text>Transfer type: {transferType}</Text>

                            {loading && (
                                <ActivityIndicator size="small" color="#0f766e" style={{ marginVertical: 10 }} />
                            )}

                            {message ? <Text style={styles.message}>{message}</Text> : null}

                            {errors?.length > 0 && (
                                <View>
                                    {errors.map((err, idx) => (
                                        <Text key={idx} style={{ color: "red" }}>
                                            {err}
                                        </Text>
                                    ))}
                                </View>
                            )}

                            {/* Show toggle buttons for members only and M-Pesa transfers */}
                            {isMemberOnly && transferType === "mpesa" && !scaId && (
                                <>
                                    <View style={styles.toggleContainer}>
                                        <TouchableOpacity
                                            onPress={() => handleToggleNumber(true)}
                                            style={[
                                                styles.toggleButton,
                                                useMyNumber && styles.toggleButtonActive
                                            ]}
                                        >
                                            <Text style={[
                                                styles.toggleButtonText,
                                                useMyNumber && styles.toggleButtonTextActive
                                            ]}>
                                                My Number
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleToggleNumber(false)}
                                            style={[
                                                styles.toggleButton,
                                                !useMyNumber && styles.toggleButtonActive
                                            ]}
                                        >
                                            <Text style={[
                                                styles.toggleButtonText,
                                                !useMyNumber && styles.toggleButtonTextActive
                                            ]}>
                                                Other Number
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {useMyNumber && (
                                        <View style={styles.phoneDisplayContainer}>
                                            <Text style={styles.phoneLabel}>To: {userPhoneNumber}</Text>
                                        </View>
                                    )}
                                </>
                            )}

                            {/* Show phone input for members when using other number and M-Pesa transfers */}
                            {isMemberOnly && transferType === "mpesa" && showPhoneInput && !scaId && (
                                <>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter phone number (e.g., 254712345678)"
                                        value={alternativePhone}
                                        onChangeText={setAlternativePhone}
                                        keyboardType="numeric"
                                    />
                                </>
                            )}

                            {/* Action buttons for members and M-Pesa transfers */}
                            {isMemberOnly && transferType === "mpesa" && !scaId && (
                                <View style={styles.memberActionButtons}>
                                    {/* <TouchableOpacity
                                onPress={onClose}
                                style={[styles.modalButton, { backgroundColor: "gray", flex: 1, marginRight: 5 }]}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity> */}
                                    <TouchableOpacity
                                        onPress={handleRequestOtpWithPhone}
                                        style={[styles.modalButton, { backgroundColor: "#0f766e", flex: 1, marginLeft: 5 }]}
                                    >
                                        <Text style={styles.modalButtonText}>Proceed</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Only show OTP input if type is not wallet and OTP has been requested */}
                            {transferType && scaId && (
                                <>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter OTP"
                                        value={otp}
                                        onChangeText={setOtp}
                                        keyboardType="numeric"
                                        maxLength={6}
                                    />
                                    <TouchableOpacity onPress={() => handleRequestOtp(alternativePhone || undefined)}>
                                        <Text style={styles.resendLink}>Resend OTP</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={[styles.cancelButton, { backgroundColor: "gray" }]}
                                        onPress={onClose}
                                    >
                                        <Text style={styles.modalButtonText} numberOfLines={1}>Close</Text>
                                    </TouchableOpacity>
                                    {transferType && scaId && (
                                        <TouchableOpacity
                                            style={[styles.modalButton, { backgroundColor: "#0f766e" }]}
                                            onPress={handleConfirmOtp}
                                            disabled={!otp}
                                        >
                                            <Text style={styles.modalButtonText} numberOfLines={1}>Confirm OTP</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
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
    cancelButton: {
        flex: 0.6,
        marginHorizontal: 5,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: "center",
    },
    modalButtonText: {
        color: "#fff",
        fontWeight: "600",
    },
    changeNumberButton: {
        backgroundColor: "#f0f9ff",
        borderWidth: 1,
        borderColor: "#0f766e",
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginVertical: 10,
        alignItems: "center",
    },
    changeNumberText: {
        color: "#0f766e",
        fontWeight: "600",
        fontSize: 14,
    },
    phoneDisplayContainer: {
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginVertical: 10,
    },
    phoneLabel: {
        color: "#374151",
        fontWeight: "500",
        fontSize: 16,
        textAlign: "center",
    },
    toggleContainer: {
        flexDirection: "row",
        marginVertical: 10,
        backgroundColor: "#f1f5f9",
        borderRadius: 8,
        padding: 4,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 6,
        alignItems: "center",
        backgroundColor: "transparent",
    },
    toggleButtonActive: {
        backgroundColor: "#0f766e",
    },
    toggleButtonText: {
        color: "#64748b",
        fontWeight: "600",
        fontSize: 14,
    },
    toggleButtonTextActive: {
        color: "#ffffff",
    },
    memberActionButtons: {
        flexDirection: "row",
        marginVertical: 15,
        justifyContent: "space-between",
    },

});
