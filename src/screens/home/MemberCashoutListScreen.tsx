import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DropDownPicker from "react-native-dropdown-picker";

import fetchCommonData from "../../components/utils/fetchCommonData";
import CashoutsListComponent from "../../components/screenSections/MemberCashoutsComponent";
import MemberCashoutActions from "../../components/modals/MemberCashoutActions";

const MemberCashoutListScreen: React.FC = () => {
    const navigation = useNavigation();

    // ---- STATE ----
    const [loading, setLoading] = useState(false);
    const [cashouts, setCashouts] = useState<any[]>([]);
    const [commonData, setCommonData] = useState<{ members?: any[] }>({});
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [selectedMember, setSelectedMember] = useState<any | null>(null); // ✅ NEW
    const [memberOpen, setMemberOpen] = useState(false);
    const [memberItems, setMemberItems] = useState<{ label: string; value: number }[]>([]);
    const [nextLevel, setNextLevel] = useState<string | null>(null);
    const [memberType, setmemberType] = useState("member");

    useEffect(() => {
        (async () => {
            try {
                const storedUser = await AsyncStorage.getItem("user");
                if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    setNextLevel(userData?.member_details?.next_level || null);
                }
            } catch (err) {
                console.error("Error loading user next_level", err);
                Alert.alert("Error", "Failed to load user info");
            }
        })();
    }, []);

    // ---- EFFECT: Load members ----
    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [members] = await Promise.all([
                    fetchCommonData({ name: "cashout_members", cachable: false }),
                ]);
                const formattedMembers = members.map((item: any) => ({
                    id: item?.id,
                    uuid: item?.uuid,
                    first_name: item?.customer?.first_name || "",
                    last_name: item?.customer?.last_name || "",
                    primary_phone: item?.customer?.primary_phone || "",
                    wallet_balance: item?.wallet_balance ?? 0,
                    next_level: item?.next_level ?? null,
                    member_id: item?.customer_id,
                    member_type: item?.customer_type
                }));

                setCommonData({ members: formattedMembers });
                setMemberItems(
                    formattedMembers.map((m) => ({
                        label: `${m.first_name} ${m.last_name} (${m.primary_phone})`,
                        value: Number(m.id),
                    }))
                );
            } catch (error) {
                console.error("❌ Failed to load common data", error);
                Alert.alert("Error", "Failed to load members");
            }
        };

        loadCommonData();
    }, []);

    useEffect(() => {
        if (memberValue && commonData?.members?.length) {
            const found = commonData.members.find((m) => m.id === memberValue);
            setSelectedMember(found || null);
        } else {
            setSelectedMember(null);
        }
    }, [memberValue, commonData]);
    const handleRefresh = async () => {
        try {
            setLoading(true);
            const [members] = await Promise.all([
                fetchCommonData({ name: "cashout_members", cachable: false }),
            ]);

            const formattedMembers = members.map((item: any) => ({
                id: item?.id,
                uuid: item?.uuid,
                first_name: item?.customer?.first_name || "",
                last_name: item?.customer?.last_name || "",
                primary_phone: item?.customer?.primary_phone || "",
                wallet_balance: item?.wallet_balance ?? 0,
                next_level: item?.next_level ?? null,
                member_id: item?.customer_id,
                member_type: item?.customer_type,
            }));

            setCommonData({ members: formattedMembers });
            setMemberItems(
                formattedMembers.map((m) => ({
                    label: `${m.first_name} ${m.last_name} (${m.primary_phone})`,
                    value: Number(m.id),
                }))
            );

            // 🔁 Maintain the same selected member
            if (memberValue) {
                const found = formattedMembers.find((m) => m.id === memberValue);
                setSelectedMember(found || null);
            }
        } catch (error) {
            console.error("❌ Refresh failed", error);
            Alert.alert("Error", "Failed to refresh data.");
        } finally {
            setLoading(false);
        }
    };
    // ---- RENDER ----
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={styles.header}>Cashouts</Text>
            </View>

            {/* Member Dropdown */}
            <View style={{ zIndex: 1000 }}>
                <DropDownPicker
                    open={memberOpen}
                    value={memberValue}
                    items={memberItems}
                    setOpen={setMemberOpen}
                    setValue={setMemberValue}
                    setItems={setMemberItems}
                    placeholder="Select member"
                    searchable
                    searchPlaceholder="Search member..."
                    zIndex={2000}
                    zIndexInverse={1000}
                    style={styles.dropdown}
                    dropDownContainerStyle={{ borderColor: "#ccc" }}
                />
            </View>

            {/* Cashouts Section */}
            <View style={{ flex: 1 }}>

                {!memberValue ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            Please select a member to view cashouts.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* ✅ Pass selectedMember into actions */}
                        <MemberCashoutActions
                            memberId={memberValue}
                            selectedMember={selectedMember}
                            onRefresh={handleRefresh} // ✅ pass refresh callback
                        />

                        <CashoutsListComponent memberId={memberValue} />
                    </>
                )}
            </View>
        </View>
    );
};

export default MemberCashoutListScreen;


const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: "#f7fafc" },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    header: { fontSize: 22, fontWeight: "700", color: "#0f766e" },
    addButton: { backgroundColor: "#0f766e", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    addButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
    dropdown: { marginBottom: 16, borderColor: "#ccc" },
    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
    emptyText: { fontSize: 16, color: "#6b7280", textAlign: "center", fontWeight: "500" },
    walletContainer: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
    walletText: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 },
    amountInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10, marginBottom: 12 },
    walletButtonsRow: { flexDirection: "row", justifyContent: "space-between" },
    walletButton: { backgroundColor: "#0f766e", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flex: 1, marginHorizontal: 4 },
    walletButtonText: { color: "#fff", fontWeight: "600", textAlign: "center", fontSize: 12 },
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
    livenessButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
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
    notifyButtonText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
    },
    cashoutButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16a34a",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    cashoutButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
        marginLeft: 8,
    },

});
