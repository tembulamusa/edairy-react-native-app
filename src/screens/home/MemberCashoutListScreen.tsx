import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DropDownPicker from "react-native-dropdown-picker";
import fetchCommonData from "../../components/utils/fetchCommonData";
import CashoutsListComponent from "../../components/screenSections/MemberCashoutsComponent";
import MemberCashoutActions from "../../components/modals/MemberCashoutActions";

const MemberCashoutListScreen: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [commonData, setCommonData] = useState<{ members?: any[] }>({});
    const [memberValue, setMemberValue] = useState<number | null>(null);
    const [selectedMember, setSelectedMember] = useState<any | null>(null);
    const [memberOpen, setMemberOpen] = useState(false);
    const [memberItems, setMemberItems] = useState<{ label: string; value: number }[]>([]);
    const [dropdownDisabled, setDropdownDisabled] = useState(false);
    const [nextLevel, setNextLevel] = useState<string | null>(null);

    // ✅ Load members and handle auto-selection for member-only users
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
                    member_id: item?.customer_id, // used for linking to user.member_id
                    member_type: item?.customer_type,
                }));

                setCommonData({ members: formattedMembers });
                setMemberItems(
                    formattedMembers.map((m) => ({
                        label: `${m.first_name} ${m.last_name} (${m.primary_phone})`,
                        value: Number(m.id),
                    }))
                );

                // ✅ Get user info to determine auto-select logic
                const userDataString = await AsyncStorage.getItem("user");
                if (userDataString) {
                    const userData = JSON.parse(userDataString);
                    const userGroups = userData?.user_groups || [];

                    const isMemberOnly =
                        !userGroups.includes("transporter") &&
                        !userGroups.includes("employee");
                    setNextLevel(userData?.member_details?.next_level || null);

                    if (isMemberOnly) {
                        // ✅ Match on member_id field, not id
                        const matched = formattedMembers.find(
                            (m) => m.member_id === userData.member_id
                        );
                        if (matched) {
                            setMemberValue(matched.id); // select the corresponding dropdown value
                            setDropdownDisabled(true); // disable dropdown for member-only users
                        }
                    }
                }
            } catch (error) {
                console.error("❌ Failed to load common data", error);
                Alert.alert("Error", "Failed to load members");
            }
        };

        loadCommonData();
    }, []);

    // ✅ Update selectedMember when memberValue changes
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

    return (
        <View style={styles.container}>
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
                    disabled={dropdownDisabled} // ✅ Disable when member-only
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
                        <MemberCashoutActions
                            memberId={memberValue}
                            selectedMember={selectedMember}
                            onRefresh={handleRefresh}
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
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    header: { fontSize: 22, fontWeight: "700", color: "#0f766e" },
    dropdown: { marginBottom: 16, borderColor: "#ccc" },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: "#6b7280",
        textAlign: "center",
        fontWeight: "500",
    },
});
