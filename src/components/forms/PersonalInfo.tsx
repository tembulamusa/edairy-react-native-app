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
}

const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ onNext }) => {
    const firstNameInputRef = useRef<TextInput>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [routeItems, setRouteItems] = useState<any[]>([]);

    const [form, setForm] = React.useState({
        firstName: "",
        lastName: "",
        idNo: "",
        gender: "",
        dob: "",
        routeId: "",
        routeName: "",
        phone: "",
        secondaryPhone: "",
        maritalStatus: "",
        membershipNo: "",
        birthCity: "",
        idDateOfIssue: "",
        numberOfCows: "",
        taxNumber: "",
        dateRegistered: "",
    });

    const [showDatePicker, setShowDatePicker] = React.useState(false);
    const [showDateRegisteredPicker, setShowDateRegisteredPicker] = React.useState(false);
    const [showIdDateOfIssuePicker, setShowIdDateOfIssuePicker] = React.useState(false);

    const handleChange = (field: string, value: string) => {
        setForm((prevForm) => ({ ...prevForm, [field]: value }));
    };

    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const [routes] =
                    await Promise.all([
                        fetchCommonData({ name: "routes" }),
                    ]);
                const allData = { routes };
                setRouteItems(
                    (routes || []).map((r: any) => ({
                        label: `${r.route_name} (${r.route_code})`,
                        value: r.id,
                        routeName: r.route_name, // Store route name separately for easy access
                    }))
                );
                setDataLoaded(true);
            } catch (err) {
                Alert.alert("Error", `Failed to load common data ${JSON.stringify(err)}`);
                setDataLoaded(true);
            }
        };
        loadCommonData();
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
            !form.dateRegistered ||
            !form.idDateOfIssue ||
            // !form.dateRegistered ||
            !form.routeId ||
            !form.birthCity ||
            !form.membershipNo ||
            !form.numberOfCows ||
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

    const validateMembership = () => {
        if (!form.membershipNo) {
            Alert.alert("Validation", "Please enter a membership number first.");
            return;
        }
        // TODO: Replace with API call
        Alert.alert("Validated", `Membership No ${form.membershipNo} is valid`);
    };

    const onDateChange = (event: Event, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === "ios"); // keep picker open on iOS
        if (selectedDate) {
            const formatted = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD
            handleChange("dob", formatted);
        }
    };

    const onDateRegisteredChange = (event: Event, selectedDate?: Date) => {
        setShowDateRegisteredPicker(Platform.OS === "ios"); // keep picker open on iOS
        if (selectedDate) {
            const formatted = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD
            handleChange("dateRegistered", formatted);
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
                onScrollBeginDrag={() => {
                    // Close dropdown when ScrollView starts scrolling
                    if (routeOpen) {
                        setRouteOpen(false);
                    }
                }}
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
                                form.maritalStatus === "Female" && globalStyles.radioSelected,
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

                {/* ID Date Registered */}
                <View>
                    <Text style={globalStyles.label}>
                        Date Registered <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                        style={globalStyles.inputWithIcon}
                        onPress={() => setShowDateRegisteredPicker(true)}
                    >
                        <Text style={{ flex: 1, color: form.dateRegistered ? "#111827" : "#9ca3af" }}>
                            {form.dateRegistered || "Select ID Date Registered"}
                        </Text>
                        <Icon name="calendar-today" size={20} color="#009688" />
                    </TouchableOpacity>

                    {showDateRegisteredPicker && (
                        <DateTimePicker
                            value={form.dateRegistered ? new Date(form.dateRegistered) : new Date()}
                            mode="date"
                            display="spinner" // 👈 works on both iOS & Android
                            onChange={onDateRegisteredChange}
                        />
                    )}
                </View>

                {/* ID Date of Issue */}
                <View>
                    <Text style={globalStyles.label}>
                        ID Date of Issue
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


                {/* Route */}
                <View>
                    <Text style={globalStyles.label}>
                        Select Route <Text style={globalStyles.required}>*</Text>
                    </Text>
                    <View style={styles.col}>
                        <DropDownPicker
                            open={routeOpen}
                            style={[globalStyles.input, styles.dropdown]}
                            value={routeValue}
                            items={routeItems}
                            setOpen={setRouteOpen}
                            setValue={(callback) => {
                                const value = callback(routeValue);
                                setRouteValue(value);
                                // Find the selected route to get its name
                                const selectedRoute = routeItems.find(item => item.value === value);
                                // Use routeName if available, otherwise use label
                                const routeName = selectedRoute ? (selectedRoute.routeName || selectedRoute.label) : "";
                                handleChange("routeId", value?.toString() || "");
                                handleChange("routeName", routeName);
                            }}
                            setItems={setRouteItems}
                            placeholder="Select route"
                            searchable
                            renderListItem={renderDropdownItem}
                            zIndex={4000}
                            zIndexInverse={3000}
                            listMode="SCROLLVIEW"
                            maxHeight={300}
                            scrollViewProps={{
                                nestedScrollEnabled: true,
                            }}
                            dropDownContainerStyle={styles.dropdownContainer}
                        />
                    </View>
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

                {/* Number of Cows */}
                <View>
                    <Text style={globalStyles.label}>
                        Number of Cows <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        placeholder="Enter Number of Cows"
                        value={form.numberOfCows}
                        onChangeText={(v) => handleChange("numberOfCows", v)}
                        keyboardType="numeric"
                    />
                </View>

                {/* Membership Number */}
                <View>
                    <Text style={globalStyles.label}>
                        Membership Number <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        placeholder="Enter Membership Number"
                        value={form.membershipNo}
                        onChangeText={(v) => handleChange("membershipNo", v)}
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
    col: {
        zIndex: 4000,
    },
    dropdown: {
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
    },
    dropdownContainer: {
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
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
