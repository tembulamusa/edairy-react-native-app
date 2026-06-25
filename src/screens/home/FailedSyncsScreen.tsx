import React, { useCallback, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    SafeAreaView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
// @ts-ignore
import Icon from "react-native-vector-icons/MaterialIcons";
import {
    deleteOfflineCollectionById,
    getFailedOfflineCollections,
    MAX_OFFLINE_COLLECTION_RETRIES,
    type OfflineCollectionRecord,
} from "../../services/offlineDatabase";

const formatEndpointLabel = (endpoint: string): string => {
    if (endpoint === "milk-journals") return "Member Kilos";
    if (endpoint === "store-sale") return "Store Sale";
    if (endpoint === "milk-deliveries") return "Milk Delivery";
    return endpoint;
};

const FailedSyncsScreen = () => {
    const [items, setItems] = useState<OfflineCollectionRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const loadFailedItems = useCallback(async () => {
        setLoading(true);
        try {
            const failed = await getFailedOfflineCollections();
            setItems(failed);
        } catch (error) {
            console.error("[FailedSyncs] Failed to load items:", error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadFailedItems();
        }, [loadFailedItems])
    );

    const handleDismiss = (item: OfflineCollectionRecord) => {
        Alert.alert(
            "Remove Failed Record",
            "This will permanently remove the failed offline record from this device. It will not be uploaded.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteOfflineCollectionById(item.id);
                            await loadFailedItems();
                        } catch (error) {
                            Alert.alert("Error", "Could not remove the failed record.");
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }: { item: OfflineCollectionRecord }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                    {item.summary_label || formatEndpointLabel(item.endpoint)}
                </Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>Failed</Text>
                </View>
            </View>
            <Text style={styles.meta}>
                {formatEndpointLabel(item.endpoint)} · {item.method} ·{" "}
                {new Date(item.created_at).toLocaleString()}
            </Text>
            <Text style={styles.meta}>
                Retries: {item.retries}/{MAX_OFFLINE_COLLECTION_RETRIES}
            </Text>
            {item.error_message ? (
                <Text style={styles.errorText}>{item.error_message}</Text>
            ) : null}
            <TouchableOpacity style={styles.dismissButton} onPress={() => handleDismiss(item)}>
                <Icon name="delete-outline" size={18} color="#b91c1c" />
                <Text style={styles.dismissText}>Remove from device</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Failed Syncs</Text>
                <Text style={styles.subtitle}>
                    Records that failed after {MAX_OFFLINE_COLLECTION_RETRIES} upload attempts are listed
                    here. They are no longer retried automatically.
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1b7f74" style={styles.loader} />
            ) : items.length === 0 ? (
                <View style={styles.emptyState}>
                    <Icon name="check-circle-outline" size={48} color="#16a34a" />
                    <Text style={styles.emptyTitle}>No failed syncs</Text>
                    <Text style={styles.emptyText}>
                        Offline records that could not be uploaded will appear here after{" "}
                        {MAX_OFFLINE_COLLECTION_RETRIES} failed attempts.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </SafeAreaView>
    );
};

export default FailedSyncsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: "#4b5563",
    },
    loader: {
        marginTop: 40,
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#fecaca",
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 6,
    },
    cardTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: "700",
        color: "#111827",
    },
    badge: {
        backgroundColor: "#fee2e2",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    badgeText: {
        color: "#b91c1c",
        fontSize: 12,
        fontWeight: "700",
    },
    meta: {
        fontSize: 13,
        color: "#6b7280",
        marginBottom: 4,
    },
    errorText: {
        fontSize: 13,
        color: "#b91c1c",
        marginTop: 6,
        marginBottom: 8,
        lineHeight: 18,
    },
    dismissButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
    },
    dismissText: {
        color: "#b91c1c",
        fontSize: 14,
        fontWeight: "600",
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111827",
        marginTop: 12,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        lineHeight: 20,
        color: "#6b7280",
        textAlign: "center",
    },
});
