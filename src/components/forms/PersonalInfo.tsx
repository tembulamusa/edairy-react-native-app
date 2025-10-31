import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import DateTimePicker, { Event } from "@react-native-community/datetimepicker";
import { globalStyles } from "../../styles";
import fetchCommonData from "../utils/fetchCommonData";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all";

interface PersonalInfoFormProps {
    onNext: (data: any) => void;
}

const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ onNext }) => {

    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(null);
    const [routeItems, setRouteItems] = useState<any[]>([]);

    const [form, setForm] = React.useState({
        firstName: "",
        lastName: "",
        idNo: "",
        gender: "",
        dob: "",
        route: "",
        phone: "",
    });

    const [showDatePicker, setShowDatePicker] = React.useState(false);

    const handleChange = (field: string, value: string) => {
        setForm({ ...form, [field]: value });
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
                    }))
                );
            } catch (err) {
                Alert.alert("Error", `Failed to load common data ${JSON.stringify(err)}`);
            }
        };
        loadCommonData();
    }, []);
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
            !form.route ||
            !form.phone
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

    return (
        <ScrollView nestedScrollEnabled contentContainerStyle={styles.container}>
            <Text style={globalStyles.pageTitle}>Member Registration</Text>
            <Text style={globalStyles.pageSubTitle}>Personal Info</Text>

            {/* First & Last Name */}
            <View style={globalStyles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={globalStyles.label}>
                        First Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={globalStyles.input}
                        value={form.firstName}
                        onChangeText={(v) => handleChange("firstName", v)}
                        placeholder="First Name"
                    />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={globalStyles.label}>
                        Last Name <Text style={globalStyles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={globalStyles.input}
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
                    style={globalStyles.input}
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

            {/* Route */}
            <View>
                <Text style={globalStyles.label}>
                    Select Route <Text style={globalStyles.required}>*</Text>
                </Text>
                <View style={styles.col}>
                    <DropDownPicker
                        open={routeOpen}
                        style={globalStyles.input}
                        value={routeValue}
                        items={routeItems}
                        setOpen={setRouteOpen}
                        setValue={(callback) => {
                            const value = callback(routeValue);
                            setRouteValue(value);
                            handleChange("route", value?.toString() || "");
                        }}
                        setItems={setRouteItems}
                        placeholder="Select route"
                        searchable
                        renderListItem={renderDropdownItem}
                        zIndex={4000}
                        zIndexInverse={3000}
                    />
                </View>
            </View>

            {/* Phone No */}
            <View>
                <Text style={globalStyles.label}>
                    Phone No. <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                    style={globalStyles.input}
                    placeholder="Enter Phone Number"
                    value={form.phone}
                    onChangeText={(v) => handleChange("phone", v)}
                    keyboardType="phone-pad"
                />
            </View>

            <TouchableOpacity style={globalStyles.nextButton} onPress={handleNext}>
                <Text style={globalStyles.nextButtonText}>Next</Text>
                <Icon name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { padding: 20 },

});

export default PersonalInfoForm;
