import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DropDownPicker from "react-native-dropdown-picker";

import CashoutFormModal from "../../components/modals/CashoutFormModal";
import AcceptanceModal from "../../components/modals/AcceptanceModal";
import makeRequest from "../../components/utils/makeRequest";
import fetchCommonData from "../../components/utils/fetchCommonData";
import CashoutsListComponent from "../../components/screenSections/MemberCashoutsComponent";
import MemberWalletTransfer from "../../components/screenSections/MemberWalletTransfer";

type Cashout = {
    id: string;
    amount: string;
    created_at?: string;
    status: string;
    phone?: string;
    uuid?: string;
    memberId?: string | number;
};

const MemberCashoutListScreen: React.FC = () => {
    const navigation = useNavigation();

    // State
    const [loading, setLoading] = useState(false);
    const [cashouts, setCashouts] = useState<Cashout[]>([]);
    const [modalType, setModalType] = useState<"cashout" | "accept" | "mpesa" | null>(null);
    const [nextLevel, setNextLevel] = useState<string | null>(null);
    const [commonData, setCommonData] = useState<{ members?: any[] }>({});
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [memberOpen, setMemberOpen] = useState(false);
    const [memberItems, setMemberItems] = useState<{ label: string; value: number }[]>([]);

    const initialFetchDone = useRef(false);

    // Load user info
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
            }
        })();
    }, []);

    // Load members (common data)
    useEffect(() => {
        const loadMembers = async () => {
            try {
                const members = await fetchCommonData({ name: "members", cachable: false });
                const formattedMembers = members.map((m: any) => ({
                    id: m.id.toString(),
                    uuid: m.uuid,
                    status: m.status,
                    next_level: m.next_level,
                    first_name: m.customer?.first_name || "",
                    last_name: m.customer?.last_name || "",
                    primary_phone: m.customer?.primary_phone || "",
                }));

                setCommonData({ members: formattedMembers });

                setMemberItems(
                    formattedMembers.map((m: any) => ({
                        label: `${m.first_name} ${m.last_name} (${m.primary_phone})`,
                        value: Number(m.id),
                    }))
                );
            } catch (err) {
                Alert.alert("Error", "Failed to load members");
            }
        };

        loadMembers();
    }, []);



    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={styles.header}>Cashouts</Text>
                {nextLevel?.toLowerCase() === "loan" && (
                    <TouchableOpacity style={styles.addButton} onPress={() => setModalType("cashout")}>
                        <Text style={styles.addButtonText}>+ Request Cashout</Text>
                    </TouchableOpacity>
                )}
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

            {/* Cashouts */}
            <View style={{ flex: 1 }}>
                {!memberValue ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>Please select a member to view cashouts.</Text>
                    </View>
                ) : (
                    <>
                        <MemberWalletTransfer memberId={memberValue} />
                        <CashoutsListComponent memberId={memberValue} />
                    </>
                )}
            </View>

            {/* Modals */}
            <CashoutFormModal
                visible={modalType === "cashout"}
                onClose={() => setModalType(null)}
                onSubmit={({ cashout }) => setCashouts((prev) => [cashout, ...prev])}
            />

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
});
