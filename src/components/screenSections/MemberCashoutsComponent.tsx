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

type Transaction = {
    id: string;
    amount: string;
    transaction_type: string;
    created_at?: string;
};

type Props = {
    memberId: number;
};

const CashoutsListComponent: React.FC<Props> = ({ memberId }) => {
    const [loading, setLoading] = useState(false);
    const [cashouts, setCashouts] = useState<Cashout[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeCashout, setActiveCashout] = useState<Cashout | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<"cashouts" | "transactions">("cashouts");

    const initialFetchDone = useRef(false);

    /** --------------------------
     * Fetch Cashouts
     -------------------------- */
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

    /** --------------------------
     * Fetch Transactions
     -------------------------- */
    const fetchTransactions = async () => {
        if (!memberId) return;

        try {
            const [status, response] = await makeRequest({
                url: `member-loan-transactions?memberId=${memberId}`,
                method: "GET",
            });

            if ([200, 201].includes(status) && response?.transactions) {
                setTransactions(response.transactions);
            } else {
                setTransactions([]);
            }
        } catch (err) {
            console.error("Error fetching transactions", err);
        }
    };

    useEffect(() => {
        initialFetchDone.current = false;

        const fetchData = async () => {
            await fetchCashouts(!initialFetchDone.current);
            await fetchTransactions();
            initialFetchDone.current = true;
        };

        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [memberId]);

    /** --------------------------
     * Render Cashout Item
     -------------------------- */
    const renderCashoutItem = ({ item }: { item: Cashout }) => {
        const isAwaitingAcceptance =
            item.status?.toLowerCase() === "awaitingacceptance";
        const isProcessed = item.status?.toLowerCase() === "processed";


        return (
            <View style={styles.card}>
                <View>
                    <Text
                        style={[
                            styles.amount,
                            isAwaitingAcceptance && styles.statusAwaiting,
                        ]}
                    >
                        {item.amount} KES
                    </Text>
                    <Text
                        style={[
                            styles.date,
                            isAwaitingAcceptance && styles.statusAwaiting,
                        ]}
                    >
                        {item.created_at
                            ? new Date(item.created_at).toLocaleDateString()
                            : ""}
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
                                    : isProcessed
                                        ? styles.statusProcessed
                                        : isAwaitingAcceptance
                                            ? styles.statusAwaiting
                                            : styles.statusOngoing,
                        ]}
                    >
                        {isProcessed ? "Done" : item.status}
                    </Text>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            isAwaitingAcceptance && {
                                backgroundColor: "#00b341",
                            },
                        ]}
                        onPress={() => {
                            setActiveCashout(item);
                            if (isAwaitingAcceptance) {
                                setModalVisible(true);
                            } else {
                                Alert.alert(
                                    "Info",
                                    "No action available for this cashout at the moment. Please wait."
                                );
                            }
                        }}
                    >
                        <Text style={styles.actionButtonText}>View</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    /** --------------------------
     * Render Transaction Item
     -------------------------- */
    const renderTransactionItem = ({ item }: { item: Transaction }) => (
        <View style={styles.card}>
            <View>
                <Text style={styles.amount}>{item.amount} KES</Text>
                <Text style={styles.date}>
                    {item.created_at
                        ? new Date(item.created_at).toLocaleDateString()
                        : ""}
                </Text>
            </View>
            <Text
                style={[
                    styles.status,
                    item.transaction_type?.toLowerCase() === "credit"
                        ? styles.statusCompleted
                        : styles.statusOngoing,
                ]}
            >
                {item.transaction_type}
            </Text>
        </View>
    );

    /** --------------------------
     * Tab Content Switch
     -------------------------- */
    const renderContent = () => {
        if (activeTab === "cashouts") {
            return loading ? (
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
            );
        }

        // Transactions tab
        return transactions.length === 0 ? (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No transactions found for this member.</Text>
            </View>
        ) : (
            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                renderItem={renderTransactionItem}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Tabs Header */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "cashouts" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("cashouts")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "cashouts" && styles.tabTextActive,
                        ]}
                    >
                        Cashouts
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "transactions" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("transactions")}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === "transactions" && styles.tabTextActive,
                        ]}
                    >
                        Transactions
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {renderContent()}

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

/** --------------------------
 * Styles
 -------------------------- */
const styles = StyleSheet.create({
    tabsContainer: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
        marginBottom: 10,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    tabButtonActive: {
        borderBottomColor: "#0f766e",
    },
    tabText: {
        fontSize: 16,
        color: "#6b7280",
        fontWeight: "500",
    },
    tabTextActive: {
        color: "#0f766e",
        fontWeight: "700",
    },
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
    status: { fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
    statusCompleted: { color: "green" },
    statusFailed: { color: "red" },
    statusOngoing: { color: "orange" },
    processedNote: {
        marginTop: 6,
        fontSize: 12,
        color: "#065f46",
        fontStyle: "italic",
    },
    actionButton: {
        backgroundColor: "#0f766e",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 6,
    },
    actionButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
    statusAwaiting: {
        color: "#b8860b",
        fontWeight: "700",
    },
    statusProcessed: {
        color: "green",
        fontWeight: "600",
    },
});
