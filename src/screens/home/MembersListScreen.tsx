import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import fetchCommonData from "../../components/utils/fetchCommonData";
import makeRequest from "../../components/utils/makeRequest";

type Member = {
    id: string;
    first_name: string;
    last_name: string;
    primary_phone: string;
    status: string;
    next_level: string;
    uuid: string;
    cashout_enrolled: boolean | number; // ✅ added
};

const MembersListScreen: React.FC = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
        const loadCommonData = async () => {
            setLoading(true);
            try {
                const [members] = await Promise.all([
                    fetchCommonData({ name: "members", cachable: false }),
                ]);

                // ✅ Corrected reference to item.cashout_enrolled
                const formattedMembers = members.map((item: any) => ({
                    id: item?.id?.toString(),
                    uuid: item?.uuid,
                    status: item?.status,
                    next_level: item?.next_level,
                    first_name: item?.first_name || "",
                    last_name: item?.last_name || "",
                    primary_phone: item?.primary_phone || "",
                    cashout_enrolled: !!item?.cashout_enrolled, // ✅ convert to boolean
                }));

                setMembers(formattedMembers);
            } catch (error: any) {
                Alert.alert("Error", JSON.stringify(error) || "Failed to load members");
            } finally {
                setLoading(false);
            }
        };

        loadCommonData();
    }, []);

    const handleRegisterCashout = async (member: Member) => {
        try {
            if (!member?.id) {
                Alert.alert("Error", "Invalid member selected.");
                return;
            }

            // You can adjust this to your backend route name
            const endpoint = "member-loan-enroll";

            const payload = {
                member_id: member.id,
            };

            const [status, response] = await makeRequest(
                {
                    url: endpoint,
                    method: "POST",
                    data: payload
                }
            );

            if (status === 200 || status === 201) {
                Alert.alert("Success", response?.message || "Cashout enrollment successful.");

                // Update local state to reflect enrollment
                setMembers((prevMembers) =>
                    prevMembers.map((m) =>
                        m.id === member.id ? { ...m, cashout_enrolled: true } : m
                    )
                );
            } else {
                Alert.alert("Error", response?.message || "Failed to enroll for cashout.");
            }
        } catch (error: any) {
            console.error("Cashout enrollment error:", error);
            Alert.alert("Error", error?.message || "Something went wrong during enrollment.");
        }
    };


    const renderMember = ({ item }: { item: Member }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() =>
                navigation.navigate("MemberDetails" as never, { member: item } as never)
            }
        >
            {/* Left column */}
            <View style={styles.leftColumn}>
                <Text style={styles.name}>
                    {item?.first_name} {item?.last_name}
                </Text>
                <Text style={styles.phone}>{item?.primary_phone}</Text>
            </View>

            {/* Right column */}
            <View style={styles.rightColumn}>
                <Text style={styles.status}>{item.status}</Text>

                {!item.cashout_enrolled ? (
                    <TouchableOpacity onPress={() => handleRegisterCashout(item)}>
                        <Text
                            style={[
                                styles.nextLevel,
                                {
                                    color: "blue",
                                    // textDecorationLine: "underline",
                                    marginTop: 5,
                                },
                            ]}
                        >
                            Register Cashout
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={[styles.nextLevel, { color: "green" }]}>
                        {item.next_level || "Active"}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#0f766e" />
                <Text style={{ marginTop: 8, color: "#666" }}>Loading members...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Members</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate("MemberRegistration" as never)}
                >
                    <Text style={styles.addButtonText}>+ Register</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={members}
                keyExtractor={(item) => item.id}
                renderItem={renderMember}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
};

export default MembersListScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: "#f7fafc" },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    header: { fontSize: 22, fontWeight: "700", color: "#0f766e" },
    addButton: {
        backgroundColor: "#0f766e",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
    card: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
        marginVertical: 6,
        backgroundColor: "#fff",
        borderRadius: 8,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    leftColumn: { flex: 1 },
    name: { fontSize: 16, fontWeight: "bold", color: "#333" },
    phone: { fontSize: 14, color: "#666" },
    rightColumn: { alignItems: "flex-end" },
    status: { fontSize: 14, fontWeight: "600", color: "green" },
    nextLevel: { fontSize: 13, color: "#888" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
