import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DropDownPicker from "react-native-dropdown-picker";
import { globalStyles, getDropdownPickerModalProps } from "../../styles";
import fetchCommonData from "../utils/fetchCommonData";
import { renderDropdownItem } from "../../assets/styles/all";
import { useFocusEffect } from "@react-navigation/native";
import { fetchRouteCentersForRoute } from "../../services/offlineReferenceData";
import {
    getRouteCenterDisplayName,
    getRouteName,
    toRouteCenterDropdownItems,
    toRouteDropdownItems,
} from "../../utils/route";
import { resolveDropDownPickerValue } from "../../utils/dropdownItems";
import type { MemberFarmInfo } from "../../types/memberRegistration";

interface DBUInfoFormProps {
    onNext: (data: MemberFarmInfo) => void;
    onPrevious: () => void;
    initialData?: Partial<MemberFarmInfo>;
}

const DBUInfoForm: React.FC<DBUInfoFormProps> = ({ onNext, onPrevious, initialData }) => {
    const memberNoInputRef = useRef<TextInput>(null);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [loadingCenters, setLoadingCenters] = useState(false);
    const [routes, setRoutes] = useState<any[]>([]);

    const [routeOpen, setRouteOpen] = useState(false);
    const [routeValue, setRouteValue] = useState<number | null>(
        initialData?.route_id ? parseInt(initialData.route_id, 10) : null
    );
    const [routeItems, setRouteItems] = useState<{ label: string; value: number }[]>([]);

    const [centerOpen, setCenterOpen] = useState(false);
    const [centerValue, setCenterValue] = useState<number | null>(
        initialData?.center_id ? parseInt(initialData.center_id, 10) : null
    );
    const [centerItems, setCenterItems] = useState<{ label: string; value: number }[]>([]);
    const [routeCenters, setRouteCenters] = useState<any[]>([]);

    const [form, setForm] = useState<MemberFarmInfo>({
        route_id: initialData?.route_id || "",
        route_name: initialData?.route_name || "",
        center_id: initialData?.center_id || "",
        center_name: initialData?.center_name || "",
        number_of_cows: initialData?.number_of_cows || "",
        member_no: initialData?.member_no || "",
    });

    const handleChange = (field: keyof MemberFarmInfo, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const loadRouteCenters = useCallback(async (routeId: number) => {
        setLoadingCenters(true);
        try {
            const centers = await fetchRouteCentersForRoute(routeId, {
                logContext: "MemberRegistration",
            });
            setRouteCenters(centers);
            setCenterItems(toRouteCenterDropdownItems(centers));

            if (centers.length === 1) {
                const onlyCenter = centers[0];
                setCenterValue(onlyCenter.id);
                setForm((prev) => ({
                    ...prev,
                    center_id: String(onlyCenter.id),
                    center_name: getRouteCenterDisplayName(onlyCenter),
                }));
            }
        } catch {
            setRouteCenters([]);
            setCenterItems([]);
        } finally {
            setLoadingCenters(false);
        }
    }, []);

    const handleRouteSelect = useCallback(
        (routeId: number | null) => {
            const numericRouteId =
                routeId == null || !Number.isFinite(Number(routeId)) ? null : Number(routeId);

            setRouteValue(numericRouteId);
            setCenterValue(null);
            setCenterItems([]);
            setRouteCenters([]);
            setForm((prev) => ({
                ...prev,
                center_id: "",
                center_name: "",
                route_id: numericRouteId != null ? String(numericRouteId) : "",
                route_name:
                    numericRouteId != null
                        ? getRouteName(routes.find((route) => route.id === numericRouteId))
                        : "",
            }));

            if (numericRouteId == null) {
                return;
            }

            loadRouteCenters(numericRouteId);
        },
        [routes, loadRouteCenters]
    );

    useEffect(() => {
        const loadCommonData = async () => {
            try {
                const storedUser = await AsyncStorage.getItem("user");
                const userData = storedUser ? JSON.parse(storedUser) : null;

                const [routesData, transporters] = await Promise.all([
                    fetchCommonData({ name: "routes" }),
                    userData ? fetchCommonData({ name: "transporters", cachable: false }) : Promise.resolve([]),
                ]);

                const routeList = Array.isArray(routesData) ? routesData : [];
                setRoutes(routeList);
                setRouteItems(toRouteDropdownItems(routeList));

                const initialRouteId =
                    routeValue ??
                    (initialData?.route_id ? parseInt(initialData.route_id, 10) : null);

                if (initialRouteId) {
                    const matchedRoute = routeList.find((route) => route.id === initialRouteId);
                    if (matchedRoute) {
                        setForm((prev) => ({
                            ...prev,
                            route_id: String(initialRouteId),
                            route_name: getRouteName(matchedRoute),
                        }));
                    }
                }

                if (userData?.user_groups?.includes("transporter") && userData.member_id && transporters) {
                    const matchedTransporter = (transporters || []).find(
                        (t: any) => t.member_id === userData.member_id
                    );
                    if (matchedTransporter?.route_id) {
                        handleRouteSelect(matchedTransporter.route_id);
                    }
                } else if (routeValue) {
                    await loadRouteCenters(routeValue);
                }

                setDataLoaded(true);
            } catch (err) {
                Alert.alert("Error", `Failed to load common data ${JSON.stringify(err)}`);
                setDataLoaded(true);
            }
        };
        loadCommonData();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            const timer = setTimeout(() => {
                if (dataLoaded && memberNoInputRef.current) {
                    memberNoInputRef.current.focus();
                }
            }, 300);
            return () => clearTimeout(timer);
        }, [dataLoaded])
    );

    const handleNext = () => {
        if (!routeValue || !form.number_of_cows || !form.member_no) {
            Alert.alert("Missing Fields", "Please fill route, member number, and number of cows.");
            return;
        }

        onNext({
            ...form,
            route_id: String(routeValue),
            center_id: centerValue != null ? String(centerValue) : "",
        });
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "padding"}>
            <ScrollView
                nestedScrollEnabled
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={() => {
                    if (routeOpen) setRouteOpen(false);
                    if (centerOpen) setCenterOpen(false);
                }}
            >
                <Text style={globalStyles.pageTitle}>Member Registration</Text>
                <Text style={globalStyles.pageSubTitle}>Farm & Route</Text>

                <View style={styles.dropdownCol}>
                    <Text style={globalStyles.label}>
                        Route <Text style={styles.required}>*</Text>
                    </Text>
                    <DropDownPicker
                        {...getDropdownPickerModalProps("Select route")}
                        open={routeOpen}
                        value={routeValue}
                        items={routeItems}
                        setOpen={setRouteOpen}
                        setValue={(valueOrCallback) => {
                            const nextValue = resolveDropDownPickerValue(valueOrCallback, routeValue);
                            handleRouteSelect(nextValue as number | null);
                        }}
                        setItems={setRouteItems}
                        placeholder="Select route"
                        searchable
                        searchPlaceholder="Search route..."
                        renderListItem={renderDropdownItem}
                        style={globalStyles.basedropdown}
                        dropDownContainerStyle={[
                            globalStyles.basedropdown,
                            globalStyles.dropdownListContainer,
                        ]}
                        zIndex={8000}
                        zIndexInverse={1000}
                    />
                </View>

                <View style={styles.dropdownCol}>
                    <Text style={globalStyles.label}>Collection Center</Text>
                    {loadingCenters ? (
                        <ActivityIndicator size="small" color="#009688" style={{ marginVertical: 12 }} />
                    ) : (
                        <DropDownPicker
                            {...getDropdownPickerModalProps("Select route center")}
                            open={centerOpen}
                            value={centerValue}
                            items={centerItems}
                            setOpen={setCenterOpen}
                            disabled={!routeValue || centerItems.length === 0}
                            setValue={(valueOrCallback) => {
                                const nextValue = resolveDropDownPickerValue(valueOrCallback, centerValue);
                                const centerId =
                                    nextValue == null || !Number.isFinite(Number(nextValue))
                                        ? null
                                        : Number(nextValue);
                                setCenterValue(centerId);
                                const selected = routeCenters.find((center) => center.id === centerId);
                                setForm((prev) => ({
                                    ...prev,
                                    center_id: centerId != null ? String(centerId) : "",
                                    center_name: getRouteCenterDisplayName(selected),
                                }));
                            }}
                            setItems={setCenterItems}
                            placeholder={
                                !routeValue
                                    ? "Select a route first"
                                    : centerItems.length === 0
                                      ? "No centers for this route"
                                      : "Select center (optional)"
                            }
                            searchable
                            searchPlaceholder="Search center..."
                            renderListItem={renderDropdownItem}
                            style={globalStyles.basedropdown}
                            dropDownContainerStyle={[
                                globalStyles.basedropdown,
                                globalStyles.dropdownListContainer,
                            ]}
                            zIndex={7000}
                            zIndexInverse={2000}
                        />
                    )}
                </View>

                <View>
                    <Text style={globalStyles.label}>
                        Number of Cows <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={[globalStyles.input, styles.input]}
                        value={form.number_of_cows}
                        onChangeText={(v) => handleChange("number_of_cows", v)}
                        keyboardType="numeric"
                        placeholder="e.g. 15"
                    />
                </View>

                <View>
                    <Text style={globalStyles.label}>
                        Member Number <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        ref={memberNoInputRef}
                        style={[globalStyles.input, styles.input]}
                        value={form.member_no}
                        onChangeText={(v) => handleChange("member_no", v)}
                        placeholder="e.g. Meb_6775"
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
    dropdownCol: {
        zIndex: 8000,
        elevation: 8,
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

export default DBUInfoForm;
