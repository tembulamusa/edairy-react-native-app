import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import AcceptanceModal from "../../components/modals/AcceptanceModal";
import makeRequest from "../../components/utils/makeRequest";

type Cashout = {
    id: string;
    amount: string;
    created_at?: string;
    status: string;
    phone?: string;
    uuid?: string;
};

type Props = {
    memberId: number;
};

const CashoutsListComponent: React.FC<Props> = ({ memberId }) => {
    const [loading, setLoading] = useState(false);
    const [cashouts, setCashouts] = useState<Cashout[]>([]);
    const [activeCashout, setActiveCashout] = useState<Cashout | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const initialFetchDone = useRef(false);

    // Fetch cashouts
    const fetchCashouts = async (showLoading = false) => {
        if (!memberId) return;
        if (showLoading) setLoading(true);

        try {
            const [status, response] = await makeRequest({
                url: `user-loans?memberId=${memberId}`,
                method: "GET",
            });

            if ([200, 201].includes(status) && response?.loans) {
                setCashouts(response.loans);
            } else {
                setCashouts([]);
            }
        } catch (err) {
            console.error("Error fetching cashouts", err);
            Alert.alert("Error", "Failed to fetch cashouts.");
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    // Initial fetch + polling
    useEffect(() => {
        initialFetchDone.current = false;

        const fetchData = async () => {
            await fetchCashouts(!initialFetchDone.current);
            initialFetchDone.current = true;
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [memberId]);

    // Render single cashout card
    const renderCashoutItem = ({ item }: { item: Cashout }) => (
        <View style={styles.card}>
            <View>
                <Text style={styles.amount}>{item.amount} KES</Text>
                <Text style={styles.date}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                </Text>
            </View>
            <View style={styles.rightColumn}>
                <Text
                    style={[
                        styles.status,
                        item.status === "completed"
                            ? styles.statusCompleted
                            : item.status === "failed"
                                ? styles.statusFailed
                                : styles.statusOngoing,
                    ]}
                >
                    {item.status}
                </Text>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        setActiveCashout(item);
                        if (item.status.toLowerCase() === "awaitingacceptance") {
                            setModalVisible(true);
                        } else {
                            Alert.alert("Info", "No action available for this cashout");
                        }
                    }}
                >
                    <Text style={styles.actionButtonText}>View</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#0f766e" />
                    <Text style={{ marginTop: 8, color: "#666" }}>Loading cashouts...</Text>
                </View>
            ) : cashouts.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No cashouts found for this member.</Text>
                </View>
            ) : (
                <FlatList
                    data={cashouts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCashoutItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}

            {activeCashout && (
                <AcceptanceModal
                    visible={modalVisible}
                    activeCashout={activeCashout}
                    amount={activeCashout.amount}
                    loanuid={activeCashout.uuid || ""}
                    phone={activeCashout.phone || ""}
                    onSend={() => setModalVisible(false)}
                    onClose={() => setModalVisible(false)}
                />
            )}
        </View>
    );
};

export default CashoutsListComponent;

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
    },
    amount: { fontSize: 16, fontWeight: "600", color: "#111827" },
    date: { fontSize: 14, color: "#6b7280", marginTop: 4 },
    rightColumn: { alignItems: "flex-end" },
    status: { fontSize: 14, fontWeight: "600", marginBottom: 6, textTransform: "capitalize" },
    statusCompleted: { color: "green" },
    statusFailed: { color: "red" },
    statusOngoing: { color: "orange" },
    actionButton: { backgroundColor: "#0f766e", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    actionButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
    emptyText: { fontSize: 16, color: "#6b7280", textAlign: "center", fontWeight: "500" },
});
