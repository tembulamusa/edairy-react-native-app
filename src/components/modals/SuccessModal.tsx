import React, { useEffect, useRef } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Animated,
    Easing,
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
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const ringScaleAnim = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        if (!visible || isLoading) {
            return;
        }

        scaleAnim.setValue(0);
        opacityAnim.setValue(0);
        ringScaleAnim.setValue(0.6);

        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                tension: 90,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 220,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.spring(ringScaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 70,
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible, isLoading, opacityAnim, ringScaleAnim, scaleAnim]);

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
                            <View style={styles.iconWrapper}>
                                <Animated.View
                                    style={[
                                        styles.iconRing,
                                        {
                                            opacity: opacityAnim,
                                            transform: [{ scale: ringScaleAnim }],
                                        },
                                    ]}
                                />
                                <Animated.View
                                    style={[
                                        styles.iconContainer,
                                        {
                                            opacity: opacityAnim,
                                            transform: [{ scale: scaleAnim }],
                                        },
                                    ]}
                                >
                                    <MaterialIcons name="check" size={42} color="#fff" />
                                </Animated.View>
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
    iconWrapper: {
        width: 88,
        height: 88,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    iconRing: {
        position: "absolute",
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: "#dcfce7",
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#16a34a",
        justifyContent: "center",
        alignItems: "center",
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
