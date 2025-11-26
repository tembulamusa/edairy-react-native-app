import React, { useEffect, useRef } from "react";
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    Animated,
    TouchableWithoutFeedback,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface CustomAlertProps {
    visible: boolean;
    title?: string;
    message: string;
    icon?: string;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: "success" | "error" | "info";
}

const CustomAlert: React.FC<CustomAlertProps> = ({
    visible,
    title = "Alert",
    message,
    icon = "info",
    onClose,
    onConfirm,
    confirmText = "OK",
    cancelText = "Cancel",
    type = "info",
}) => {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 0.8,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    // 👇 Do not render anything when not visible (avoids blocking UI)
    if (!visible) return null;

    // Determine colors based on type
    const getColors = () => {
        switch (type) {
            case "success":
                return {
                    iconColor: "#22C55E", // Green
                    titleColor: "#16A34A", // Darker green
                    messageColor: "#15803D", // Even darker green
                    buttonColor: "#22C55E", // Green
                };
            case "error":
                return {
                    iconColor: "#EF4444", // Red
                    titleColor: "#DC2626", // Darker red
                    messageColor: "#B91C1C", // Even darker red
                    buttonColor: "#EF4444", // Red
                };
            default:
                return {
                    iconColor: "#009688", // Teal (default)
                    titleColor: "#111", // Black
                    messageColor: "#555", // Gray
                    buttonColor: "#009688", // Teal
                };
        }
    };

    const colors = getColors();

    return (
        <Modal
            transparent
            animationType="none"
            visible={visible}
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <Animated.View
                            style={[
                                styles.alertBox,
                                { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
                            ]}
                        >
                            <Icon name={icon} size={40} color={colors.iconColor} />
                            <Text style={[styles.title, { color: colors.titleColor }]}>{title}</Text>
                            <Text style={[styles.message, { color: colors.messageColor }]}>{message}</Text>

                            <View style={styles.buttonsRow}>
                                {onConfirm ? (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.cancelButton, { borderColor: colors.buttonColor }]}
                                            onPress={onClose}
                                        >
                                            <Text style={[styles.cancelText, { color: colors.buttonColor }]}>{cancelText}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.confirmButton, { backgroundColor: colors.buttonColor }]}
                                            onPress={onConfirm}
                                        >
                                            <Text style={styles.confirmText}>{confirmText}</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.singleButton, { backgroundColor: colors.buttonColor }]}
                                        onPress={onClose}
                                    >
                                        <Text style={styles.confirmText}>{confirmText}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
    },
    alertBox: {
        width: "80%",
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        marginTop: 10,
    },
    message: {
        textAlign: "center",
        fontSize: 15,
        marginVertical: 10,
    },
    buttonsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 15,
        width: "100%",
    },
    cancelButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        marginRight: 5,
    },
    confirmButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: "center",
        marginLeft: 5,
    },
    singleButton: {
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginTop: 10,
    },
    cancelText: {
        fontWeight: "600",
    },
    confirmText: {
        color: "#fff",
        fontWeight: "600",
    },
});

export default CustomAlert;
