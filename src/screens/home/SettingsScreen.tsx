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
    TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
// @ts-ignore - library lacks TypeScript declarations in current setup
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import DropDownPicker from "react-native-dropdown-picker";
import NetInfo from "@react-native-community/netinfo";
import fetchCommonData, { clearCommonDataCache } from "../../components/utils/fetchCommonData";
import {
    saveMeasuringCan,
    getMeasuringCan,
    initDatabase,
    hasShifts,
    saveShifts,
    hasMeasuringCans,
    saveMeasuringCans,
    saveTransporterStatus
} from "../../services/offlineDatabase";

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

    // Measuring can states (for transporters)
    const [isTransporter, setIsTransporter] = useState(false);
    const [transporterId, setTransporterId] = useState<number | null>(null);
    const [measuringCanOpen, setMeasuringCanOpen] = useState(false);
    const [measuringCanValue, setMeasuringCanValue] = useState<number | null>(null);
    const [measuringCanItems, setMeasuringCanItems] = useState<any[]>([]);
    const [measuringCans, setMeasuringCans] = useState<any[]>([]);
    const [loadingMeasuringCans, setLoadingMeasuringCans] = useState(false);

    // Data sync states
    const [syncingData, setSyncingData] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>("");

    // Server configuration states
    const [serverDomain, setServerDomain] = useState<string>("");
    const [serverConfigSaving, setServerConfigSaving] = useState(false);

    // Data clearing states
    const [clearingData, setClearingData] = useState(false);

    const preferenceStorageKey = "@edairyApp:user_preferences";
    const serverConfigStorageKey = "@edairyApp:server_config";

    const loadSettings = useCallback(async () => {
        try {
            setLoading(true);
            const storedUser = await AsyncStorage.getItem("user");
            let userData = null;
            if (storedUser) {
                userData = JSON.parse(storedUser);
                setUser(userData);

                // Check if user is a transporter
                const userGroups = userData?.user_groups || [];
                const isUserTransporter = userGroups.includes("transporter");
                setIsTransporter(isUserTransporter);

                if (isUserTransporter) {
                    console.log("[Settings] User is a transporter, loading measuring cans...");
                    await loadMeasuringCans(userData);
                }
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

            // Load server configuration
            const storedServerConfig = await AsyncStorage.getItem(serverConfigStorageKey);
            if (storedServerConfig) {
                const serverConfig = JSON.parse(storedServerConfig);
                setServerDomain(serverConfig.domain || "");
            }
        } catch (error) {
            console.error("[Settings] Failed to load settings", error);
            Alert.alert("Error", "Failed to load settings.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Load measuring cans for transporter
    const loadMeasuringCans = useCallback(async (userData: any) => {
        try {
            setLoadingMeasuringCans(true);

            // Get transporter details
            const transporters = await fetchCommonData({ name: "transporters", cachable: false });
            const matchedTransporter = (transporters || []).find((t: any) => t.member_id === userData.member_id);

            if (matchedTransporter) {
                setTransporterId(matchedTransporter.id);
                console.log("[Settings] Matched transporter ID:", matchedTransporter.id);

                // Fetch measuring cans for this transporter
                const measuringCansData = await fetchCommonData({
                    name: "measuring_cans",
                    cachable: false,
                    params: { transporter_id: matchedTransporter.id }
                });

                setMeasuringCans(measuringCansData || []);

                // Create dropdown items
                const canItems = (measuringCansData || []).map((c: any) => ({
                    label: c.can_id || `Can ${c.id}`,
                    value: c.id
                }));
                setMeasuringCanItems(canItems);

                // Load saved measuring can from SQLite
                const savedCan = await getMeasuringCan(userData.member_id);
                if (savedCan) {
                    setMeasuringCanValue(savedCan.id);
                    console.log("[Settings] Loaded saved measuring can:", savedCan.can_id);
                } else if (measuringCansData && measuringCansData.length > 0) {
                    // Auto-select first can if none saved
                    const firstCan = measuringCansData[0];
                    setMeasuringCanValue(firstCan.id);
                    // Save it
                    await saveMeasuringCan({
                        user_id: userData.member_id,
                        measuring_can_id: firstCan.id,
                        measuring_can_name: firstCan.can_id || `Can ${firstCan.id}`,
                        measuring_can_tare_weight: firstCan.tare_weight || 0
                    });
                    console.log("[Settings] Auto-selected and saved first measuring can");
                }
            } else {
                console.log("[Settings] No transporter found for user");
            }
        } catch (error) {
            console.error("[Settings] Error loading measuring cans:", error);
        } finally {
            setLoadingMeasuringCans(false);
        }
    }, []);

    // Check and fetch shifts and measuring cans
    const checkAndFetchOfflineData = useCallback(async () => {
        try {
            setSyncingData(true);
            setSyncStatus("Initializing database...");

            // Initialize database
            await initDatabase();

            // Get user data to check if transporter
            const storedUser = await AsyncStorage.getItem("user");
            let userData = null;
            let isUserTransporter = false;
            let userTransporterId = null;

            if (storedUser) {
                userData = JSON.parse(storedUser);
                const userGroups = userData?.user_groups || [];
                isUserTransporter = userGroups.includes("transporter");

                // If user is transporter, get transporter ID
                if (isUserTransporter && userData?.member_id) {
                    console.log('[SETTINGS] User is a transporter, fetching transporter ID...');
                    try {
                        const transporters = await fetchCommonData({ name: "transporters", cachable: false });
                        const matchedTransporter = (transporters || []).find((t: any) => t.member_id === userData.member_id);
                        if (matchedTransporter) {
                            userTransporterId = matchedTransporter.id;
                            console.log('[SETTINGS] ✅ Found transporter ID:', userTransporterId);
                        }
                    } catch (error) {
                        console.error('[SETTINGS] Error fetching transporter ID:', error);
                    }
                }

                // Save transporter status to SQLite
                setSyncStatus("Saving user profile...");
                await saveTransporterStatus({
                    user_id: userData.member_id,
                    is_transporter: isUserTransporter,
                    transporter_id: userTransporterId
                });
                console.log('[SETTINGS] ✅ Transporter status saved:', isUserTransporter);
            }

            // Check if online
            const state = await NetInfo.fetch();
            const online = state.isConnected === true && state.isInternetReachable !== false;

            if (!online) {
                console.log('[SETTINGS] Offline, cannot fetch data');
                setSyncStatus("Offline - data sync skipped");
                setTimeout(() => setSyncStatus(""), 3000);
                return;
            }

            let syncedItems = 0;

            // Check and fetch shifts
            const shiftsExist = await hasShifts();
            if (!shiftsExist) {
                setSyncStatus("Fetching shifts...");
                console.log('[SETTINGS] Fetching shifts from API...');
                const shifts = await fetchCommonData({ name: "shifts", cachable: false });
                if (shifts && shifts.length > 0) {
                    await saveShifts(shifts);
                    syncedItems++;
                    console.log('[SETTINGS] ✅ Shifts fetched and saved:', shifts.length);
                }
            } else {
                console.log('[SETTINGS] Shifts already exist in database');
            }

            // Check and fetch measuring cans (only for transporters)
            if (isUserTransporter) {
                const measuringCansExist = await hasMeasuringCans();
                if (!measuringCansExist) {
                    setSyncStatus("Fetching measuring cans...");
                    console.log('[SETTINGS] Fetching measuring cans from API...');
                    const measuringCans = await fetchCommonData({ name: "measuring_cans", cachable: false });
                    if (measuringCans && measuringCans.length > 0) {
                        await saveMeasuringCans(measuringCans);
                        syncedItems++;
                        console.log('[SETTINGS] ✅ Measuring cans fetched and saved:', measuringCans.length);
                    }
                } else {
                    console.log('[SETTINGS] Measuring cans already exist in database');
                }
            } else {
                console.log('[SETTINGS] User is not a transporter, skipping measuring cans fetch');
            }

            if (syncedItems > 0) {
                setSyncStatus(`✓ Synced ${syncedItems} data types`);
                Alert.alert(
                    "Data Sync Complete",
                    "Offline data has been successfully synchronized. You can now use offline collection.",
                    [{ text: "OK" }]
                );
            } else {
                setSyncStatus("All data up to date");
            }

            setTimeout(() => setSyncStatus(""), 5000);
        } catch (error) {
            console.error('[SETTINGS] Error fetching offline data:', error);
            setSyncStatus("Sync failed - try again later");
            setTimeout(() => setSyncStatus(""), 5000);
        } finally {
            setSyncingData(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
        // Check and fetch offline data on mount
        checkAndFetchOfflineData();
    }, [loadSettings, checkAndFetchOfflineData]);

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

    const handleMeasuringCanChange = async (canId: number) => {
        try {
            setSaving(true);
            const selectedCan = measuringCans.find((c: any) => c.id === canId);
            if (selectedCan && user) {
                await saveMeasuringCan({
                    user_id: user.member_id,
                    measuring_can_id: selectedCan.id,
                    measuring_can_name: selectedCan.can_id || `Can ${selectedCan.id}`,
                    measuring_can_tare_weight: selectedCan.tare_weight || 0
                });
                setMeasuringCanValue(canId);
                console.log("[Settings] Saved measuring can:", selectedCan.can_id);
                Alert.alert("Success", "Measuring can saved for offline collections.");
            }
        } catch (error) {
            console.error("[Settings] Error saving measuring can:", error);
            Alert.alert("Error", "Failed to save measuring can.");
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        try {
            // Clear session data but preserve offline credentials
            await AsyncStorage.multiRemove([
                "user",
                "token",
                "@edairyApp:user_phone_number"
            ]);

            Alert.alert("Signed Out", "You have been signed out. Your offline login credentials are preserved.");
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

    const handleSaveServerConfig = async () => {
        if (!serverDomain.trim()) {
            Alert.alert("Error", "Please enter a valid domain or IP address.");
            return;
        }

        try {
            setServerConfigSaving(true);

            // Validate the domain format (basic validation)
            let domainToSave = serverDomain.trim();
            if (!domainToSave.startsWith('http://') && !domainToSave.startsWith('https://')) {
                domainToSave = `http://${domainToSave}`;
            }

            // Remove trailing slash if present
            domainToSave = domainToSave.replace(/\/$/, '');

            // Basic URL validation
            try {
                new URL(domainToSave);
            } catch {
                Alert.alert("Error", "Please enter a valid domain or IP address (e.g., example.com or 192.168.1.100).");
                return;
            }

            const serverConfig = { domain: domainToSave };
            await AsyncStorage.setItem(serverConfigStorageKey, JSON.stringify(serverConfig));

            Alert.alert(
                "Server Configuration Saved",
                `Server URL updated to: ${domainToSave}\n\nYou may need to restart the app for changes to take effect.`,
                [{ text: "OK" }]
            );
        } catch (error) {
            console.error("[Settings] Error saving server config:", error);
            Alert.alert("Error", "Failed to save server configuration.");
        } finally {
            setServerConfigSaving(false);
        }
    };

    const handleClearData = async () => {
        Alert.alert(
            "Clear Cached Data",
            "This will clear all cached data (routes, centers, etc.) from your device. Fresh data will be downloaded next time you access these features.\n\nThis action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear Data",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setClearingData(true);
                            await clearCommonDataCache();
                            Alert.alert(
                                "Data Cleared",
                                "All cached data has been successfully cleared. The app will download fresh data as needed.",
                                [{ text: "OK" }]
                            );
                        } catch (error) {
                            console.error("[Settings] Error clearing data:", error);
                            Alert.alert("Error", "Failed to clear cached data. Please try again.");
                        } finally {
                            setClearingData(false);
                        }
                    }
                }
            ]
        );
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
                <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                    {user?.member_details?.full_name ||
                        `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
                        user?.username ||
                        "Settings"}
                </Text>
                <Text style={styles.headerSubtitle}>
                    Manage your profile, preferences, and app experience.
                </Text>
                <Text style={styles.headerSlogan}>
                    Where milk farming gives you wings
                </Text>
            </View>

            {/* Sync Status Banner */}
            {(syncingData || syncStatus) && (
                <View style={[
                    styles.syncBanner,
                    syncStatus.includes('✓') && { backgroundColor: '#DEF7EC', borderColor: '#16a34a' },
                    syncStatus.includes('failed') && { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }
                ]}>
                    {syncingData && <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />}
                    <Icon 
                        name={syncStatus.includes('✓') ? "check-circle" : syncStatus.includes('failed') ? "error" : "sync"} 
                        size={20} 
                        color={syncStatus.includes('✓') ? "#16a34a" : syncStatus.includes('failed') ? "#EF4444" : "#2563eb"} 
                    />
                    <Text style={[
                        styles.syncText,
                        syncStatus.includes('✓') && { color: '#166534' },
                        syncStatus.includes('failed') && { color: '#991B1B' }
                    ]}>
                        {syncStatus || "Syncing offline data..."}
                    </Text>
                </View>
            )}

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
                <Text style={styles.sectionTitle}>🌐 Server Configuration</Text>
                <View style={styles.card}>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.listTitle}>Server Domain/IP Address</Text>
                        <Text style={styles.listSubtitle}>
                            Enter your server domain or IP address (without "/api"). This will be used for all API requests.
                        </Text>
                        <TextInput
                            style={styles.serverInput}
                            value={serverDomain}
                            onChangeText={setServerDomain}
                            placeholder="e.g., example.com or 192.168.1.100:8000"
                            placeholderTextColor="#94a3b8"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                        />
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                            Current: {serverDomain || "Using default server"}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.saveServerButton, serverConfigSaving && { opacity: 0.6 }]}
                        onPress={handleSaveServerConfig}
                        disabled={serverConfigSaving}
                    >
                        {serverConfigSaving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Icon name="save" size={18} color="#fff" />
                        )}
                        <Text style={styles.saveServerButtonText}>
                            {serverConfigSaving ? "Saving..." : "Save Server Config"}
                        </Text>
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
                            value={Boolean(preferences.notifications_enabled)}
                            onValueChange={(val) => handleToggle("notifications_enabled", val)}
                        />
                    </View>
                    <View style={styles.preferenceRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>Auto Print Receipts</Text>
                            <Text style={styles.listSubtitle}>Automatically print receipts after recordings.</Text>
                        </View>
                        <Switch
                            value={Boolean(preferences.auto_print_enabled)}
                            onValueChange={(val) => handleToggle("auto_print_enabled", val)}
                        />
                    </View>
                    <View style={styles.preferenceRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>Use Biometrics</Text>
                            <Text style={styles.listSubtitle}>Enable biometric authentication at login.</Text>
                        </View>
                        <Switch
                            value={Boolean(preferences.biometrics_enabled)}
                            onValueChange={(val) => handleToggle("biometrics_enabled", val)}
                        />
                    </View>
                    <View style={styles.preferenceRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>Dark Mode</Text>
                            <Text style={styles.listSubtitle}>Reduce eye strain by enabling dark theme.</Text>
                        </View>
                        <Switch
                            value={Boolean(preferences.dark_mode_enabled)}
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
                    {/* Measuring Can Selector - Only for transporters */}
                    {isTransporter && (
                        <View style={{ marginVertical: 8 }}>
                            <Text style={styles.listTitle}>⚖️ Default Measuring Can</Text>
                            <Text style={styles.listSubtitle}>
                                Select the measuring can to use for offline collections. This provides the tare weight automatically.
                            </Text>
                            {loadingMeasuringCans ? (
                                <View style={{ padding: 16, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color="#16a34a" />
                                    <Text style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
                                        Loading measuring cans...
                                    </Text>
                                </View>
                            ) : measuringCanItems.length > 0 ? (
                                <>
                                    <DropDownPicker
                                        listMode="SCROLLVIEW"
                                        open={measuringCanOpen}
                                        value={measuringCanValue}
                                        items={measuringCanItems}
                                        setOpen={setMeasuringCanOpen}
                                        setValue={(callback) => {
                                            const value = typeof callback === 'function' ? callback(measuringCanValue) : callback;
                                            if (value !== measuringCanValue) {
                                                handleMeasuringCanChange(value);
                                            }
                                        }}
                                        setItems={setMeasuringCanItems}
                                        placeholder="Select measuring can"
                                        style={{
                                            marginTop: 8,
                                            borderColor: '#16a34a',
                                            borderWidth: 2,
                                            borderRadius: 8,
                                            backgroundColor: '#f8fafc'
                                        }}
                                        dropDownContainerStyle={{
                                            borderColor: '#16a34a',
                                            borderWidth: 2,
                                            borderRadius: 8,
                                            backgroundColor: '#ffffff'
                                        }}
                                        zIndex={900}
                                        zIndexInverse={3100}
                                    />
                                    {measuringCanValue && (
                                        <View style={{ 
                                            marginTop: 8, 
                                            padding: 8, 
                                            backgroundColor: '#DEF7EC', 
                                            borderRadius: 6 
                                        }}>
                                            <Text style={{ fontSize: 11, color: '#166534', fontWeight: '600' }}>
                                                ✓ Tare Weight: {measuringCans.find((c: any) => c.id === measuringCanValue)?.tare_weight || 0} KG
                                            </Text>
                                            <Text style={{ fontSize: 10, color: '#166534', marginTop: 2 }}>
                                                This will be used automatically in offline collections
                                            </Text>
                                        </View>
                                    )}
                                </>
                            ) : (
                                <View style={{ 
                                    marginTop: 8, 
                                    padding: 12, 
                                    backgroundColor: '#FEF3C7', 
                                    borderRadius: 6 
                                }}>
                                    <Text style={{ fontSize: 12, color: '#92400E' }}>
                                        No measuring cans found. Please contact your administrator.
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
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
                    <TouchableOpacity
                        style={[styles.listRow, clearingData && { opacity: 0.6 }]}
                        onPress={handleClearData}
                        disabled={clearingData}
                    >
                        {clearingData ? (
                            <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                            <Icon name="delete-sweep" size={20} color="#dc2626" />
                        )}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.listTitle, { color: '#dc2626' }]}>Clear Cached Data</Text>
                            <Text style={styles.listSubtitle}>Remove all cached data to ensure fresh information.</Text>
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
    syncBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EBF5FF",
        borderWidth: 1,
        borderColor: "#2563eb",
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        gap: 8,
    },
    syncText: {
        flex: 1,
        fontSize: 13,
        fontWeight: "600",
        color: "#1E40AF",
    },
    headerTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
    headerSubtitle: { color: "#475569", fontSize: 13 },
    headerSlogan: { color: "#26A69A", fontSize: 12, fontStyle: "italic", marginTop: 2 },
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
    serverInput: {
        borderWidth: 2,
        borderColor: '#2563eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#f8fafc',
        marginTop: 8,
        color: '#0f172a',
    },
    saveServerButton: {
        backgroundColor: "#2563eb",
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
    },
    saveServerButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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

