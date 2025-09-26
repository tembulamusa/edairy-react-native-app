// ConfirmationScreen.tsx
import React from "react";
import {
    View,
    Text,
    Image,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { Asset } from "react-native-image-picker";

type PersonalInfo = {
    membershipNo: string;
    firstName: string;
    lastName: string;
    idNo: string;
    gender: string;
    dob: string;
    route: string;
    phone: string;
    bank: string;
    accountNo: string;
};

type NextOfKin = {
    fullName: string;
    phone: string;
    relationship: string;
};

type IdUploads = {
    idFront?: Asset | null;
    idBack?: Asset | null;
};

export interface ConfirmationData {
    personalInfo: PersonalInfo;
    nextOfKin: NextOfKin;
    idUploads?: IdUploads;
}

/**
 * Props:
 * - data: the whole payload assembled from your multi-step forms
 * - onEditPersonal / onEditNextOfKin / onEditIDs: optional callbacks to jump back to the respective step
 * - onFinish: optional callback executed on finish (if omitted a navigation reset to "Home" is used)
 */
interface Props {
    data: ConfirmationData;
    onEditPersonal?: () => void;
    onEditNextOfKin?: () => void;
    onEditIDs?: () => void;
    onFinish?: () => void;
}

export default function ConfirmationScreen({
    data,
    onEditPersonal,
    onEditNextOfKin,
    onEditIDs,
    onFinish,
}: Props) {
    const navigation = useNavigation();

    const handleFinish = () => {
        if (onFinish) {
            onFinish();
            return;
        }
        // fallback: reset to Home
        // adjust 'Home' to whatever route you use for the app main screen
        navigation.reset({
            index: 0,
            routes: [{ name: "Home" as never }],
        });
    };

    const { personalInfo, nextOfKin, idUploads } = data;

    const renderRow = (label: string, value?: string | null) => (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value ?? "-"}</Text>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Confirm your details</Text>
            <Text style={styles.sub}>Review everything below before finishing.</Text>

            {/* Personal Info Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Personal Information</Text>
                    <TouchableOpacity
                        onPress={onEditPersonal}
                        style={styles.smallEditBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {renderRow("Membership No", personalInfo.membershipNo)}
                {renderRow("First Name", personalInfo.firstName)}
                {renderRow("Last Name", personalInfo.lastName)}
                {renderRow("ID No", personalInfo.idNo)}
                {renderRow("Gender", personalInfo.gender)}
                {renderRow("Date of Birth", personalInfo.dob)}
                {renderRow("Route", personalInfo.route)}
                {renderRow("Phone", personalInfo.phone)}
                {renderRow("Bank", personalInfo.bank)}
                {renderRow("Account No", personalInfo.accountNo)}
            </View>

            {/* Next of Kin Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Next of Kin</Text>
                    <TouchableOpacity
                        onPress={onEditNextOfKin}
                        style={styles.smallEditBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {renderRow("Full Name", nextOfKin.fullName)}
                {renderRow("Phone", nextOfKin.phone)}
                {renderRow("Relationship", nextOfKin.relationship)}
            </View>

            {/* ID Uploads Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>ID Uploads</Text>
                    <TouchableOpacity
                        onPress={onEditIDs}
                        style={styles.smallEditBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.imageRow}>
                    <View style={styles.imageSlot}>
                        <Text style={styles.imageLabel}>Front</Text>
                        {idUploads?.idFront?.uri ? (
                            <Image source={{ uri: idUploads.idFront.uri }} style={styles.imagePreview} />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <Text style={styles.placeholderText}>No front image</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.imageSlot}>
                        <Text style={styles.imageLabel}>Back</Text>
                        {idUploads?.idBack?.uri ? (
                            <Image source={{ uri: idUploads.idBack.uri }} style={styles.imagePreview} />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <Text style={styles.placeholderText}>No back image</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Finish button */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.finishButtonOutline} onPress={() => navigation.goBack()}>
                    <Text style={styles.finishButtonOutlineText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
                    <Text style={styles.finishButtonText}>Finish</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 40,
        backgroundColor: "#f7fafc",
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
    cardTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
    smallEditBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
    },
    smallEditText: { color: "#0f766e", fontWeight: "600" },

    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
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
