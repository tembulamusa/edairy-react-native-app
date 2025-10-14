import React from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import CashoutFormModal from "./CashoutFormModal";
import MemberWalletTransfer from "../screenSections/MemberWalletTransfer";

type MemberCashoutActionsProps = {
    memberId: number;
    selectedMember: any;
    setSelectedmember: (member: any) => void;
    onRefresh?: () => void; // ✅ NEW — optional refresh callback from parent
};

const MemberCashoutActions: React.FC<MemberCashoutActionsProps> = ({
    memberId,
    selectedMember,
    onRefresh,
}) => {
    const navigation = useNavigation();
    const [isCashoutModalVisible, setIsCashoutModalVisible] = React.useState(false);

    if (!selectedMember) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                    Please select a member to view cashouts.
                </Text>
            </View>
        );
    }

    const walletBalance = selectedMember?.wallet_balance ?? 0;
    const nextLevel = selectedMember?.next_level ?? "pending";

    // ---- Case: Needs Liveness ----
    if (nextLevel === "liveness") {
        return (
            <View style={{ alignItems: "center", paddingTop: 20 }}>
                <Text style={{ fontSize: 18, textAlign: "center", marginBottom: 16 }}>
                    You need to take a liveness test to proceed.
                </Text>

                <TouchableOpacity
                    onPress={() => {
                        const url = `http://192.168.100.18:8000/liveness-check/${selectedMember?.uuid}`;
                        navigation.navigate("Members" as never, {
                            screen: "LivenessCheck",
                            params: { url },
                        } as never);
                    }}
                    style={styles.livenessButton}
                >
                    <MaterialIcons name="videocam" size={22} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.livenessButtonText}>Proceed to Liveness Test</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ---- Case: Wallet too low ----
    if (walletBalance <= 500) {
        if (nextLevel === "admin_verify") {
            return (
                <View style={styles.warningContainer}>
                    <MaterialIcons name="warning" size={40} color="#d97706" />
                    <Text style={styles.warningText}>
                        Please wait for system verification or contact admin for this action.
                    </Text>

                    <TouchableOpacity
                        onPress={() => Alert.alert("Notification", "Admin will be notified.")}
                        style={styles.notifyButton}
                    >
                        <MaterialIcons name="notifications-active" size={20} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.notifyButtonText}>Notify Admin</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (nextLevel?.toLowerCase() === "loan") {
            return (
                <View style={styles.emptyState}>
                    <Text style={{ fontSize: 20, paddingTop: 12, textAlign: "center" }}>
                        You can Request for a cashout for this Member
                    </Text>

                    <TouchableOpacity
                        style={styles.cashoutButton}
                        onPress={() => setIsCashoutModalVisible(true)}
                    >
                        <MaterialIcons name="account-balance-wallet" size={20} color="#fff" />
                        <Text style={styles.cashoutButtonText}>Request Cashout</Text>
                    </TouchableOpacity>

                    <CashoutFormModal
                        visible={isCashoutModalVisible}
                        onClose={() => setIsCashoutModalVisible(false)}
                        onSubmit={({ cashout }) => {
                            Alert.alert("Cashout Requested", "Cashout successfully submitted!");
                            if (onRefresh) onRefresh();
                        }}
                        selectedMember={selectedMember}
                        memberId={memberId}
                    />
                </View>
            );
        }

        if (nextLevel?.toLowerCase() === "pending") {
            return (
                <View style={styles.emptyState}>

                </View>
            );
        }

        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                    Default: Next level is "{nextLevel}". Please come back later.
                </Text>
            </View>
        );
    }

    // ---- Default: Wallet Transfer ----
    return <MemberWalletTransfer memberId={memberId} />;
};

export default MemberCashoutActions;

// ---- Styles ----
const styles = StyleSheet.create({
    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
    emptyText: { fontSize: 16, color: "#6b7280", textAlign: "center", fontWeight: "500" },
    livenessButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f766e",
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 30,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
    },
    livenessButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
    warningContainer: {
        backgroundColor: "#FEF3C7",
        borderColor: "#FBBF24",
        borderWidth: 1,
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 10,
        marginTop: 40,
    },
    warningText: {
        color: "#92400E",
        fontSize: 16,
        fontWeight: "500",
        textAlign: "center",
        marginVertical: 12,
        lineHeight: 22,
    },
    notifyButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F59E0B",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        elevation: 2,
    },
    notifyButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
    cashoutButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16a34a",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    cashoutButtonText: { color: "#fff", fontWeight: "600", fontSize: 16, marginLeft: 8 },
});
