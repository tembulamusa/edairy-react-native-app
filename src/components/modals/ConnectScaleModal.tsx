import React, { useEffect, useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
} from "react-native";
import { BluetoothDevice } from "react-native-bluetooth-classic";

type ConnectScaleModalProps = {
    visible: boolean;
    onClose: () => void;
    devices: BluetoothDevice[];
    scanForDevices: () => Promise<void>;
    onDeviceSelect: (device: BluetoothDevice) => void;
};

const ConnectScaleModal: React.FC<ConnectScaleModalProps> = ({
    visible,
    onClose,
    devices,
    scanForDevices,
    onDeviceSelect,
}) => {
    const [connectingId, setConnectingId] = useState<string | null>(null);

    useEffect(() => {
        if (visible) scanForDevices();
    }, [visible, scanForDevices]);

    const handleSelect = (device: BluetoothDevice) => {
        setConnectingId(device.id);
        onDeviceSelect(device);
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <Text style={styles.title}>Select Scale</Text>

                    {devices.length === 0 ? (
                        <Text style={styles.noDevices}>No devices found</Text>
                    ) : (
                        <FlatList
                            data={devices}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => {
                                const isConnecting = connectingId === item.id;
                                return (
                                    <View style={styles.deviceRow}>
                                        <Text style={styles.deviceText}>
                                            {item.name || "Unnamed Device"}
                                        </Text>
                                        <TouchableOpacity
                                            style={[
                                                styles.connectButton,
                                                isConnecting && styles.disabledButton,
                                            ]}
                                            disabled={!!connectingId}
                                            onPress={() => handleSelect(item)}
                                        >
                                            <Text style={styles.connectText}>
                                                {isConnecting ? "Connecting..." : "Select"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            }}
                        />
                    )}

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={scanForDevices}
                        disabled={!!connectingId}
                    >
                        <Text style={styles.actionText}>Rescan</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { marginTop: 10 }]}
                        onPress={onClose}
                        disabled={!!connectingId}
                    >
                        <Text style={styles.actionText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default ConnectScaleModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center", alignItems: "center",
    },
    modal: {
        width: "85%", backgroundColor: "#fff", borderRadius: 12,
        padding: 20, maxHeight: "70%",
    },
    title: { fontSize: 20, fontWeight: "700", marginBottom: 16, textAlign: "center" },
    noDevices: { textAlign: "center", color: "#666", marginVertical: 20 },
    deviceRow: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "center", paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: "#ddd",
    },
    deviceText: { fontSize: 16, flex: 1, marginRight: 10 },
    connectButton: {
        backgroundColor: "#007AFF", paddingVertical: 6,
        paddingHorizontal: 14, borderRadius: 6,
    },
    connectText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    disabledButton: { backgroundColor: "#aaa" },
    actionButton: { marginTop: 20, alignItems: "center" },
    actionText: { fontSize: 16, color: "#007AFF" },
});
