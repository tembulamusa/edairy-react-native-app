import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Alert,
    ScrollView,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DropDownPicker from "react-native-dropdown-picker";
import fetchCommonData from "../../components/utils/fetchCommonData";
import CashoutsListComponent from "../../components/screenSections/MemberCashoutsComponent";
import MemberCashoutActions from "../../components/modals/MemberCashoutActions";

const MemberCashoutListScreen: React.FC = () => {
    const route = useRoute();
    const routeParams = route.params as { memberId?: number } | undefined;
    const [loading, setLoading] = useState(false);
    const [customer_type, setCustomerType] = useState<string>("member");
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
                    } else if (routeParams?.memberId) {
                        // ✅ Auto-select member from route params (e.g., after cashout submission)
                        const matched = formattedMembers.find(
                            (m) => m.member_id === routeParams.memberId || m.id === routeParams.memberId
                        );
                        if (matched) {
                            setMemberValue(matched.id);
                            console.log("✅ Auto-selected member from route params:", matched.id);
                        }
                    }
                }
            } catch (error) {
                console.error("❌ Failed to load common data", error);
                Alert.alert("Error", "Failed to load members");
            }
        };

        loadCommonData();
    }, [routeParams?.memberId]);

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
            <View style={styles.dropdownWrapper}>
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
                    zIndex={5000}
                    zIndexInverse={1000}
                    style={styles.dropdown}
                    dropDownContainerStyle={styles.dropdownContainer}
                    listMode="SCROLLVIEW"
                    maxHeight={300}
                    scrollViewProps={{
                        nestedScrollEnabled: true,
                    }}
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
                    <ScrollView 
                        style={styles.contentArea}
                        contentContainerStyle={styles.contentAreaContainer}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                    >
                        <View style={styles.actionsWrapper}>
                            <MemberCashoutActions
                                memberId={memberValue}
                                selectedMember={selectedMember}
                                setSelectedmember={setSelectedMember}
                                onRefresh={handleRefresh}
                                customer_type={customer_type}
                            />
                        </View>
                        <View style={styles.listWrapper}>
                            <CashoutsListComponent memberId={memberValue} />
                        </View>
                    </ScrollView>
                )}
            </View>
        </View>
    );
};

export default MemberCashoutListScreen;

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        padding: 20, 
        backgroundColor: "#f7fafc",
        overflow: "visible",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    header: { fontSize: 22, fontWeight: "700", color: "#0f766e" },
    dropdownWrapper: {
        zIndex: 5000,
        marginBottom: 16,
        overflow: "visible",
    },
    dropdown: { 
        borderColor: "#ccc",
    },
    dropdownContainer: {
        borderColor: "#ccc",
        maxHeight: 300,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
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
    contentArea: {
        flex: 1,
        marginTop: 12,
    },
    contentAreaContainer: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    actionsWrapper: {
        marginBottom: 16,
    },
    listWrapper: {
        minHeight: 400,
    },
});
