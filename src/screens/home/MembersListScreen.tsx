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
import makeRequest from "../../components/utils/makeRequest";

type Member = {
    id: string;
    first_name: string;
    last_name: string;
    primary_phone_number: string;
    status: string;
    next_level: string;
    uuid: string;
};


const MembersListScreen: React.FC = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<Member[]>([]);

    // Fetch members (simulate API)
    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async (isRefresh = false) => {
        setLoading(true);
        try {
            const [status, response] = await makeRequest({
                url: "get-members",
                method: "GET",
            });
            if ([200, 201].includes(status) && response?.members) {
                setMembers(response?.members);
            }
        } catch (err) {
            console.error("Error fetching members", err);
            Alert.alert("Error", "Failed to fetch members.");
        } finally {
            if (isRefresh) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
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
                    {item.first_name} {item.last_name}
                </Text>
                <Text style={styles.phone}>{item.primary_phone_number}</Text>
            </View>

            {/* Right column */}
            <View style={styles.rightColumn}>
                <Text style={styles.status}>{item.status}</Text>

                {item.next_level === "liveness" ? (
                    <TouchableOpacity
                        onPress={() => {
                            const url = `http://192.168.100.18:8000/liveness-check/${item?.uuid}`;
                            console.log("Navigating with URL:", url);
                            navigation.navigate(
                                "LivenessCheck" as never,
                                { url } as never
                            );
                        }}
                    >
                        <Text style={[styles.nextLevel, { color: "blue", textDecorationLine: "underline" }]}>
                            {item.next_level}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={styles.nextLevel}>{item.next_level}</Text>
                )
                }
            </View >
        </TouchableOpacity >
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
    name: { fontSize: 16, fontWeight: "600", color: "#111827" },
    phone: { fontSize: 14, color: "#6b7280", marginTop: 4 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: {
        flexDirection: "row",   // 🔑 two columns side by side
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
    leftColumn: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    phone: {
        fontSize: 14,
        color: "#666",
    },
    rightColumn: {
        alignItems: "flex-end",  // align text to the right
    },
    status: {
        fontSize: 14,
        fontWeight: "600",
        color: "green",
    },
    nextLevel: {
        fontSize: 13,
        color: "#888",
    },
});
