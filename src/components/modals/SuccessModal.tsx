import React from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

type SuccessModalProps = {
    visible: boolean;
    title?: string;
    message?: string;
    isLoading?: boolean;
    loadingMessage?: string;
    onClose: () => void;
};

const SuccessModal: React.FC<SuccessModalProps> = ({
    visible,
    title = "Success",
    message = "Operation completed successfully.",
    isLoading = false,
    loadingMessage = "Processing...",
    onClose,
}) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {isLoading ? (
                        <>
                            <ActivityIndicator size="large" color="#16a34a" />
                            <Text style={styles.loadingText}>{loadingMessage}</Text>
                        </>
                    ) : (
                        <>
                            <View style={styles.iconContainer}>
                                <MaterialIcons name="check-circle" size={64} color="#16a34a" />
                            </View>
                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.message}>{message}</Text>
                            <TouchableOpacity style={styles.button} onPress={onClose}>
                                <Text style={styles.buttonText}>OK</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default SuccessModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContainer: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        width: "85%",
        maxWidth: 400,
        alignItems: "center",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#1f2937",
        marginBottom: 12,
        textAlign: "center",
    },
    message: {
        fontSize: 16,
        color: "#4b5563",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 22,
    },
    loadingText: {
        fontSize: 16,
        color: "#4b5563",
        marginTop: 16,
        textAlign: "center",
    },
    button: {
        backgroundColor: "#16a34a",
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
        minWidth: 120,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
});

