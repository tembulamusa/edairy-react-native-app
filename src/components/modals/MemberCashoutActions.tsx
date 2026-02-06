import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import CashoutFormModal from "./CashoutFormModal";
import MemberWalletTransfer from "../screenSections/MemberWalletTransfer";
import fetchCommonData from "../utils/fetchCommonData";
import makeRequest from "../utils/makeRequest";

type MemberCashoutActionsProps = {
    memberId: number;
    selectedMember: any;
    setSelectedmember: (member: any) => void;
    onRefresh?: () => void; // ✅ NEW — optional refresh callback from parent
    customer_type: string;
};

const MemberCashoutActions: React.FC<MemberCashoutActionsProps> = ({
    memberId,
    selectedMember,
    onRefresh,
    setSelectedmember,
    customer_type,
}) => {
    const navigation = useNavigation();
    const [isCashoutModalVisible, setIsCashoutModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [memberWalletBalanceDetails, setMemberWalletBalanceDetails] = useState(null);

    // Add stable UI state to prevent flickering
    const [stableNextLevel, setStableNextLevel] = useState<string | null>(null);
    const [stableBalance, setStableBalance] = useState<number | null>(null);
    const nextLevelChangeCount = React.useRef(0);
    const balanceChangeCount = React.useRef(0); // Track balance changes to prevent UI flickering

    const refreshMemberData = async () => {
        try {
            setLoading(true);

            // define params BEFORE Promise.all
            const params: any = {
                id: selectedMember?.id,
            };

            // run your fetch
            const [members] = await Promise.all([
                fetchCommonData({ name: "cashout_members", params, cachable: false }),
            ]);
            const formattedMembers = members.map((item: any) => ({
                id: item?.id,
                uuid: item?.uuid,
                first_name: item?.customer?.first_name || "",
                last_name: item?.customer?.last_name || "",
                primary_phone: item?.customer?.primary_phone || "",
                wallet_balance: item?.wallet_balance ?? 0,
                next_level: item?.next_level ?? null,
                member_id: item?.customer_id, // used for linking to user.member_id
                member_type: item?.customer_type,
            }));

            // ✅ Update only the selected member if needed
            if (formattedMembers.length > 0) {
                const newMember = formattedMembers[0];
                const newNextLevel = newMember?.next_level?.toLowerCase() ?? "pending";

                // Stabilize nextLevel to prevent flickering
                if (stableNextLevel === newNextLevel) {
                    nextLevelChangeCount.current = 0; // Reset counter when stable
                } else {
                    nextLevelChangeCount.current += 1;
                    // Only update stable state after 2 consecutive same values
                    if (nextLevelChangeCount.current >= 2) {
                        setStableNextLevel(newNextLevel);
                        nextLevelChangeCount.current = 0;
                    }
                }

                setSelectedmember(newMember);
            }

            // ✅ Optionally trigger full list refresh in parent
            if (onRefresh) onRefresh();

        } catch (error) {
            console.error("Error refreshing member:", error);
            Alert.alert("Error", "Could not refresh member data");
        } finally {
            setLoading(false);
        }
    };
    const updateMemberBalance = async () => {

        const [status, response] = await makeRequest(
            {
                url: `wallet-details-balance?owner=member&&member_id=${memberId}`,
                method: "GET",

            }
        );
        let newBalance = 0;
        if ([200, 201].includes(status)) {
            newBalance = response?.data?.currentBalance || 0;
            setMemberWalletBalanceDetails(response?.data || { currentBalance: 0 });
        } else {
            setMemberWalletBalanceDetails({ currentBalance: 0 });
        }

        // Stabilize balance to prevent flickering
        if (stableBalance === newBalance) {
            balanceChangeCount.current = 0; // Reset counter when stable
        } else {
            balanceChangeCount.current += 1;
            // Only update stable state after 2 consecutive same values
            if (balanceChangeCount.current >= 2) {
                setStableBalance(newBalance);
                balanceChangeCount.current = 0;
            }
        }
    }


    useEffect(() => {
        if (!memberId) return;

        const runInitial = async () => {
            await refreshMemberData();
            await updateMemberBalance();

            // Initialize stable values on first load
            if (selectedMember && stableNextLevel === null) {
                setStableNextLevel(selectedMember?.next_level?.toLowerCase() ?? "pending");
            }
            if (memberWalletBalanceDetails && stableBalance === null) {
                setStableBalance(memberWalletBalanceDetails.currentBalance);
            }
        };

        runInitial();

        const interval = setInterval(() => {
            refreshMemberData();
            updateMemberBalance();
        }, 20000); // every 20 seconds

        return () => clearInterval(interval);
    }, [memberId, selectedMember, memberWalletBalanceDetails]);


    if (!selectedMember) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                    Please select a member to view cashouts.
                </Text>
            </View>
        );
    }

    // Use stable values to prevent flickering
    const nextLevel = stableNextLevel || selectedMember?.next_level?.toLowerCase() || "pending";
    const currentBalance = stableBalance !== null ? stableBalance : memberWalletBalanceDetails?.currentBalance || 0;

    // ---- Case: Needs Liveness ----
    if (nextLevel === "liveness") {
        return (
            <View style={{ alignItems: "center", paddingTop: 20 }}>
                <Text style={{ fontSize: 18, textAlign: "center", marginBottom: 16 }}>
                    You need to take a liveness test to proceed.
                </Text>

                <TouchableOpacity
                    onPress={() => {
                        const url = `https://dev.edairy.africa/registration/liveness-check/${selectedMember?.uuid}`;
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
    if (currentBalance <= 500) {
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
                        onSubmit={async ({ cashout }) => {
                            // Optionally show a toast or loader
                            await updateMemberBalance(); // 👈 instantly refresh wallet balance
                            if (onRefresh) onRefresh();  // if parent list also needs refresh
                        }}
                        selectedMember={selectedMember}
                        memberId={memberId}
                        customer_type={customer_type}
                    />
                </View>
            );
        }

        if (nextLevel?.toLowerCase() === "pending") {
            return (
                <View style={styles.emptyState}>
                    <Text>User Pending. Please See later</Text>
                </View>
            );
        }

        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                    Next level is "{nextLevel}". Please Wait or come back later.
                </Text>
            </View>
        );
    }

    // ---- Default: Wallet Transfer ----
    return (
        <View>
            <MemberWalletTransfer
                memberId={memberId}
                walletBalance={currentBalance}
            />
            {(
                <View style={{ marginBottom: 10 }}>
                    <TouchableOpacity
                        style={styles.cashoutButtonContainer}
                        onPress={() => setIsCashoutModalVisible(true)}
                    >
                        <MaterialIcons name="account-balance-wallet" size={20} color="#16a34a" />
                        <Text style={styles.cashoutButtonText2}>Request Cashout</Text>
                    </TouchableOpacity>

                    <CashoutFormModal
                        visible={isCashoutModalVisible}
                        onClose={() => setIsCashoutModalVisible(false)}
                        onSubmit={({ cashout }) => {
                            if (onRefresh) onRefresh();
                        }}
                        selectedMember={selectedMember}
                        memberId={memberId}
                        customer_type={customer_type}
                    />
                </View>
            )}
        </View>
    );

};

export default MemberCashoutActions;

// ---- Styles ----
const styles = StyleSheet.create({
    emptyState: { justifyContent: "center", alignItems: "center", paddingVertical: 20, minHeight: 80 },
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
    cashoutButtonContainer: {
        alignSelf: "flex-end", // floats to the right
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    cashoutButtonText2: {
        color: "#16a34a", // blue
        fontStyle: "italic", // italicized
        fontWeight: "600", // semibold
        textDecorationLine: "underline", // underlined
        marginLeft: 4, // small spacing from icon
    },

});
