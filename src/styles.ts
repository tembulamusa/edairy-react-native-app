// src/styles/styles.ts
import { StyleSheet } from "react-native";

export const globalStyles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: "#fff",
    },
    input: {
        backgroundColor: "#fff",
        borderRadius: 9999, // fully rounded
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
        color: "#111827", // text-gray-900
    },
    button: {
        backgroundColor: "#0d9488", // teal-600
        borderRadius: 9999,
        paddingVertical: 12,
        alignItems: "center",
        marginTop: 10,
    },
    buttonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 18,
    },
    label: {
        color: "#fff",
        marginBottom: 8,
    },
    title: {
        // color: "#fff",
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 24,
    },
    backgroundGradient: {
        flex: 1,
        padding: 20,
        backgroundColor: "#fff",
    },
});
