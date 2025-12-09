import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import DropDownPicker from "react-native-dropdown-picker";

type PreferenceKey =
    | "notifications_enabled"
    | "biometrics_enabled"
    | "dark_mode_enabled"
    | "auto_print_enabled"
    | "scale_connection_type";

const preferenceDefaults: Record<PreferenceKey, boolean | string> = {
    notifications_enabled: true,
    biometrics_enabled: false,
    dark_mode_enabled: false,
    auto_print_enabled: true,
    scale_connection_type: "ble", // Default to BLE
};

const SettingsScreen: React.FC = () => {
    const navigation = useNavigation();
    const [user, setUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean | string>>(preferenceDefaults);

    // Scale connection type dropdown state
    const [scaleTypeOpen, setScaleTypeOpen] = useState(false);
    const [scaleTypeItems, setScaleTypeItems] = useState([
        { label: "Bluetooth Low Energy (BLE)", value: "ble" },
        { label: "Classic Bluetooth", value: "classic" },
    ]);

    const preferenceStorageKey = "@edairyApp:user_preferences";

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            const storedUser = await AsyncStorage.getItem("user");
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            } else {
                setUser(null);
            }

            const storedPrefs = await AsyncStorage.getItem(preferenceStorageKey);
            if (storedPrefs) {
                const parsed = JSON.parse(storedPrefs);
                setPreferences({
                    ...preferenceDefaults,
                    ...parsed,
                });
            } else {
                setPreferences(preferenceDefaults);
            }
        } catch (error) {
            console.error("[Settings] Failed to load settings", error);
            Alert.alert("Error", "Failed to load settings.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleToggle = async (key: PreferenceKey, value: boolean) => {
        try {
            setSaving(true);
            const nextPrefs = { ...preferences, [key]: value };
            setPreferences(nextPrefs);
            await AsyncStorage.setItem(preferenceStorageKey, JSON.stringify(nextPrefs));
        } catch (error) {
            Alert.alert("Error", "Failed to save preference. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await AsyncStorage.multiRemove(["user", "token"]);
            Alert.alert("Signed Out", "You have been signed out. Please login again.");
            navigation.navigate("Auth" as never);
        } catch (error) {
            Alert.alert("Error", "Failed to sign out. Please try again.");
        }
    };

    const handleChangePassword = () => {
        Alert.alert("Change Password", "Password change functionality will be available soon.");
    };

    const handleUpdateProfile = () => {
        navigation.navigate("Profile" as never);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16a34a" />
                <Text style={styles.loadingText}>Loading settings...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerCard}>
                <Icon name="settings" size={32} color="#047857" />
                <Text style={styles.headerTitle}>Settings</Text>
                <Text style={styles.headerSubtitle}>
                    Manage your profile, preferences, and app experience.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>
                <View style={styles.card}>
                    <View style={styles.accountRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.accountName}>
                                {user?.member_details?.full_name ||
                                    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
                                    user?.username ||
                                    "Member"}
                            </Text>
                            <Text style={styles.accountEmail}>
                                {user?.email || user?.member_details?.primary_phone || "Email not provided"}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.outlineButton} onPress={handleUpdateProfile}>
                            <Text style={styles.outlineButtonText}>View Profile</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.listRow} onPress={handleChangePassword}>
                        <Icon name="lock" size={20} color="#64748b" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.listTitle}>Change Password</Text>
                            <Text style={styles.listSubtitle}>Update your password periodically for security.</Text>
                        </View>
                        <Icon name="chevron-right" size={20} color="#cbd5f5" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>App Preferences</Text>
                <View style={styles.card}>
                    <View style={styles.preferenceRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>Notifications</Text>
                            <Text style={styles.listSubtitle}>Receive updates about cashouts and deliveries.</Text>
                        </View>
                        <Switch
                            value={preferences.notifications_enabled}
                            onValueChange={(val) => handleToggle("notifications_enabled", val)}
                        />
                    </View>
                    <View style={styles.preferenceRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>Auto Print Receipts</Text>
                            <Text style={styles.listSubtitle}>Automatically print receipts after recordings.</Text>
                        </View>
                        <Switch
                            value={preferences.auto_print_enabled}
                            onValueChange={(val) => handleToggle("auto_print_enabled", val)}
                        />
                    </View>
                    <View style={styles.preferenceRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>Use Biometrics</Text>
                            <Text style={styles.listSubtitle}>Enable biometric authentication at login.</Text>
                        </View>
                        <Switch
                            value={preferences.biometrics_enabled}
                            onValueChange={(val) => handleToggle("biometrics_enabled", val)}
                        />
                    </View>
                    <View style={styles.preferenceRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>Dark Mode</Text>
                            <Text style={styles.listSubtitle}>Reduce eye strain by enabling dark theme.</Text>
                        </View>
                        <Switch
                            value={preferences.dark_mode_enabled}
                            onValueChange={(val) => handleToggle("dark_mode_enabled", val)}
                        />
                    </View>
                    <View style={{ marginVertical: 8 }}>
                        <Text style={styles.listTitle}>🔧 Scale Connection Type</Text>
                        <Text style={styles.listSubtitle}>Choose how to connect to your scale device (BLE recommended).</Text>
                        <DropDownPicker
                            listMode="SCROLLVIEW"
                            open={scaleTypeOpen}
                            value={preferences.scale_connection_type || "ble"}
                            items={scaleTypeItems}
                            setOpen={setScaleTypeOpen}
                            setValue={(callback) => {
                                const value = typeof callback === 'function' ? callback(preferences.scale_connection_type) : callback;
                                handleToggle("scale_connection_type", value);
                            }}
                            setItems={setScaleTypeItems}
                            placeholder="Select connection type"
                            style={{
                                marginTop: 8,
                                borderColor: '#2563eb',
                                borderWidth: 2,
                                borderRadius: 8,
                                backgroundColor: '#f8fafc'
                            }}
                            dropDownContainerStyle={{
                                borderColor: '#2563eb',
                                borderWidth: 2,
                                borderRadius: 8,
                                backgroundColor: '#ffffff'
                            }}
                            zIndex={1000}
                            zIndexInverse={3000}
                        />
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                            Current: {preferences.scale_connection_type === "ble" ? "Bluetooth Low Energy" : "Classic Bluetooth"}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Support</Text>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.listRow}
                        onPress={() => Alert.alert("Support", "Call support at +254 700 000 000.")}
                    >
                        <Icon name="support-agent" size={20} color="#64748b" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.listTitle}>Contact Support</Text>
                            <Text style={styles.listSubtitle}>Reach out for help with your account or devices.</Text>
                        </View>
                        <Icon name="chevron-right" size={20} color="#cbd5f5" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.listRow}
                        onPress={() => Alert.alert("About", "eDairy App v1.0. Powering dairy digitization.")}
                    >
                        <Icon name="info" size={20} color="#64748b" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.listTitle}>About eDairy</Text>
                            <Text style={styles.listSubtitle}>Learn more about this application.</Text>
                        </View>
                        <Icon name="chevron-right" size={20} color="#cbd5f5" />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={[styles.signOutButton, saving && { opacity: 0.6 }]}
                onPress={handleSignOut}
                disabled={saving}
            >
                <Icon name="logout" size={20} color="#fff" />
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

export default SettingsScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f1f5f9" },
    contentContainer: { padding: 16, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
    loadingText: { marginTop: 12, color: "#475569", fontSize: 14 },
    headerCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        elevation: 1,
        gap: 6,
    },
    headerTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
    headerSubtitle: { color: "#475569", fontSize: 13 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        elevation: 1,
        gap: 12,
    },
    accountRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    accountName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
    accountEmail: { fontSize: 13, color: "#64748b", marginTop: 2 },
    outlineButton: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#94a3b8",
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    outlineButtonText: { color: "#1e293b", fontWeight: "600" },
    listRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    listTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
    listSubtitle: { fontSize: 12, color: "#64748b" },
    preferenceRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    signOutButton: {
        marginTop: 20,
        backgroundColor: "#dc2626",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 10,
    },
    signOutText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

