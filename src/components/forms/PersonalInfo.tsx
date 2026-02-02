import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Platform,
    KeyboardAvoidingView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import DateTimePicker, { Event } from "@react-native-community/datetimepicker";
import { globalStyles } from "../../styles";
import fetchCommonData from "../utils/fetchCommonData";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all";
import { useFocusEffect } from "@react-navigation/native";

interface PersonalInfoFormProps {
    onNext: (data: any) => void;
    initialData?: any;
}

const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ onNext, initialData }) => {
    const firstNameInputRef = useRef<TextInput>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    const [form, setForm] = React.useState({
        firstName: initialData?.firstName || "",
        lastName: initialData?.lastName || "",
        idNo: initialData?.idNo || "",
        gender: initialData?.gender || "",
        dob: initialData?.dob || "",
        phone: initialData?.phone || "",
        secondaryPhone: initialData?.secondaryPhone || "",
        maritalStatus: initialData?.maritalStatus || "",
        birthCity: initialData?.birthCity || "",
        idDateOfIssue: initialData?.idDateOfIssue || "",
        taxNumber: initialData?.taxNumber || "",
    });

    const [showDatePicker, setShowDatePicker] = React.useState(false);
    const [showIdDateOfIssuePicker, setShowIdDateOfIssuePicker] = React.useState(false);

    const handleChange = (field: string, value: string) => {
        setForm((prevForm) => ({ ...prevForm, [field]: value }));
    };

    useEffect(() => {
        setDataLoaded(true);
    }, []);

    // Focus first name input when screen comes into focus and data is loaded
    useFocusEffect(
        React.useCallback(() => {
            // Delay focus slightly to ensure component is fully mounted
            const timer = setTimeout(() => {
                if (dataLoaded && firstNameInputRef.current) {
                    firstNameInputRef.current.focus();
                }
            }, 300);
            return () => clearTimeout(timer);
        }, [dataLoaded])
    );
    const isAtLeast18YearsOld = (dateOfBirth: string): boolean => {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);

        // Calculate age
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        // Adjust age if birthday hasn't occurred this year
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age >= 18;
    };

    const handleNext = () => {
        if (
            !form.firstName ||
            !form.lastName ||
            !form.idNo ||
            !form.gender ||
            !form.dob ||
            !form.idDateOfIssue ||
            !form.birthCity ||
            !form.phone ||
            !form.maritalStatus ||
            !form.secondaryPhone
        ) {
            Alert.alert("Missing Fields", "Please fill in all required fields.");
            return;
        }

        // Check age requirement
        if (!isAtLeast18YearsOld(form.dob)) {
            Alert.alert(
                "Age Requirement",
                "You must be at least 18 years old to register as a member."
            );
            return;
        }

        onNext(form);
    };


    const onDateChange = (event: Event, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === "ios"); // keep picker open on iOS
        if (selectedDate) {
            const formatted = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD
            handleChange("dob", formatted);
        }
    };

    const onIdDateOfIssueChange = (event: Event, selectedDate?: Date) => {
        setShowIdDateOfIssuePicker(Platform.OS === "ios"); // keep picker open on iOS
        if (selectedDate) {
            const formatted = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD
            handleChange("idDateOfIssue", formatted);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
            <ScrollView
                nestedScrollEnabled
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
            >
                <Text style={globalStyles.pageTitle}>Member Registration</Text>
                <Text style={globalStyles.pageSubTitle}>Personal Info</Text>

                {/* First & Last Name */}
                <View style={globalStyles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={globalStyles.label}>
                            First Name <Text style={styles.required}>*</Text>
                        </Text>
                        <TextInput
                            ref={firstNameInputRef}
                            style={[globalStyles.input, styles.input]}
                            value={form.firstName}
                            onChangeText={(v) => handleChange("firstName", v)}
                            placeholder="First Name"
                            blurOnSubmit={false}
                            returnKeyType="next"
                        />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={globalStyles.label}>
                            Last Name <Text style={globalStyles.required}>*</Text>
                        </Text>
                        <TextInput
                            style={[globalStyles.input, styles.input]}
                            value={form.lastName}
                            onChangeText={(v) => handleChange("lastName", v)}
                            placeholder="Last Name"
                        />
                    </View>
                </View>

                {/* ID No */}
                <View>
                    <Text style={globalStyles.label}>
                        ID No. <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        value={form.idNo}
                        onChangeText={(v) => handleChange("idNo", v)}
                        placeholder="Enter ID Number"
                        keyboardType="numeric"
                    />
                </View>

                {/* Gender */}
                <Text style={[globalStyles.label, { marginTop: 16 }]}>
                    Gender <Text style={styles.required}>*</Text>
                </Text>
                <View style={globalStyles.row}>
                    <TouchableOpacity
                        style={globalStyles.radioOption}
                        onPress={() => handleChange("gender", "Male")}
                    >
                        <View
                            style={[
                                globalStyles.radioCircle,
                                form.gender === "Male" && globalStyles.radioSelected,
                            ]}
                        />
                        <Text style={globalStyles.radioLabel}>Male</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={globalStyles.radioOption}
                        onPress={() => handleChange("gender", "Female")}
                    >
                        <View
                            style={[
                                globalStyles.radioCircle,
                                form.gender === "Female" && globalStyles.radioSelected,
                            ]}
                        />
                        <Text style={globalStyles.radioLabel}>Female</Text>
                    </TouchableOpacity>
                </View>

                {/* Marital Status */}
                <Text style={[globalStyles.label, { marginTop: 16 }]}>
                    Marital Status <Text style={styles.required}>*</Text>
                </Text>
                <View style={globalStyles.row}>
                    <TouchableOpacity
                        style={globalStyles.radioOption}
                        onPress={() => handleChange("maritalStatus", "Single")}
                    >
                        <View
                            style={[
                                globalStyles.radioCircle,
                                form.maritalStatus === "Single" && globalStyles.radioSelected,
                            ]}
                        />
                        <Text style={globalStyles.radioLabel}>Single</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={globalStyles.radioOption}
                        onPress={() => handleChange("maritalStatus", "Married")}
                    >
                        <View
                            style={[
                                globalStyles.radioCircle,
                                form.maritalStatus === "Married" && globalStyles.radioSelected,
                            ]}
                        />
                        <Text style={globalStyles.radioLabel}>Married</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={globalStyles.radioOption}
                        onPress={() => handleChange("maritalStatus", "Divorced")}
                    >
                        <View
                            style={[
                                globalStyles.radioCircle,
                                form.maritalStatus === "Divorced" && globalStyles.radioSelected,
                            ]}
                        />
                        <Text style={globalStyles.radioLabel}>Divorced</Text>
                    </TouchableOpacity>
                </View>

                {/* Date of Birth */}
                <View>
                    <Text style={globalStyles.label}>
                        Date of Birth <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                        style={globalStyles.inputWithIcon}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Text style={{ flex: 1, color: form.dob ? "#111827" : "#9ca3af" }}>
                            {form.dob || "Select DOB"}
                        </Text>
                        <Icon name="calendar-today" size={20} color="#009688" />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker
                            value={form.dob ? new Date(form.dob) : new Date()}
                            mode="date"
                            display="spinner" // 👈 works on both iOS & Android
                            onChange={onDateChange}
                        />
                    )}
                </View>

                {/* ID Date of Issue */}
                <View>
                    <Text style={globalStyles.label}>
                        ID Date of Issue <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                        style={globalStyles.inputWithIcon}
                        onPress={() => setShowIdDateOfIssuePicker(true)}
                    >
                        <Text style={{ flex: 1, color: form.idDateOfIssue ? "#111827" : "#9ca3af" }}>
                            {form.idDateOfIssue || "Select ID Date of Issue"}
                        </Text>
                        <Icon name="calendar-today" size={20} color="#009688" />
                    </TouchableOpacity>

                    {showIdDateOfIssuePicker && (
                        <DateTimePicker
                            value={form.idDateOfIssue ? new Date(form.idDateOfIssue) : new Date()}
                            mode="date"
                            display="spinner" // 👈 works on both iOS & Android
                            onChange={onIdDateOfIssueChange}
                        />
                    )}
                </View>

                {/* Phone No */}
                <View>
                    <Text style={globalStyles.label}>
                        Phone No. <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        placeholder="Enter Phone Number"
                        value={form.phone}
                        onChangeText={(v) => handleChange("phone", v)}
                        keyboardType="phone-pad"
                    />
                </View>
                <View>
                    <Text style={globalStyles.label}>
                        Alternative Phone No. <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        placeholder="Enter Alternative Phone Number"
                        value={form.secondaryPhone}
                        onChangeText={(v) => handleChange("secondaryPhone", v)}
                        keyboardType="phone-pad"
                    />
                </View>
                {/* Birth City */}
                <View>
                    <Text style={globalStyles.label}>
                        Birth City <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        placeholder="Enter Birth City"
                        value={form.birthCity}
                        onChangeText={(v) => handleChange("birthCity", v)}
                        keyboardType="default"
                    />
                </View>

                {/* Membership Number */}
                <View>
                    <Text style={globalStyles.label}>
                        tax Number <Text style={styles.required}></Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        placeholder="Enter Tax Number"
                        value={form.taxNumber}
                        onChangeText={(v) => handleChange("taxNumber", v)}
                        keyboardType="default"
                    />
                </View>


                <TouchableOpacity style={globalStyles.nextButton} onPress={handleNext}>
                    <Text style={globalStyles.nextButtonText}>Next</Text>
                    <Icon name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 100, // Extra padding for bottom tab bar (60px) + keyboard clearance
    },
    input: {
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
    },
    required: {
        color: "#ef4444",
    },
});

export default PersonalInfoForm;
