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
type MemberWalletTransferProps = {
    memberId: number | null;
    walletBalance?: number;
};
const MemberWalletTransfer: React.FC<MemberWalletTransferProps> = ({
    memberId,
    walletBalance,
}) => {
    const [amount, setAmount] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const [walletTransferType, setWalletTransferType] = useState<
        "mpesa" | "paybill" | "wallet"
    >("mpesa");
    const [walletDetails, setWalletDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [withdrawalCharge, setWithdrawalCharge] = useState(20); // can also be dynamic
    const [availableBalance, setavailableBalance] = useState(0);

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
                    const balance = response?.data?.availableBalance || response?.data?.currentBalance || 0;
                    setWalletDetails(response?.data || { availableBalance: 0 });
                    setavailableBalance(balance);
                } else {
                    setWalletDetails({ availableBalance: 0 });
                    setavailableBalance(0);
                }
            } catch (error) {
                console.error("Failed to fetch wallet details:", error);
                setWalletDetails({ availableBalance: 0 });
                Alert.alert("Error", "Failed to fetch wallet balance.");
            } finally {
                setLoading(false);
            }
        };

        fetchWalletDetails();
    }, [memberId]);

    if (!memberId) return null;

    // Use availableBalance state for display, falling back to walletBalance prop or walletDetails
    const displayBalance = availableBalance || walletBalance || walletDetails?.availableBalance || 0;


    const requestTransfer = (type: "mpesa" | "paybill" | "wallet") => {
        const amountNum = parseFloat(amount);
        if (!amountNum || amountNum <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount.");
            return;
        }

        let totalAmount = amountNum;

        if (type === "mpesa") {
            totalAmount += withdrawalCharge;
            if (totalAmount > displayBalance) {
                Alert.alert(
                    "Insufficient Balance",
                    `You need ${totalAmount} KES (amount + withdrawal charge), but your balance is only ${displayBalance} KES.`
                );
                return;
            }
        } else if (amountNum > displayBalance) {
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
                    : `${walletDetails?.availableBalance.toFixed(2) ?? "unavailable"} KES`}
            </Text>

            <TextInput
                placeholder="Enter amount"
                keyboardType="numeric"
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
            />

            <Text style={{ fontSize: 14, marginBottom: 4 }}>Send TO:</Text>
            {/* <Text style={{ fontSize: 18, marginBottom: 4 }}>{memberId}</Text> */}
            <View style={styles.walletButtonsRow}>
                {/* 🟡 Store/Wallet (left) */}
                <TouchableOpacity
                    style={[
                        styles.walletButton,
                        styles.walletButtonYellow,
                        (!amount || loading) && { opacity: 0.5 },
                    ]}
                    disabled={!amount || loading}
                    onPress={() => requestTransfer("wallet")}
                >
                    <Text style={styles.walletButtonText}>Store/Member</Text>
                </TouchableOpacity>

                {/* 🟢 M-Pesa (right) */}
                <TouchableOpacity
                    style={[
                        styles.walletButton,
                        styles.walletButtonGreen,
                        (!amount || loading) && { opacity: 0.5 },
                    ]}
                    disabled={!amount || loading}
                    onPress={() => requestTransfer("mpesa")}
                >
                    <Text style={styles.walletButtonText}>M-Pesa</Text>
                </TouchableOpacity>
            </View>

            {modalVisible && (
                <MpesaTransferModal
                    visible={modalVisible}
                    amount={amount}
                    memberId={memberId}
                    transferType={walletTransferType}
                    withdrawalCharge={walletTransferType === "mpesa" ? withdrawalCharge : 0}
                    onSend={() => {
                        const amt = parseFloat(amount) || 0;
                        const totalDeduction =
                            walletTransferType === "mpesa" ? amt + withdrawalCharge : amt;
                        // ✅ Optimistically update the balance
                        setWalletDetails((prev: any) => ({
                            ...prev,
                            availableBalance: Math.max(0, (prev?.availableBalance ?? 0) - totalDeduction),
                        }));

                        setAmount("");
                        setModalVisible(false);
                    }}
                    onClose={() => {
                        setModalVisible(false);
                        setAmount("");
                    }}
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
        gap: 8,
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
    walletButtonYellow: {
        backgroundColor: "#F59E0B", // 🟡 warm orange-yellow
    },
    walletButtonGreen: {
        backgroundColor: "#16a34a", // 🟢 mpesa green
    },

});
