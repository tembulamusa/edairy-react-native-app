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
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/MaterialIcons";
import DateTimePicker, { Event } from "@react-native-community/datetimepicker";
import { globalStyles } from "../../styles";
import fetchCommonData from "../utils/fetchCommonData";
import DropDownPicker from "react-native-dropdown-picker";
import { renderDropdownItem } from "../../assets/styles/all";
import { useFocusEffect } from "@react-navigation/native";

interface DBUInfoFormProps {
    onNext: (data: any) => void;
    onPrevious: () => void;
    initialData?: any;
}

const DBUInfoForm: React.FC<DBUInfoFormProps> = ({ onNext, onPrevious, initialData }) => {
    const membershipNoInputRef = useRef<TextInput>(null);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [user, setUser] = useState<any | null>(null);

    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(initialData?.routeId ? parseInt(initialData.routeId) : null);
    const [routeItems, setRouteItems] = useState<any[]>([]);

    const [centerOpen, setCenterOpen] = useState(false);
    const [centerValue, setCenterValue] = useState<number | null>(initialData?.centerId ? parseInt(initialData.centerId) : null);
    const [centerItems, setCenterItems] = useState<any[]>([]);
    const [allCenters, setAllCenters] = useState<any[]>([]); // Store all centers for filtering

    const [form, setForm] = React.useState({
        dateRegistered: initialData?.dateRegistered || "",
        routeId: initialData?.routeId || "",
        routeName: initialData?.routeName || "",
        centerId: initialData?.centerId || "",
        centerName: initialData?.centerName || "",
        numberOfCows: initialData?.numberOfCows || "",
        membershipNo: initialData?.membershipNo || "",
    });

    const [showDateRegisteredPicker, setShowDateRegisteredPicker] = React.useState(false);

    const handleChange = (field: string, value: string) => {
        setForm((prevForm) => ({ ...prevForm, [field]: value }));
    };

    useEffect(() => {
        const loadCommonData = async () => {
            try {
                // Load user data first
                const storedUser = await AsyncStorage.getItem("user");
                let userData = null;
                if (storedUser) {
                    userData = JSON.parse(storedUser);
                    setUser(userData);
                }

                const [routes, centers, transporters] = await Promise.all([
                    fetchCommonData({ name: "routes" }),
                    fetchCommonData({ name: "centers" }),
                    userData ? fetchCommonData({ name: "transporters", cachable: false }) : Promise.resolve([]),
                ]);

                setRouteItems(
                    (routes || []).map((r: any) => ({
                        label: `${r.route_name} (${r.route_code})`,
                        value: r.id,
                        routeName: r.route_name,
                    }))
                );
                // Store all centers for filtering
                const centersData = (centers || []).map((c: any) => ({
                    label: `${c.center}`,
                    value: c.id,
                    centerName: c.center,
                    routeId: c.route_id, // Store route_id for filtering
                }));

                // Store all centers for filtering
                setAllCenters(centersData);

                // Initially show all centers (route not selected yet)
                setCenterItems(centersData);

                // Auto-select route for transporters
                if (userData && userData.user_groups?.includes("transporter") && userData.member_id && transporters) {
                    const matchedTransporter = (transporters || []).find((t: any) => t.member_id === userData.member_id);
                    if (matchedTransporter && matchedTransporter.route_id) {
                        const matchedRoute = (routes || []).find((r: any) => r.id === matchedTransporter.route_id);
                        if (matchedRoute) {
                            setRouteValue(matchedTransporter.route_id);
                            handleChange("routeId", matchedTransporter.route_id.toString());
                            handleChange("routeName", matchedRoute.route_name);
                            console.log("[DBUInfo] Auto-selected route for transporter:", matchedRoute.route_name);
                        }
                    }
                }

                setDataLoaded(true);
            } catch (err) {
                Alert.alert("Error", `Failed to load common data ${JSON.stringify(err)}`);
                setDataLoaded(true);
            }
        };
        loadCommonData();
    }, []);

    // Filter centers based on selected route
    useEffect(() => {
        if (allCenters.length > 0) {
            if (routeValue) {
                // Filter centers to only show those belonging to the selected route
                const filteredCenters = allCenters.filter((center: any) => center.routeId === routeValue);
                setCenterItems(filteredCenters);

                // Reset center selection if current center doesn't belong to new route
                if (centerValue && !filteredCenters.find((c: any) => c.value === centerValue)) {
                    setCenterValue(null);
                    handleChange("centerId", "");
                    handleChange("centerName", "");
                }
            } else {
                // If no route selected, show all centers
                setCenterItems(allCenters);
            }
        }
    }, [routeValue, allCenters, centerValue]);

    // Focus membership number input when screen comes into focus and data is loaded
    useFocusEffect(
        React.useCallback(() => {
            const timer = setTimeout(() => {
                if (dataLoaded && membershipNoInputRef.current) {
                    membershipNoInputRef.current.focus();
                }
            }, 300);
            return () => clearTimeout(timer);
        }, [dataLoaded])
    );

    const handleNext = () => {
        if (
            !form.dateRegistered ||
            !form.routeId ||
            !form.centerId ||
            !form.numberOfCows ||
            !form.membershipNo
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

    const onDateRegisteredChange = (event: Event, selectedDate?: Date) => {
        setShowDateRegisteredPicker(Platform.OS === "ios");
        if (selectedDate) {
            const formatted = selectedDate.toISOString().split("T")[0];
            handleChange("dateRegistered", formatted);
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
                    if (routeOpen) {
                        setRouteOpen(false);
                    }
                    if (centerOpen) {
                        setCenterOpen(false);
                    }
                }}
                scrollEventThrottle={16}
            >
                <Text style={globalStyles.pageTitle}>Member Registration</Text>
                <Text style={globalStyles.pageSubTitle}>DBU Information</Text>

                {/* Date Registered */}
                <View>
                    <Text style={globalStyles.label}>
                        Date Registered <Text style={styles.required}>*</Text>
                    </Text>
                    <TouchableOpacity
                        style={globalStyles.inputWithIcon}
                        onPress={() => setShowDateRegisteredPicker(true)}
                    >
                        <Text style={{ flex: 1, color: form.dateRegistered ? "#111827" : "#9ca3af" }}>
                            {form.dateRegistered || "Date registered with DBU"}
                        </Text>
                        <Icon name="calendar-today" size={20} color="#009688" />
                    </TouchableOpacity>

                    {showDateRegisteredPicker && (
                        <DateTimePicker
                            value={form.dateRegistered ? new Date(form.dateRegistered) : new Date()}
                            mode="date"
                            display="spinner"
                            onChange={onDateRegisteredChange}
                        />
                    )}
                </View>

                {/* Route */}
                <View style={{ zIndex: 9000 }}>
                    <Text style={globalStyles.label}>
                        Select Route <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={[styles.col, { zIndex: 9000 }]}>
                        <DropDownPicker
                            open={routeOpen}
                            style={[globalStyles.input, styles.dropdown]}
                            value={routeValue}
                            items={routeItems}
                            setOpen={setRouteOpen}
                            setValue={(callback) => {
                                const value = callback(routeValue);
                                setRouteValue(value);
                                const selectedRoute = routeItems.find(item => item.value === value);
                                const routeName = selectedRoute ? (selectedRoute.routeName || selectedRoute.label) : "";
                                handleChange("routeId", value?.toString() || "");
                                handleChange("routeName", routeName);
                            }}
                            setItems={setRouteItems}
                            placeholder="Select route"
                            searchable
                            renderListItem={renderDropdownItem}
                            zIndex={8000}
                            zIndexInverse={7000}
                            listMode="SCROLLVIEW"
                            maxHeight={300}
                            scrollViewProps={{
                                nestedScrollEnabled: true,
                            }}
                            dropDownContainerStyle={[styles.dropdownContainer, { zIndex: 8000 }]}
                        />
                    </View>
                </View>

                {/* Center */}
                <View style={{ zIndex: 1000 }}>
                    <Text style={globalStyles.label}>
                        Select Center <Text style={styles.required}>*</Text>
                    </Text>
                    <View style={[styles.col, { zIndex: 1000 }]}>
                        <DropDownPicker
                            open={centerOpen}
                            style={[globalStyles.input, styles.dropdown]}
                            value={centerValue}
                            items={centerItems}
                            setOpen={setCenterOpen}
                            setValue={(callback) => {
                                const value = callback(centerValue);
                                setCenterValue(value);
                                const selectedCenter = centerItems.find(item => item.value === value);
                                const centerName = selectedCenter ? (selectedCenter.centerName || selectedCenter.label) : "";
                                handleChange("centerId", value?.toString() || "");
                                handleChange("centerName", centerName);
                            }}
                            setItems={setCenterItems}
                            placeholder="Select center"
                            searchable
                            renderListItem={renderDropdownItem}
                            zIndex={-1}
                            zIndexInverse={-1}
                            listMode="SCROLLVIEW"
                            maxHeight={300}
                            scrollViewProps={{
                                nestedScrollEnabled: true,
                            }}
                            dropDownContainerStyle={[styles.dropdownContainer, { zIndex: 500 }]}
                        />
                    </View>
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
                    <View style={globalStyles.row}>
                        <TextInput
                            ref={membershipNoInputRef}
                            style={[globalStyles.input, styles.input, { flex: 1, marginRight: 8 }]}
                            placeholder="Enter Membership Number"
                            value={form.membershipNo}
                            onChangeText={(v) => handleChange("membershipNo", v)}
                            keyboardType="default"
                        />
                        <TouchableOpacity style={globalStyles.validateButton} onPress={validateMembership}>
                            <Text style={globalStyles.validateButtonText}>Validate</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Navigation buttons */}
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
    col: {
        zIndex: 1000,
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

export default DBUInfoForm;