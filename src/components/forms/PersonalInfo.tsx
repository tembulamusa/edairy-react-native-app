import React, { useState, useRef } from "react";
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
import DropDownPicker from "react-native-dropdown-picker";
import { globalStyles, getDropdownPickerModalProps } from "../../styles";
import { renderDropdownItem } from "../../assets/styles/all";
import { useFocusEffect } from "@react-navigation/native";
import type { MemberPersonalInfo } from "../../types/memberRegistration";
import { sanitizePersonalForMemberType } from "../../types/memberRegistration";
import { isIndividualMemberType, getMemberPrimaryNameLabel, getMemberPrimaryNamePlaceholder, getPersonalInfoStepTitle } from "../../utils/memberType";

interface PersonalInfoFormProps {
    memberTypeName: string;
    memberTypeId: string;
    onNext: (data: MemberPersonalInfo) => void;
    onPrevious: () => void;
    initialData?: Partial<MemberPersonalInfo>;
}

const TITLE_OPTIONS = [
    { label: "Mr", value: "mr" },
    { label: "Mrs", value: "mrs" },
    { label: "Ms", value: "ms" },
    { label: "Dr", value: "dr" },
    { label: "Prof", value: "prof" },
];

const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({
    memberTypeName,
    memberTypeId,
    onNext,
    onPrevious,
    initialData,
}) => {
    const firstNameInputRef = useRef<TextInput>(null);
    const isIndividual = isIndividualMemberType(memberTypeName);

    const [titleOpen, setTitleOpen] = useState(false);
    const [titleValue, setTitleValue] = useState<string | null>(initialData?.title || null);
    const [titleItems, setTitleItems] = useState(TITLE_OPTIONS);

    const [form, setForm] = useState<MemberPersonalInfo>({
        member_type_id: memberTypeId,
        member_type_name: memberTypeName,
        first_name: initialData?.first_name || "",
        last_name: initialData?.last_name || "",
        other_names: initialData?.other_names || "",
        id_no: initialData?.id_no || "",
        gender: initialData?.gender || "",
        marital_status: initialData?.marital_status || "",
        date_of_birth: initialData?.date_of_birth || "",
        primary_phone: initialData?.primary_phone || "",
        secondary_phone: initialData?.secondary_phone || "",
        birth_city: initialData?.birth_city || "",
        id_date_of_issue: initialData?.id_date_of_issue || "",
        tax_number: initialData?.tax_number || "",
        email: initialData?.email || "",
        title: initialData?.title || "",
    });

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showIdDateOfIssuePicker, setShowIdDateOfIssuePicker] = useState(false);

    const handleChange = (field: keyof MemberPersonalInfo, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    useFocusEffect(
        React.useCallback(() => {
            const timer = setTimeout(() => firstNameInputRef.current?.focus(), 300);
            return () => clearTimeout(timer);
        }, [])
    );

    const isAtLeast18YearsOld = (dateOfBirth: string): boolean => {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 18;
    };

    const handleNext = () => {
        const nameValid = isIndividual
            ? form.first_name && form.last_name
            : Boolean(form.first_name.trim());

        const sharedRequired = isIndividual
            ? nameValid && form.date_of_birth && form.birth_city
            : nameValid;

        const individualRequired = !isIndividual || (form.gender && form.marital_status);

        if (!sharedRequired || !individualRequired) {
            Alert.alert("Missing Fields", "Please fill in all required fields.");
            return;
        }

        if (isIndividual && !isAtLeast18YearsOld(form.date_of_birth)) {
            Alert.alert("Age Requirement", "You must be at least 18 years old to register as a member.");
            return;
        }

        onNext(
            sanitizePersonalForMemberType(
                {
                    ...form,
                    member_type_id: memberTypeId,
                    member_type_name: memberTypeName,
                    title: isIndividual ? titleValue || form.title : "",
                    last_name: isIndividual ? form.last_name : "",
                    other_names: isIndividual ? form.other_names : "",
                    date_of_birth: isIndividual ? form.date_of_birth : "",
                    birth_city: form.birth_city,
                    id_no: isIndividual ? form.id_no : "",
                    id_date_of_issue: isIndividual ? form.id_date_of_issue : "",
                    gender: isIndividual ? form.gender : "",
                    marital_status: isIndividual ? form.marital_status : "",
                },
                memberTypeName
            )
        );
    };

    const onDateChange = (event: Event, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === "ios");
        if (selectedDate) {
            handleChange("date_of_birth", selectedDate.toISOString().split("T")[0]);
        }
    };

    const onIdDateOfIssueChange = (event: Event, selectedDate?: Date) => {
        setShowIdDateOfIssuePicker(Platform.OS === "ios");
        if (selectedDate) {
            handleChange("id_date_of_issue", selectedDate.toISOString().split("T")[0]);
        }
    };

    const renderRadio = (
        field: "gender" | "marital_status",
        value: string,
        label: string
    ) => (
        <TouchableOpacity
            key={value}
            style={globalStyles.radioOption}
            onPress={() => handleChange(field, value)}
        >
            <View
                style={[
                    globalStyles.radioCircle,
                    form[field].toUpperCase() === value.toUpperCase() && globalStyles.radioSelected,
                ]}
            />
            <Text style={globalStyles.radioLabel}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <ScrollView
                nestedScrollEnabled
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => titleOpen && setTitleOpen(false)}
            >
                <Text style={globalStyles.pageTitle}>Member Registration</Text>
                <Text style={globalStyles.pageSubTitle}>{getPersonalInfoStepTitle(memberTypeName)}</Text>
                <Text style={styles.typeBadge}>{memberTypeName}</Text>

                {isIndividual && (
                    <View style={styles.dropdownCol}>
                        <Text style={globalStyles.label}>Title</Text>
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select title")}
                            open={titleOpen}
                            value={titleValue}
                            items={titleItems}
                            setOpen={setTitleOpen}
                            setValue={setTitleValue}
                            setItems={setTitleItems}
                            placeholder="Select title"
                            searchable
                            searchPlaceholder="Search title..."
                            renderListItem={renderDropdownItem}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndex={7000}
                            zIndexInverse={2000}
                        />
                    </View>
                )}

                {isIndividual ? (
                    <View style={globalStyles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={globalStyles.label}>
                                First Name <Text style={styles.required}>*</Text>
                            </Text>
                            <TextInput
                                ref={firstNameInputRef}
                                style={[globalStyles.input, styles.input]}
                                value={form.first_name}
                                onChangeText={(v) => handleChange("first_name", v)}
                                placeholder="First name"
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={globalStyles.label}>
                                Last Name <Text style={styles.required}>*</Text>
                            </Text>
                            <TextInput
                                style={[globalStyles.input, styles.input]}
                                value={form.last_name}
                                onChangeText={(v) => handleChange("last_name", v)}
                                placeholder="Last name"
                            />
                        </View>
                    </View>
                ) : (
                    <View>
                        <Text style={globalStyles.label}>
                            {getMemberPrimaryNameLabel(memberTypeName)}{" "}
                            <Text style={styles.required}>*</Text>
                        </Text>
                        <TextInput
                            ref={firstNameInputRef}
                            style={[globalStyles.input, styles.input]}
                            value={form.first_name}
                            onChangeText={(v) => handleChange("first_name", v)}
                            placeholder={getMemberPrimaryNamePlaceholder(memberTypeName)}
                        />
                    </View>
                )}

                {isIndividual && (
                    <View>
                        <Text style={globalStyles.label}>Other Names</Text>
                        <TextInput
                            style={[globalStyles.input, styles.input]}
                            value={form.other_names}
                            onChangeText={(v) => handleChange("other_names", v)}
                            placeholder="Middle or other names"
                        />
                    </View>
                )}

                {isIndividual && (
                    <View>
                        <Text style={globalStyles.label}>ID No.</Text>
                        <TextInput
                            style={[globalStyles.input, styles.input]}
                            value={form.id_no}
                            onChangeText={(v) => handleChange("id_no", v)}
                            placeholder="National ID number"
                            keyboardType="default"
                        />
                    </View>
                )}

                {isIndividual && (
                    <>
                        <Text style={[globalStyles.label, { marginTop: 16 }]}>
                            Gender <Text style={styles.required}>*</Text>
                        </Text>
                        <View style={globalStyles.row}>
                            {renderRadio("gender", "MALE", "Male")}
                            {renderRadio("gender", "FEMALE", "Female")}
                        </View>

                        <Text style={[globalStyles.label, { marginTop: 16 }]}>
                            Marital Status <Text style={styles.required}>*</Text>
                        </Text>
                        <View style={globalStyles.row}>
                            {renderRadio("marital_status", "SINGLE", "Single")}
                            {renderRadio("marital_status", "MARRIED", "Married")}
                            {renderRadio("marital_status", "DIVORCED", "Divorced")}
                        </View>
                    </>
                )}

                {isIndividual && (
                    <View>
                        <Text style={globalStyles.label}>
                            Date of Birth <Text style={styles.required}>*</Text>
                        </Text>
                        <TouchableOpacity style={globalStyles.inputWithIcon} onPress={() => setShowDatePicker(true)}>
                            <Text style={{ flex: 1, color: form.date_of_birth ? "#111827" : "#9ca3af" }}>
                                {form.date_of_birth || "Select date"}
                            </Text>
                            <Icon name="calendar-today" size={20} color="#009688" />
                        </TouchableOpacity>
                        {showDatePicker && (
                            <DateTimePicker
                                value={form.date_of_birth ? new Date(form.date_of_birth) : new Date()}
                                mode="date"
                                display="spinner"
                                onChange={onDateChange}
                            />
                        )}
                    </View>
                )}

                {isIndividual && (
                    <View>
                        <Text style={globalStyles.label}>ID Date of Issue</Text>
                        <TouchableOpacity
                            style={globalStyles.inputWithIcon}
                            onPress={() => setShowIdDateOfIssuePicker(true)}
                        >
                            <Text style={{ flex: 1, color: form.id_date_of_issue ? "#111827" : "#9ca3af" }}>
                                {form.id_date_of_issue || "Select ID issue date"}
                            </Text>
                            <Icon name="calendar-today" size={20} color="#009688" />
                        </TouchableOpacity>
                        {showIdDateOfIssuePicker && (
                            <DateTimePicker
                                value={form.id_date_of_issue ? new Date(form.id_date_of_issue) : new Date()}
                                mode="date"
                                display="spinner"
                                onChange={onIdDateOfIssueChange}
                            />
                        )}
                    </View>
                )}

                <View>
                    <Text style={globalStyles.label}>
                        {isIndividual ? "Birth City" : "City / Location"}
                        {isIndividual ? <Text style={styles.required}> *</Text> : null}
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        value={form.birth_city}
                        onChangeText={(v) => handleChange("birth_city", v)}
                        placeholder="City"
                    />
                </View>

                <View>
                    <Text style={globalStyles.label}>Tax Number (KRA PIN)</Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        value={form.tax_number}
                        onChangeText={(v) => handleChange("tax_number", v)}
                        placeholder="Tax number"
                    />
                </View>

                <View style={globalStyles.navRow}>
                    <TouchableOpacity style={globalStyles.navButtonOutline} onPress={onPrevious}>
                        <Text style={[globalStyles.navButtonText, { color: "#009688" }]}>← Previous</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={globalStyles.navButtonFilled} onPress={handleNext}>
                        <Text style={globalStyles.navButtonText}>Next →</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingBottom: 100,
    },
    typeBadge: {
        alignSelf: "flex-start",
        backgroundColor: "#e0f2f1",
        color: "#00796b",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 16,
        overflow: "hidden",
    },
    dropdownCol: {
        zIndex: 7000,
        elevation: 7,
        marginBottom: 16,
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
