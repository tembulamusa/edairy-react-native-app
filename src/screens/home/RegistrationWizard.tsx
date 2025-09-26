// RegistrationWizard.tsx
import React, { useState, useCallback } from "react";
import { View, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { Asset } from "react-native-image-picker";

import ConfirmationScreen, { ConfirmationData } from "./ConfirmationScreen";
import PersonalInfoForm from "../../components/forms/PersonalInfo";
import NextOfKin from "../../components/forms/NextOfKin";
import IdFrontCapture from "../../components/forms/IdFrontCapture";
import IdBackCapture from "../../components/forms/IdBackCapture";
import makeRequest from "../../components/utils/makeRequest"; // ✅ import added

export default function RegistrationWizard() {
    const navigation = useNavigation();
    const route = useRoute<any>();

    const initialStep = route.params?.step ?? 0;
    const [step, setStep] = useState<number>(initialStep);

    const [loading, setLoading] = useState(false); // ✅ loading state
    const [data, setData] = useState<ConfirmationData>({
        personalInfo: {
            membershipNo: "",
            firstName: "",
            lastName: "",
            idNo: "",
            gender: "",
            dob: "",
            route: "",
            phone: "",
            bank: "",
            accountNo: "",
        },
        nextOfKin: {
            fullName: "",
            phone: "",
            relationship: "",
        },
        idUploads: {
            idFront: null,
            idBack: null,
        },
    });

    // Reset step when screen opens fresh
    useFocusEffect(
        useCallback(() => {
            if (!route.params?.step) {
                setStep(0);
            }
        }, [route.params?.step])
    );

    const goNext = () => setStep((prev) => prev + 1);
    const goBack = () => setStep((prev) => Math.max(0, prev - 1));

    const registerMember = async (payload: ConfirmationData) => {
        try {
            setLoading(true);

            const formData = new FormData();

            // personalInfo
            Object.entries(payload.personalInfo).forEach(([key, value]) => {
                formData.append(key, value ?? "");
            });

            // nextOfKin
            Object.entries(payload.nextOfKin).forEach(([key, value]) => {
                formData.append(`nextOfKin[${key}]`, value ?? "");
            });

            // images
            if (payload.idUploads.idFront) {
                formData.append("idFront", {
                    uri: payload.idUploads.idFront.uri,
                    type: payload.idUploads.idFront.type ?? "image/jpeg",
                    name: payload.idUploads.idFront.fileName ?? "id_front.jpg",
                } as any);
            }

            if (payload.idUploads.idBack) {
                formData.append("idBack", {
                    uri: payload.idUploads.idBack.uri,
                    type: payload.idUploads.idBack.type ?? "image/jpeg",
                    name: payload.idUploads.idBack.fileName ?? "id_back.jpg",
                } as any);
            }

            const [status, response] = await makeRequest({
                url: "register-member",
                method: "POST",
                data: formData,
                isFormData: true, // ✅ important for FormData
            });

            if ([200, 201].includes(status)) {
                Alert.alert('Success', "Member successfully created.");
                navigation.navigate("MembersList" as never);
            } else {
                Alert.alert("Error", response?.error || "Registration failed");
            }
        } catch (err) {
            Alert.alert("Error", "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
                <ActivityIndicator size="large" color="#009688" />
            </View>
        );
    }

    switch (step) {
        case 0:
            return (
                <PersonalInfoForm
                    onNext={(personalInfo) => {
                        setData((prev) => ({ ...prev, personalInfo }));
                        goNext();
                    }}
                />
            );
        case 1:
            return (
                <NextOfKin
                    onNext={(nextOfKin) => {
                        setData((prev) => ({ ...prev, nextOfKin }));
                        goNext();
                    }}
                    onPrevious={goBack}
                />
            );
        case 2:
            return (
                <IdFrontCapture
                    onNext={(idFront?: Asset) => {
                        setData((prev) => ({
                            ...prev,
                            idUploads: { ...prev.idUploads, idFront },
                        }));
                        goNext();
                    }}
                    onPrevious={goBack}
                />
            );
        case 3:
            return (
                <IdBackCapture
                    onNext={(idBack?: Asset) => {
                        setData((prev) => ({
                            ...prev,
                            idUploads: { ...prev.idUploads, idBack },
                        }));
                        goNext();
                    }}
                    onPrevious={goBack}
                />
            );
        case 4:
            return (
                <ConfirmationScreen
                    data={data}
                    onEditPersonal={() => setStep(0)}
                    onEditNextOfKin={() => setStep(1)}
                    onEditIDs={() => setStep(2)}
                    onFinish={() => registerMember(data)}
                />
            );
        default:
            return <View style={styles.container} />;
    }
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
});
