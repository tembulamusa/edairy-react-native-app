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
import { globalStyles } from "../../styles";
import type { MemberRegistrationData } from "../../types/memberRegistration";
import { isIndividualMemberType, getMemberPrimaryNameLabel, getPersonalInfoStepTitle } from "../../utils/memberType";

interface Props {
    data: MemberRegistrationData;
    onEditMemberType?: () => void;
    onEditPersonal?: () => void;
    onEditFarm?: () => void;
    onEditBanking?: () => void;
    onEditNextOfKin?: () => void;
    onEditPhotos?: () => void;
    onFinish?: () => void;
}

export default function ConfirmationScreen({
    data,
    onEditMemberType,
    onEditPersonal,
    onEditFarm,
    onEditBanking,
    onEditNextOfKin,
    onEditPhotos,
    onFinish,
}: Props) {
    const navigation = useNavigation();
    const { member_type, personal, farm, banking, next_of_kins, photos } = data;
    const isIndividual = isIndividualMemberType(member_type.member_type_name);

    const handleFinish = () => {
        if (onFinish) {
            onFinish();
            return;
        }
        navigation.reset({
            index: 0,
            routes: [{ name: "Home" as never }],
        });
    };

    const renderRow = (label: string, value?: string | null) => (
        <View style={globalStyles.row}>
            <Text style={globalStyles.rowLabel}>{label}</Text>
            <Text style={globalStyles.rowValue}>{value?.trim() ? value : "-"}</Text>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={globalStyles.title}>Confirm your details</Text>
            <Text style={globalStyles.sub}>Review everything below before submitting.</Text>

            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>Member Type</Text>
                    <TouchableOpacity onPress={onEditMemberType} style={globalStyles.smallEditBtn}>
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>
                {renderRow("Type", member_type.member_type_name)}
            </View>

            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>
                        {getPersonalInfoStepTitle(member_type.member_type_name)}
                    </Text>
                    <TouchableOpacity onPress={onEditPersonal} style={globalStyles.smallEditBtn}>
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>
                {isIndividual && renderRow("Title", personal.title)}
                {isIndividual ? (
                    <>
                        {renderRow("First Name", personal.first_name)}
                        {renderRow("Last Name", personal.last_name)}
                        {renderRow("Other Names", personal.other_names)}
                    </>
                ) : (
                    renderRow(getMemberPrimaryNameLabel(member_type.member_type_name), personal.first_name)
                )}
                {isIndividual && renderRow("ID No", personal.id_no)}
                {isIndividual && renderRow("Gender", personal.gender)}
                {isIndividual && renderRow("Date of Birth", personal.date_of_birth)}
                {isIndividual && renderRow("Marital Status", personal.marital_status)}
                {isIndividual && renderRow("ID Date of Issue", personal.id_date_of_issue)}
                {renderRow("Tax Number", personal.tax_number)}
                {renderRow(isIndividual ? "Birth City" : "City / Location", personal.birth_city)}
            </View>

            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>Contacts</Text>
                    <TouchableOpacity onPress={onEditNextOfKin} style={globalStyles.smallEditBtn}>
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>
                {renderRow("Primary Phone", personal.primary_phone)}
                {renderRow("Secondary Phone", personal.secondary_phone)}
                {renderRow("Email", personal.email)}
            </View>

            {isIndividual && (
                <View style={globalStyles.card}>
                    <View style={globalStyles.cardHeader}>
                        <Text style={globalStyles.cardTitle}>Next of Kin</Text>
                        <TouchableOpacity onPress={onEditNextOfKin} style={globalStyles.smallEditBtn}>
                            <Text style={globalStyles.smallEditText}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                    {(next_of_kins || []).map((kin, index) => (
                        <View key={`kin-review-${index}`} style={styles.kinReviewBlock}>
                            <Text style={styles.kinReviewTitle}>
                                {kin.is_primary
                                    ? `Next of Kin ${index + 1} (Primary)`
                                    : `Next of Kin ${index + 1}`}
                            </Text>
                            {renderRow("Full Name", kin.full_name)}
                            {renderRow("Relationship", kin.relationship)}
                            {renderRow("Phone", kin.phone_number)}
                            {renderRow("Alternative Phone", kin.alternative_phone_number)}
                            {renderRow("Email", kin.email_address)}
                            {renderRow("National ID", kin.national_id_no)}
                            {renderRow("Postal Address", kin.postal_address)}
                            {renderRow("Physical Address", kin.physical_address)}
                            {renderRow("Occupation", kin.occupation)}
                            {renderRow("Active", kin.status !== false ? "Yes" : "No")}
                            {renderRow("Remarks", kin.remarks)}
                        </View>
                    ))}
                </View>
            )}

            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>Farm & Route</Text>
                    <TouchableOpacity onPress={onEditFarm} style={globalStyles.smallEditBtn}>
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>
                {renderRow("Member No", farm.member_no)}
                {renderRow("Route", farm.route_name || farm.route_id)}
                {renderRow("Center", farm.center_name || farm.center_id)}
                {renderRow("Number of Cows", farm.number_of_cows)}
            </View>

            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>Banking</Text>
                    <TouchableOpacity onPress={onEditBanking} style={globalStyles.smallEditBtn}>
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>
                {renderRow("Bank", banking.bank_name || banking.bank_id)}
                {renderRow("Bank Branch", banking.bank_branch)}
                {renderRow("Account No", banking.account_no)}
                {renderRow("Account Name", banking.account_name)}
            </View>

            <View style={globalStyles.card}>
                <View style={globalStyles.cardHeader}>
                    <Text style={globalStyles.cardTitle}>Photos</Text>
                    <TouchableOpacity onPress={onEditPhotos} style={globalStyles.smallEditBtn}>
                        <Text style={globalStyles.smallEditText}>Edit</Text>
                    </TouchableOpacity>
                </View>
                <View style={globalStyles.imageRow}>
                    {[
                        ...(isIndividual
                            ? [
                                  { label: "ID Front", asset: photos.id_front_photo },
                                  { label: "ID Back", asset: photos.id_back_photo },
                              ]
                            : []),
                        { label: "Passport", asset: photos.passport_photo },
                    ].map(({ label, asset }) => (
                        <View key={label} style={globalStyles.imageSlot}>
                            <Text style={globalStyles.imageLabel}>{label}</Text>
                            {asset?.uri ? (
                                <Image source={{ uri: asset.uri }} style={globalStyles.imagePreview} />
                            ) : (
                                <View style={globalStyles.imagePlaceholder}>
                                    <Text style={globalStyles.placeholderText}>No image</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </View>

            <View style={globalStyles.footer}>
                <TouchableOpacity style={globalStyles.finishButtonOutline} onPress={() => navigation.goBack()}>
                    <Text style={globalStyles.finishButtonOutlineText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={globalStyles.finishButton} onPress={handleFinish}>
                    <Text style={globalStyles.finishButtonText}>Submit</Text>
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
    kinReviewBlock: {
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    kinReviewTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#374151",
        marginBottom: 8,
    },
});
