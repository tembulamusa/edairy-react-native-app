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
        borderRadius: 32, // fully rounded
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
    whiteLabel: {
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

    dashboardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        padding: 8,
    },

    dashboardLink: {
        width: '22%',
        aspectRatio: 1,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 25,
    },
    dashboardLinkIcon: {
        padding: 20,
        margin: "auto",
        backgroundColor: '#ffffff',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
        marginTop: 2,
        borderWidth: 1.5,          // make it thicker so it's visible
        borderColor: '#ddd',    // light gray border for subtle contrast
        shadowColor: '#ddd',       // optional shadow for subtle elevation
        shadowOpacity: 0.21,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,              // for Android shadow
    },
    dashboardIconLabel: {
        color: "#222222",
        textAlign: "center",
        fontSize: 14,
        marginTop: 4,
        marginBottom: 4
    },
    container: {
        flex: 1,
        backgroundColor: "#ffffff"
    },
    container: {
        flex: 1,
        padding: 20,
        justifyContent: "flex-start",
        alignItems: "center",
    },
    previewBox: {
        width: "100%",
        height: 250,
        backgroundColor: "#fff",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
    },
    image: {
        width: "100%",
        height: "100%",
        borderRadius: 12,
        resizeMode: "cover",
    },
    placeholder: {
        color: "#aaa",
        fontSize: 16,
    },
    photoButtonsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 40,
    },
    actionButton: {
        flex: 1,
        backgroundColor: "#009688",
        paddingVertical: 12,
        marginHorizontal: 5,
        borderRadius: 20,
        alignItems: "center",
    },
    actionButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    navRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
    },
    navButtonOutline: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#009688",
        paddingVertical: 12,
        marginRight: 5,
        borderRadius: 20,
        alignItems: "center",
    },
    navButtonFilled: {
        flex: 1,
        backgroundColor: "#009688",
        paddingVertical: 12,
        marginLeft: 5,
        borderRadius: 20,
        alignItems: "center",
    },
    navButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    pageTitle: {
        marginTop: 4,
        marginBottom: 4,
        fontSize: 20,
        fontWeight: 700
    },
    pageSubTitle: {
        marginTop: 4,
        marginBottom: 12,
        fontSize: 16,
        fontWeight: 500
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        gap: 10,

    },
    required: { color: "red" },
    input: {
        backgroundColor: "#fff",
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#d1d5db",
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: "#111827",
        elevation: 1,
        marginBottom: 16,
    },
    inputWithIcon: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#d1d5db",
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 16,
        elevation: 1,
    },
    nextButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#009688",
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 18,
        marginTop: 20,
        alignSelf: "flex-end",
    },
    nextButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
        marginRight: 6,
    },
    smallButton: {
        backgroundColor: "#009688",
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 25,
        alignSelf: "flex-end",
    },
    smallButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    radioOption: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 20
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: "#009688",
        marginRight: 6,
    },
    radioSelected: { backgroundColor: "#009688" },
    radioLabel: { fontSize: 14, color: "#374151" },
    label: {
        fontSize: 14,
        color: "#374151",
        marginBottom: 6
    },

    title: {
        fontSize: 22,
        fontWeight: "700",
        color: "#0f766e",
        textAlign: "left",
        marginBottom: 4,
    },
    sub: {
        fontSize: 13,
        color: "#6b7280",
        marginBottom: 16,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827"
    },
    smallEditBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
    },
    smallEditText: { color: "#0f766e", fontWeight: "600" },

    // row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    rowLabel: { color: "#6b7280", fontSize: 13, flex: 0.45 },
    rowValue: { color: "#111827", fontSize: 13, textAlign: "right", flex: 0.55 },

    imageRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    imageSlot: { width: "48%" },
    imageLabel: { color: "#6b7280", marginBottom: 6, fontSize: 13 },
    imagePreview: { width: "100%", height: 140, borderRadius: 8, resizeMode: "cover" },
    imagePlaceholder: {
        width: "100%",
        height: 140,
        borderRadius: 8,
        backgroundColor: "#f3f4f6",
        justifyContent: "center",
        alignItems: "center",
    },
    placeholderText: { color: "#9ca3af" },

    footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
    finishButtonOutline: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#0f766e",
        paddingVertical: 12,
        marginRight: 10,
        borderRadius: 20,
        alignItems: "center",
    },
    finishButtonOutlineText: { color: "#0f766e", fontWeight: "600" },

    finishButton: {
        flex: 1,
        backgroundColor: "#0f766e",
        paddingVertical: 12,
        marginLeft: 10,
        borderRadius: 20,
        alignItems: "center",
    },
    finishButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
