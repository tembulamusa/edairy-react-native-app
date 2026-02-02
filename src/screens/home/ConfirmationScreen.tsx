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
import { globalStyles } from "../../styles";

type PersonalInfo = {
    firstName: string;
    lastName: string;
    idNo: string;
    gender: string;
    dob: string;
    phone: string;
    secondaryPhone: string;
    maritalStatus: string;
    birthCity?: string;
    idDateOfIssue?: string;
    taxNumber?: string;
};

type DBUInfo = {
    dateRegistered: string;
    routeId: string;
    routeName?: string;
    centerId: string;
    centerName?: string;
    numberOfCows: string;
    membershipNo: string;
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
    dbuInfo: DBUInfo;
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
    onEditDBUInfo?: () => void;
    onEditNextOfKin?: () => void;
    onEditIDs?: () => void;
    onFinish?: () => void;
}

export default function ConfirmationScreen({
    data,
    onEditPersonal,
    onEditDBUInfo,
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

    const { personalInfo, dbuInfo, nextOfKin, idUploads } = data;

    const renderRow = (label: string, value?: string | null) => (
        <View style={globalStyles.row}>
            <Text style={globalStyles.rowLabel}>{label}</Text>
            <Text style={globalStyles.rowValue}>{value ?? "-"}</Text>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={globalStyles.title}>Confirm your details</Text>
            <Text style={globalStyles.sub}>Review everything below before finishing.</Text>

            {/* Personal Info Card */}
            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>Personal Information</Text>
                    <TouchableOpacity
                        onPress={onEditPersonal}
                        style={globalStyles.smallEditBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {renderRow("First Name", personalInfo.firstName)}
                {renderRow("Last Name", personalInfo.lastName)}
                {renderRow("ID No", personalInfo.idNo)}
                {renderRow("Gender", personalInfo.gender)}
                {renderRow("Date of Birth", personalInfo.dob)}
                {renderRow("Marital Status", personalInfo.maritalStatus)}
                {renderRow("Phone", personalInfo.phone)}
                {renderRow("Alternative Phone", personalInfo.secondaryPhone)}
                {renderRow("ID Date of Issue", personalInfo.idDateOfIssue)}
                {renderRow("Tax Number", personalInfo.taxNumber)}
                {renderRow("Birth City", personalInfo.birthCity)}
            </View>

            {/* DBU Info Card */}
            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>DBU Information</Text>
                    <TouchableOpacity
                        onPress={onEditDBUInfo}
                        style={globalStyles.smallEditBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {renderRow("Membership No", dbuInfo.membershipNo)}
                {renderRow("Date Registered", dbuInfo.dateRegistered)}
                {renderRow("Route", dbuInfo.routeName || dbuInfo.routeId || "-")}
                {renderRow("Center", dbuInfo.centerName || dbuInfo.centerId || "-")}
                {renderRow("Number of Cows", dbuInfo.numberOfCows)}
            </View>

            {/* Next of Kin Card */}
            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>Next of Kin</Text>
                    <TouchableOpacity
                        onPress={onEditNextOfKin}
                        style={globalStyles.smallEditBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {renderRow("Full Name", nextOfKin.nextOfKinFullName || nextOfKin.fullName)}
                {renderRow("Phone", nextOfKin.nextOfKinPhone || nextOfKin.phone)}
                {renderRow("Relationship", nextOfKin.nextOfKinRelationship || nextOfKin.relationship)}
            </View>

            {/* ID Uploads Card */}
            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>ID Uploads</Text>
                    <TouchableOpacity
                        onPress={onEditIDs}
                        style={globalStyles.smallEditBtn}
                        activeOpacity={0.8}
                    >
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                <View style={globalStyles.imageRow}>
                    <View style={globalStyles.imageSlot}>
                        <Text style={globalStyles.imageLabel}>Front</Text>
                        {idUploads?.idFront?.uri ? (
                            <Image source={{ uri: idUploads.idFront.uri }} style={globalStyles.imagePreview} />
                        ) : (
                            <View style={globalStyles.imagePlaceholder}>
                                <Text style={globalStyles.placeholderText}>No front image</Text>
                            </View>
                        )}
                    </View>

                    <View style={globalStyles.imageSlot}>
                        <Text style={globalStyles.imageLabel}>Back</Text>
                        {idUploads?.idBack?.uri ? (
                            <Image source={{ uri: idUploads.idBack.uri }} style={globalStyles.imagePreview} />
                        ) : (
                            <View style={globalStyles.imagePlaceholder}>
                                <Text style={globalStyles.placeholderText}>No back image</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Finish button */}
            <View style={globalStyles.footer}>
                <TouchableOpacity style={globalStyles.finishButtonOutline} onPress={() => navigation.goBack()}>
                    <Text style={globalStyles.finishButtonOutlineText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity style={globalStyles.finishButton} onPress={handleFinish}>
                    <Text style={globalStyles.finishButtonText}>Finish</Text>
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

});
