import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    StyleSheet,
} from "react-native";
import MpesaTransferModal from "../modals/MpesaTransferModal";

const MemberWalletTransfer = ({ memberId }: { memberId: number | null }) => {
    const [amount, setAmount] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const [walletTransferType, setWalletTransferType] = useState<
        "mpesa" | "paybill" | "wallet"
    >("mpesa");
    const [walletBalance, setWalletBalance] = useState(1000);
    const [withdrawalCharge, setWithdrawalCharge] = useState(20); // e.g., static or fetched from API

    if (!memberId) return null;

    const requestTransfer = (type: "mpesa" | "paybill" | "wallet") => {
        const amountNum = parseFloat(amount);
        if (!amountNum || amountNum <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount.");
            return;
        }

        let totalAmount = amountNum;

        if (type === "mpesa") {
            totalAmount += withdrawalCharge;
            if (totalAmount > walletBalance) {
                Alert.alert(
                    "Insufficient Balance",
                    `You need ${totalAmount} KES (amount + withdrawal charge), but your balance is only ${walletBalance} KES.`
                );
                return;
            }
        } else {
            if (amountNum > walletBalance) {
                Alert.alert(
                    "Insufficient Balance",
                    "Amount exceeds your wallet balance."
                );
                return;
            }
        }

        setWalletTransferType(type);
        setModalVisible(true);
    };

    return (
        <View style={styles.walletContainer}>
            <Text style={styles.walletText}>
                Wallet Balance: {walletBalance.toFixed(2)} KES
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
                            !amount && { opacity: 0.5 },
                        ]}
                        disabled={!amount}
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
