import React from "react";
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

interface PersonalInfoFormProps {
    onNext: (data: any) => void;
}

const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ onNext }) => {
    const [form, setForm] = React.useState({
        membershipNo: "",
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

    const handleNext = () => {
        if (
            !form.membershipNo ||
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
        <ScrollView contentContainerStyle={styles.container}>
            {/* Membership No with Validate button */}
            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.label}>
                        Membership Number <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Membership No."
                        value={form.membershipNo}
                        onChangeText={(v) => handleChange("membershipNo", v)}
                    />
                </View>
                <TouchableOpacity style={styles.smallButton} onPress={validateMembership}>
                    <Text style={styles.smallButtonText}>Validate</Text>
                </TouchableOpacity>
            </View>

            {/* First & Last Name */}
            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>
                        First Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={styles.input}
                        value={form.firstName}
                        onChangeText={(v) => handleChange("firstName", v)}
                        placeholder="First Name"
                    />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>
                        Last Name <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={styles.input}
                        value={form.lastName}
                        onChangeText={(v) => handleChange("lastName", v)}
                        placeholder="Last Name"
                    />
                </View>
            </View>

            {/* ID No */}
            <View>
                <Text style={styles.label}>
                    ID No. <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                    style={styles.input}
                    value={form.idNo}
                    onChangeText={(v) => handleChange("idNo", v)}
                    placeholder="Enter ID Number"
                    keyboardType="numeric"
                />
            </View>

            {/* Gender */}
            <Text style={[styles.label, { marginTop: 16 }]}>
                Gender <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.row}>
                <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => handleChange("gender", "Male")}
                >
                    <View
                        style={[
                            styles.radioCircle,
                            form.gender === "Male" && styles.radioSelected,
                        ]}
                    />
                    <Text style={styles.radioLabel}>Male</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => handleChange("gender", "Female")}
                >
                    <View
                        style={[
                            styles.radioCircle,
                            form.gender === "Female" && styles.radioSelected,
                        ]}
                    />
                    <Text style={styles.radioLabel}>Female</Text>
                </TouchableOpacity>
            </View>

            {/* Date of Birth */}
            <View>
                <Text style={styles.label}>
                    Date of Birth <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                    style={styles.inputWithIcon}
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
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={onDateChange}
                    />
                )}
            </View>

            {/* Route */}
            <View>
                <Text style={styles.label}>
                    Select Route <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWithIcon}>
                    <TextInput
                        style={[styles.input, { flex: 1, borderWidth: 0 }]}
                        placeholder="Select Route"
                        value={form.route}
                        onChangeText={(v) => handleChange("route", v)}
                    />
                    <Icon name="arrow-drop-down" size={24} color="#009688" />
                </View>
            </View>

            {/* Phone No */}
            <View>
                <Text style={styles.label}>
                    Phone No. <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter Phone Number"
                    value={form.phone}
                    onChangeText={(v) => handleChange("phone", v)}
                    keyboardType="phone-pad"
                />
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Next</Text>
                <Icon name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { padding: 20 },
    row: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    label: { fontSize: 14, color: "#374151", marginBottom: 6 },
    required: { color: "red" },
    input: {
        backgroundColor: "#fff",
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#d1d5db",
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: "#111827",
        elevation: 1,
        marginBottom: 16,
    },
    inputWithIcon: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#d1d5db",
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 16,
        elevation: 1,
    },
    nextButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#009688",
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 18,
        marginTop: 20,
        alignSelf: "flex-end",
    },
    nextButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
        marginRight: 6,
    },
    smallButton: {
        backgroundColor: "#009688",
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 25,
        alignSelf: "flex-end",
    },
    smallButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    radioOption: { flexDirection: "row", alignItems: "center", marginRight: 20 },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: "#009688",
        marginRight: 6,
    },
    radioSelected: { backgroundColor: "#009688" },
    radioLabel: { fontSize: 14, color: "#374151" },
});

export default PersonalInfoForm;
