import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CashoutFormModal from "../../components/modals/CashoutFormModal";
import AcceptanceModal from "../../components/modals/AcceptanceModal";
import MpesaTransferModal from "../../components/modals/MpesaTransferModal";
import makeRequest from "../../components/utils/makeRequest";

type Cashout = {
    id: string;
    amount: string;
    dateTime: string;
    status: string;
    phone: string;
    uuid?: string; // ✅ added since you reference item.uuid
};

const MemberCashoutListScreen: React.FC = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true); // only first load
    const [refreshing, setRefreshing] = useState(false); // background refresh/pull-to-refresh
    const [cashouts, setCashouts] = useState<Cashout[]>([]);
    const [modalType, setModalType] = useState<"cashout" | "accept" | "mpesa" | null>(null);
    const [activeCashout, setActiveCashout] = useState<Cashout | null>(null);
    const [nextLevel, setNextLevel] = useState<string | null>(null);

    useEffect(() => {
        fetchCashouts();
        loadUserNextLevel();

        // change this to push 
        const interval = setInterval(() => {
            fetchCashouts(true); // silent refresh
            loadUserNextLevel();
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    const loadUserNextLevel = async () => {
        try {
            const storedUser = await AsyncStorage.getItem("user");
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                setNextLevel(userData?.member_details?.next_level || null);
            }
        } catch (err) {
            console.error("Error loading user next_level", err);
        }
    };

    const fetchCashouts = async (isRefresh = false) => {
        if (isRefresh) {
            // setRefreshing(true);
        } else if (cashouts.length === 0) {
            setLoading(true);
        }

        try {
            const [status, response] = await makeRequest({
                url: "my-loans",
                method: "GET",
            });
            if ([200, 201].includes(status) && response?.loans) {
                setCashouts(response.loans);
            }
        } catch (err) {
            console.error("Error fetching cashouts", err);
            Alert.alert("Error", "Failed to fetch cashouts.");
        } finally {
            if (isRefresh) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    };

    const renderCashouts = ({ item }: { item: Cashout }) => (
        <View style={styles.card}>
            <View>
                <Text style={styles.amount}>{item.amount} KES</Text>
                <Text style={styles.date}>{item.dateTime}</Text>
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
                        if (item?.status?.toLowerCase() === "awaitingacceptance") {
                            setModalType("accept");
                        } else if (item?.status?.toLowerCase() === "ongoingchecks") {
                            setModalType("mpesa");
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

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#0f766e" />
                <Text style={{ marginTop: 8, color: "#666" }}>Loading cashouts...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Cashouts</Text>

                {nextLevel?.toLowerCase() === "loan" && (
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setModalType("cashout")}
                    >
                        <Text style={styles.addButtonText}>+ Request Cashout</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={cashouts}
                keyExtractor={(item) => item.id}
                renderItem={renderCashouts}
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchCashouts(true)}
                        colors={["#0f766e"]}
                    />
                }
            />

            {/* Cashout Form */}
            <CashoutFormModal
                visible={modalType === "cashout"}
                onClose={() => setModalType(null)}
                onSubmit={({ cashout }) => {
                    setCashouts((prev) => [cashout, ...prev]);
                }}
            />

            {/* Acceptance Modal */}
            <AcceptanceModal
                activeCashout={activeCashout}
                visible={modalType === "accept"}
                amount={activeCashout?.amount || ""}
                loanuid={activeCashout?.uuid || ""}
                phone={activeCashout?.phone || ""}
                onSend={() => setModalType(null)}
                onClose={() => setModalType(null)}
            />

            {/* Mpesa Transfer Modal */}
            <MpesaTransferModal
                activeCashout={activeCashout}
                visible={modalType === "mpesa"}
                amount={activeCashout?.amount || ""}
                phone={activeCashout?.phone || ""}
                onSend={() => {
                    console.log("Transferred", activeCashout?.id);
                    setModalType(null);
                }}
                onClose={() => setModalType(null)}
            />
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
    actionButton: {
        backgroundColor: "#0f766e",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    actionButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
