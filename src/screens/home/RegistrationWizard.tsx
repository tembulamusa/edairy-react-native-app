import React, { useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { Asset } from "react-native-image-picker";

import ConfirmationScreen, { ConfirmationData } from "./ConfirmationScreen";
import PersonalInfoForm from "../../components/forms/PersonalInfo";
import DBUInfoForm from "../../components/forms/DBUInfo";
import NextOfKin from "../../components/forms/NextOfKin";
import IdFrontCapture from "../../components/forms/IdFrontCapture";
import IdBackCapture from "../../components/forms/IdBackCapture";
import makeRequest from "../../components/utils/makeRequest";
import { globalStyles } from "../../styles";
import CustomAlert from "../../components/utils/customAlert";

export default function RegistrationWizard() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const initialStep = route.params?.step ?? 0;

    const [step, setStep] = useState<number>(initialStep);
    const [loading, setLoading] = useState(false);

    // Alert states
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertTitle, setAlertTitle] = useState("Alert");
    const [alertIcon, setAlertIcon] = useState("info");
    const [alertType, setAlertType] = useState<"success" | "error" | "info">("info");
    const [alertConfirm, setAlertConfirm] = useState<(() => void) | undefined>(undefined);

    const [data, setData] = useState<ConfirmationData>({
        personalInfo: {
            firstName: "",
            lastName: "",
            idNo: "",
            gender: "",
            maritalStatus: "",
            secondaryPhone: "",
            dob: "",
            idDateOfIssue: "",
            phone: "",
            birthCity: "",
            taxNumber: "",
        },
        dbuInfo: {
            dateRegistered: "",
            routeId: "",
            routeName: "",
            centerId: "",
            centerName: "",
            numberOfCows: "",
            membershipNo: "",
        },
        nextOfKin: {
            nextOfKinFullName: "",
            nextOfKinPhone: "",
            nextOfKinRelationship: "",
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

    // Alert helper
    const showAlert = (
        title: string,
        message: string,
        icon: string = "info",
        type: "success" | "error" | "info" = "info",
        onConfirm?: () => void
    ) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertIcon(icon);
        setAlertType(type);
        setAlertConfirm(() => onConfirm);
        setAlertVisible(true);
    };

    const goNext = () => setStep((prev) => prev + 1);
    const goBack = () => setStep((prev) => Math.max(0, prev - 1));

    const registerMember = async (payload: ConfirmationData) => {
        // Alert.alert("The data submitted successfully!", JSON.stringify(payload));
        try {
            setLoading(true);

            const formData = new FormData();

            // Merge personalInfo and dbuInfo
            const mergedData = { ...payload.personalInfo, ...payload.dbuInfo };

            // personalInfo + dbuInfo - exclude routeName and centerName as we only submit IDs
            // Map dateRegistered to dateRegistred for backend
            // Ensure all fields are included even if empty (including idDateOfIssue)
            Object.entries(mergedData).forEach(([key, value]) => {
                if (key !== "routeName" && key !== "centerName") {
                    // Map dateRegistered to dateRegistred for backend
                    const formKey = key === "dateRegistered" ? "dateRegistered" : key;
                    // Always append, even if value is empty string
                    formData.append(formKey, value !== undefined && value !== null ? value : "");
                }
            });

            // Explicitly ensure dateRegistred is included if it exists in personalInfo
            if (payload.personalInfo.dateRegistered !== undefined) {
                formData.append("dateRegistered", payload.personalInfo.dateRegistered || "");
            }

            // nextOfKin
            Object.entries(payload.nextOfKin).forEach(([key, value]) => {
                formData.append(`${key}`, value ?? "");
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
                isFormData: true,
            });
            if ([200, 201].includes(status)) {
                showAlert(
                    "Success",
                    "Member registered successfully! Starting new registration.",
                    "check-circle",
                    "success",
                    () => {
                        setAlertVisible(false);
                        // Reset form to start fresh registration
                        setStep(0);
                        setData({
                            personalInfo: {
                                firstName: "",
                                lastName: "",
                                idNo: "",
                                gender: "",
                                maritalStatus: "",
                                secondaryPhone: "",
                                dob: "",
                                idDateOfIssue: "",
                                phone: "",
                                birthCity: "",
                                taxNumber: "",
                            },
                            dbuInfo: {
                                dateRegistered: "",
                                routeId: "",
                                routeName: "",
                                centerId: "",
                                centerName: "",
                                numberOfCows: "",
                                membershipNo: "",
                            },
                            nextOfKin: {
                                nextOfKinFullName: "",
                                nextOfKinPhone: "",
                                nextOfKinRelationship: "",
                            },
                            idUploads: {
                                idFront: null,
                                idBack: null,
                            },
                        });
                    }
                );
            } else {
                showAlert("Error", response?.message || "Registration failed.", "error", "error");
            }
        } catch (err) {
            showAlert("Error", "Something went wrong. Please try again.", "error", "error");
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

    let content: JSX.Element;

    switch (step) {
        case 0:
            content = (
                <PersonalInfoForm
                    onNext={(personalInfo) => {
                        setData((prev) => ({ ...prev, personalInfo }));
                        goNext();
                    }}
                    initialData={data.personalInfo}
                />
            );
            break;
        case 1:
            content = (
                <DBUInfoForm
                    onNext={(dbuInfo) => {
                        setData((prev) => ({ ...prev, dbuInfo }));
                        goNext();
                    }}
                    onPrevious={goBack}
                    initialData={data.dbuInfo}
                />
            );
            break;
        case 2:
            content = (
                <NextOfKin
                    onNext={(nextOfKin) => {
                        setData((prev) => ({ ...prev, nextOfKin }));
                        goNext();
                    }}
                    onPrevious={goBack}
                    initialData={data.nextOfKin}
                />
            );
            break;
        case 3:
            content = (
                <IdFrontCapture
                    onNext={(idFront?: Asset) => {
                        setData((prev) => ({
                            ...prev,
                            idUploads: { ...prev.idUploads, idFront },
                        }));
                        goNext();
                    }}
                    onPrevious={goBack}
                    initialImage={data.idUploads?.idFront}
                />
            );
            break;
        case 4:
            content = (
                <IdBackCapture
                    onNext={(idBack?: Asset) => {
                        setData((prev) => ({
                            ...prev,
                            idUploads: { ...prev.idUploads, idBack },
                        }));
                        goNext();
                    }}
                    onPrevious={goBack}
                    initialImage={data.idUploads?.idBack}
                />
            );
            break;
        default:
            content = (
                <ConfirmationScreen
                    data={data}
                    onEditPersonal={() => setStep(0)}
                    onEditDBUInfo={() => setStep(1)}
                    onEditNextOfKin={() => setStep(2)}
                    onEditIDs={() => setStep(3)}
                    onFinish={() => registerMember(data)}
                />
            );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 160}
        >
            {content}

            {/* ✅ Always render CustomAlert */}
            <CustomAlert
                visible={alertVisible}
                title={alertTitle}
                message={alertMessage}
                icon={alertIcon}
                type={alertType}
                onClose={() => setAlertVisible(false)}
                onConfirm={
                    alertConfirm
                        ? () => {
                            setAlertVisible(false);
                            alertConfirm?.();
                        }
                        : undefined
                }
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
});
