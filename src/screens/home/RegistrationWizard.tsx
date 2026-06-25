import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import MemberTypeStep from "../../components/forms/MemberTypeStep";
import PersonalInfoForm from "../../components/forms/PersonalInfo";
import DBUInfoForm from "../../components/forms/DBUInfo";
import BankingInfoForm from "../../components/forms/BankingInfoForm";
import NextOfKin from "../../components/forms/NextOfKin";
import MemberPhotosForm from "../../components/forms/MemberPhotosForm";
import ConfirmationScreen from "./ConfirmationScreen";
import makeRequest from "../../components/utils/makeRequest";
import { buildMemberRegistrationFormData } from "../../utils/memberRegistrationPayload";
import {
    createEmptyNextOfKin,
    EMPTY_MEMBER_REGISTRATION,
    sanitizeNextOfKinsForMemberType,
    sanitizePersonalForMemberType,
    sanitizePhotosForMemberType,
    type MemberRegistrationData,
} from "../../types/memberRegistration";
import { isIndividualMemberType } from "../../utils/memberType";

const STEP_LABELS = [
    "Type",
    "Personal",
    "Farm & Route",
    "Banking",
    "Contacts",
    "Photos",
    "Review",
];

export default function RegistrationWizard() {
    const navigation = useNavigation();
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [data, setData] = useState<MemberRegistrationData>(EMPTY_MEMBER_REGISTRATION);

    const memberTypeName = data.member_type.member_type_name;
    const isIndividual = isIndividualMemberType(memberTypeName);

    const updateSection = <K extends keyof MemberRegistrationData>(
        section: K,
        sectionData: MemberRegistrationData[K]
    ) => {
        setData((prev) => ({ ...prev, [section]: sectionData }));
    };

    const registerMember = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const formData = buildMemberRegistrationFormData(data);
            const [status, response] = await makeRequest({
                url: "members",
                method: "POST",
                data: formData,
                isFormData: true,
            });

            if (status === 200 || status === 201) {
                Alert.alert("Success", "Member registered successfully.", [
                    {
                        text: "OK",
                        onPress: () => {
                            setData(EMPTY_MEMBER_REGISTRATION);
                            setStep(0);
                            navigation.goBack();
                        },
                    },
                ]);
            } else {
                const message =
                    (response as any)?.message ||
                    (response as any)?.error ||
                    JSON.stringify(response) ||
                    "Registration failed.";
                Alert.alert("Registration Failed", message);
            }
        } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to register member.");
        } finally {
            setSubmitting(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <MemberTypeStep
                        initialData={data.member_type}
                        onNext={(member_type) => {
                            const nextIsIndividual = isIndividualMemberType(member_type.member_type_name);
                            updateSection("member_type", member_type);
                            updateSection(
                                "personal",
                                sanitizePersonalForMemberType(
                                    {
                                        ...data.personal,
                                        member_type_id: member_type.member_type_id,
                                        member_type_name: member_type.member_type_name,
                                        first_name: "",
                                        last_name: "",
                                    },
                                    member_type.member_type_name
                                )
                            );
                            updateSection(
                                "next_of_kins",
                                nextIsIndividual && data.next_of_kins.length === 0
                                    ? [createEmptyNextOfKin(true)]
                                    : sanitizeNextOfKinsForMemberType(
                                          data.next_of_kins,
                                          member_type.member_type_name
                                      )
                            );
                            updateSection(
                                "photos",
                                sanitizePhotosForMemberType(data.photos, member_type.member_type_name)
                            );
                            setStep(1);
                        }}
                    />
                );
            case 1:
                return (
                    <PersonalInfoForm
                        memberTypeId={data.member_type.member_type_id}
                        memberTypeName={data.member_type.member_type_name}
                        initialData={data.personal}
                        onPrevious={() => setStep(0)}
                        onNext={(personal) => {
                            updateSection("personal", personal);
                            setStep(2);
                        }}
                    />
                );
            case 2:
                return (
                    <DBUInfoForm
                        initialData={data.farm}
                        onPrevious={() => setStep(1)}
                        onNext={(farm) => {
                            updateSection("farm", farm);
                            setStep(3);
                        }}
                    />
                );
            case 3:
                return (
                    <BankingInfoForm
                        initialData={data.banking}
                        onPrevious={() => setStep(2)}
                        onNext={(banking) => {
                            updateSection("banking", banking);
                            setStep(4);
                        }}
                    />
                );
            case 4:
                return (
                    <NextOfKin
                        isIndividual={isIndividual}
                        initialContacts={{
                            primary_phone: data.personal.primary_phone,
                            secondary_phone: data.personal.secondary_phone,
                            email: data.personal.email,
                        }}
                        initialData={data.next_of_kins}
                        onPrevious={() => setStep(3)}
                        onNext={(contactsStep) => {
                            updateSection("personal", {
                                ...data.personal,
                                primary_phone: contactsStep.primary_phone,
                                secondary_phone: contactsStep.secondary_phone,
                                email: contactsStep.email,
                            });
                            updateSection("next_of_kins", contactsStep.next_of_kins);
                            setStep(5);
                        }}
                    />
                );
            case 5:
                return (
                    <MemberPhotosForm
                        isIndividual={isIndividual}
                        initialData={data.photos}
                        onPrevious={() => setStep(4)}
                        onNext={(photos) => {
                            updateSection("photos", photos);
                            setStep(6);
                        }}
                    />
                );
            case 6:
                return (
                    <ConfirmationScreen
                        data={data}
                        onEditMemberType={() => setStep(0)}
                        onEditPersonal={() => setStep(1)}
                        onEditFarm={() => setStep(2)}
                        onEditBanking={() => setStep(3)}
                        onEditNextOfKin={() => setStep(4)}
                        onEditPhotos={() => setStep(5)}
                        onFinish={registerMember}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.progressRow}>
                {STEP_LABELS.map((label, index) => (
                    <View
                        key={label}
                        style={[
                            styles.progressDot,
                            index <= step ? styles.progressDotActive : null,
                        ]}
                    />
                ))}
            </View>
            {renderStep()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    progressRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#d1d5db",
    },
    progressDotActive: {
        backgroundColor: "#009688",
    },
});
