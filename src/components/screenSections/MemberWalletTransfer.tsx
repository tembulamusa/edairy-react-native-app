import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    StyleSheet,
} from "react-native";
import MpesaTransferModal from "../modals/MpesaTransferModal";
import makeRequest from "../utils/makeRequest";

const MemberWalletTransfer = ({ memberId }: { memberId: number | null }) => {
    const [amount, setAmount] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const [walletTransferType, setWalletTransferType] = useState<
        "mpesa" | "paybill" | "wallet"
    >("mpesa");
    const [walletDetails, setWalletDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [withdrawalCharge, setWithdrawalCharge] = useState(20); // can also be dynamic

    useEffect(() => {
        if (!memberId) return;

        const fetchWalletDetails = async () => {
            try {
                setLoading(true);
                const [status, response] = await makeRequest(
                    {
                        url: `wallet-details-balance?owner=member&&member_id=${memberId}`,
                        method: "GET",

                    }
                );

                if ([200, 201].includes(status)) {
                    setWalletDetails(response?.data || { currentBalance: 100 });
                } else {
                    setWalletDetails({ currentBalance: 0 });
                }
            } catch (error) {
                console.error("Failed to fetch wallet details:", error);
                setWalletDetails({ currentBalance: 0 });
                Alert.alert("Error", "Failed to fetch wallet balance.");
            } finally {
                setLoading(false);
            }
        };

        fetchWalletDetails();
    }, [memberId]);

    if (!memberId) return null;

    const currentBalance = walletDetails?.currentBalance ?? 0;

    const requestTransfer = (type: "mpesa" | "paybill" | "wallet") => {
        const amountNum = parseFloat(amount);
        if (!amountNum || amountNum <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount.");
            return;
        }

        let totalAmount = amountNum;

        if (type === "mpesa") {
            totalAmount += withdrawalCharge;
            if (totalAmount > currentBalance) {
                Alert.alert(
                    "Insufficient Balance",
                    `You need ${totalAmount} KES (amount + withdrawal charge), but your balance is only ${currentBalance} KES.`
                );
                return;
            }
        } else if (amountNum > currentBalance) {
            Alert.alert(
                "Insufficient Balance",
                "Amount exceeds your wallet balance."
            );
            return;
        }

        setWalletTransferType(type);
        setModalVisible(true);
    };

    return (
        <View style={styles.walletContainer}>
            <Text style={styles.walletText}>
                Wallet Balance:{" "}
                {loading
                    ? "Loading..."
                    : `${currentBalance.toFixed(2)} KES`}
            </Text>

            <TextInput
                placeholder="Enter amount"
                keyboardType="numeric"
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
            />

            <Text style={{ fontSize: 14, marginBottom: 4 }}>Send TO:</Text>
            <View style={styles.walletButtonsRow}>
                {(["mpesa", "wallet"] as const).map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.walletButton,
                            (!amount || loading) && { opacity: 0.5 },
                        ]}
                        disabled={!amount || loading}
                        onPress={() => requestTransfer(type)}
                    >
                        <Text style={styles.walletButtonText}>
                            {type === "wallet"
                                ? "Store/Member"
                                : type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {modalVisible && (
                <MpesaTransferModal
                    visible={modalVisible}
                    amount={amount}
                    memberId={memberId}
                    transferType={walletTransferType}
                    withdrawalCharge={
                        walletTransferType === "mpesa" ? withdrawalCharge : 0
                    }
                    onSend={() => {
                        setModalVisible(false);
                        setAmount("");
                    }}
                    onClose={() => setModalVisible(false)}
                />
            )}
        </View>
    );
};

export default MemberWalletTransfer;

const styles = StyleSheet.create({
    walletContainer: {
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
    },
    walletText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
        marginBottom: 8,
    },
    amountInput: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
    },
    walletButtonsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    walletButton: {
        backgroundColor: "#0f766e",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        flex: 1,
        marginHorizontal: 4,
    },
    walletButtonText: {
        color: "#fff",
        fontWeight: "600",
        textAlign: "center",
        fontSize: 12,
    },
});
