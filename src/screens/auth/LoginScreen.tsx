// src/screens/LoginScreen.tsx
import React, { useState, useContext, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Icon from "react-native-vector-icons/MaterialIcons";
import { globalStyles } from "../../styles";
import makeRequest from "../../components/utils/makeRequest";
import { AuthContext } from "../../AuthContext";
import { useSync } from "../../context/SyncContext";
import { initDatabase, hasShifts, hasMeasuringCans, saveOfflineCredentials, validateOfflineCredentials, hasOfflineCredentials as hasSQLiteOfflineCredentials } from "../../services/offlineDatabase";
import { isSyncPendingAfterLogin, clearSyncPendingAfterLogin } from "../../services/offlineSync";

export default function LoginScreen({ navigation }: any) {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const { login } = useContext(AuthContext);
    const { triggerSync } = useSync();

    // Monitor network connectivity
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const online = state.isConnected === true && state.isInternetReachable !== false;
            console.log('Network state changed:', { isConnected: state.isConnected, isInternetReachable: state.isInternetReachable, calculatedOnline: online });
            setIsOnline(online);

            // If we come back online and were in offline mode, require fresh login
            if (online && isOfflineMode) {
                console.log('Internet restored, disabling offline mode');
                setIsOfflineMode(false);
                Alert.alert(
                    'Internet Restored',
                    'Please login again with your internet connection for security.',
                    [{ text: 'OK' }]
                );
            }
        });

        // Check initial state
        NetInfo.fetch().then(state => {
            const online = state.isConnected === true && state.isInternetReachable !== false;
            console.log('Initial network state:', { isConnected: state.isConnected, isInternetReachable: state.isInternetReachable, calculatedOnline: online });
            setIsOnline(online);
        });

        return () => unsubscribe();
    }, [isOfflineMode]);

    // Check if we should be in offline mode (only when offline)
    useEffect(() => {
        const checkOfflineMode = async () => {
            console.log('Checking offline mode - isOnline:', isOnline);
            if (!isOnline) {
                const hasCredentials = await hasSQLiteOfflineCredentials();
                console.log('Offline mode check - hasCredentials:', hasCredentials);

                if (!hasCredentials) {
                    // Debug: Check database state if no credentials found
                    console.log('No credentials found, debugging database...');
                    const { debugDatabaseState } = await import("../../services/offlineDatabase");
                    await debugDatabaseState();
                }

                if (hasCredentials) {
                    console.log('Enabling offline mode');
                    setIsOfflineMode(true);
                } else {
                    console.log('Disabling offline mode - no credentials');
                    setIsOfflineMode(false); // No credentials, can't do offline login
                }
            } else {
                // Always disable offline mode when online
                console.log('Online mode - disabling offline mode');
                setIsOfflineMode(false);
            }
        };

        checkOfflineMode(); // Check every time isOnline changes
    }, [isOnline]);

    const handleOfflineLogin = async () => {
        setLoading(true);
        try {
            // Validate offline credentials against SQLite
            const validation = await validateOfflineCredentials(phoneNumber, password);

            if (!validation.valid) {
                Alert.alert(
                    "Offline Login Failed",
                    "Invalid phone number or password, or your offline credentials have expired. Please connect to internet for authentication.",
                    [{ text: 'OK' }]
                );
                return;
            }

            // Offline authentication successful
            await login(validation.token!);
            await AsyncStorage.setItem("user", JSON.stringify(validation.userData));
            await AsyncStorage.setItem("@edairyApp:user_phone_number", phoneNumber);

            // Check if sync is pending
            const isSyncPending = isSyncPendingAfterLogin();
            if (isSyncPending) {
                clearSyncPendingAfterLogin();
                setTimeout(() => {
                    triggerSync().then((result) => {
                        Alert.alert('Sync Complete', `Successfully synced ${result.success} collection(s).`);
                    }).catch((error) => {
                        Alert.alert('Sync Error', 'Failed to sync data. You can try again later.');
                    });
                }, 1000);
            }

            // Navigate to dashboard
            navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
            });

        } catch (error) {
            console.error('Offline login error:', error);
            Alert.alert("Error", "Offline login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!phoneNumber || !password) {
            Alert.alert("Error", "Please enter both phone number and password.");
            return;
        }

        console.log('Login attempt - isOnline:', isOnline, 'isOfflineMode:', isOfflineMode);

        // Determine authentication method based on connectivity
        if (!isOnline) {
            console.log('Offline login attempt');
            // Offline: Check if offline credentials exist
            const hasCredentials = await hasSQLiteOfflineCredentials();
            console.log('Has offline credentials:', hasCredentials);
            if (hasCredentials) {
                await handleOfflineLogin();
            } else {
                Alert.alert(
                    "Offline Login Unavailable",
                    "No offline credentials found. Please connect to internet for first-time login.",
                    [{ text: 'OK' }]
                );
            }
            return;
        }

        console.log('Online login attempt - using API');
        // Online authentication (always use API when online)
        setLoading(true);
        try {
            const endpoint = "member-token";
            const data = { phone_number: phoneNumber, password };
            const [status, response] = await makeRequest({
                url: endpoint,
                method: "POST",
                data,
            });
            if ([200, 201].includes(status) && response?.access_token) {
                const token = response.access_token;

                await login(token);
                await AsyncStorage.setItem("user", JSON.stringify(response));

                // CRITICAL: Always save/update credentials in SQLite after successful API login
                // This ensures offline access is available and credentials stay current
                console.log('Saving offline credentials after successful API login...');

                // Save credentials asynchronously - don't block login success
                setTimeout(async () => {
                    try {
                        await initDatabase(); // Ensure database is ready

                        const offlineCredentials = {
                            phone_number: phoneNumber,
                            password: password,
                            token: token,
                            user_data: response,
                            stored_at: new Date().toISOString()
                        };

                        await saveOfflineCredentials(offlineCredentials);
                        console.log('✅ Offline credentials saved successfully');

                        // Debug: Check database state
                        const { debugDatabaseState } = await import("../../services/offlineDatabase");
                        await debugDatabaseState();

                    } catch (dbError) {
                        console.error('❌ Failed to save offline credentials:', dbError);
                        // Show user-friendly warning
                        Alert.alert(
                            'Offline Access Warning',
                            'Login successful, but offline access could not be set up. You may need to login again when offline.',
                            [{ text: 'Continue' }]
                        );
                    }
                }, 100); // Small delay to ensure login completes first

                // Store phone number for offline sync
                await AsyncStorage.setItem("@edairyApp:user_phone_number", phoneNumber);

                // Check if this is first login (no shifts/measuring cans in database)
                await initDatabase();
                const shiftsExist = await hasShifts();
                const measuringCansExist = await hasMeasuringCans();
                const isFirstLogin = !shiftsExist || !measuringCansExist;

                // Check if sync is pending from network restoration
                const isSyncPending = isSyncPendingAfterLogin();

                if (isSyncPending) {
                    // Clear the pending flag
                    clearSyncPendingAfterLogin();

                    // Start sync automatically after login
                    console.log('[LOGIN] Sync pending after login, starting sync...');
                    setTimeout(() => {
                        triggerSync().then((result) => {
                            const successMessage = result.failed === 0
                                ? `Successfully synced ${result.success} collection(s).`
                                : `Synced ${result.success} collection(s), ${result.failed} failed.`;
                            Alert.alert('Sync Complete', successMessage);
                        }).catch((error) => {
                            console.error('[LOGIN] Auto sync failed:', error);
                            Alert.alert('Sync Error', 'Failed to sync data. You can try again from the sync button.');
                        });
                    }, 1000); // Small delay to ensure navigation completes
                }

                if (isFirstLogin) {
                    // First login - redirect to Settings to fetch data
                    console.log('[LOGIN] First login detected, redirecting to Settings');
                    navigation.reset({
                        index: 0,
                        routes: [
                            { name: "Home" },
                            { name: "Home", params: { screen: "Settings" } }
                        ],
                    });
                } else {
                    // Regular login - go to Home
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "Home" }],
                    });
                }
            } else {
                Alert.alert("Login Failed", response?.message || "Invalid phone number or password.");
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert("Login Failed", error?.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "flex-end",
                    padding: 20,
                    backgroundColor: "rgba(0,0,0,0)", // explicitly transparent
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text style={[globalStyles.title, { color: "#fff", marginBottom: 24 }]}>
                    {isOfflineMode &&
                        <View style={styles.offlineLinkContent}>
                            <Icon
                                name="cloud-off"
                                size={30}
                                color="#ffffff"
                                marginRight={8}
                            />

                        </View>}
                    {isOnline ? "Sign In" : isOfflineMode ? "Offline Login" : "Login Required"}
                </Text>

                {/* Always show login form */}
                <>
                    <Text style={[globalStyles.label, { color: "#fff" }]}>Phone Number</Text>
                    <TextInput
                        placeholder="254792924299"
                        placeholderTextColor="#d1d5db"
                        style={globalStyles.input}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        autoCapitalize="none"
                        keyboardType="phone-pad"
                    />

                    <Text style={[globalStyles.label, { color: "#fff" }]}>Password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            placeholder="Enter your password"
                            placeholderTextColor="#d1d5db"
                            secureTextEntry={!showPassword}
                            style={[globalStyles.input, styles.passwordInput]}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                            activeOpacity={0.7}
                        >
                            <Icon
                                name={showPassword ? "visibility" : "visibility-off"}
                                size={24}
                                color="#6b7280"
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[globalStyles.button, loading && { opacity: 0.6 }]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={globalStyles.buttonText}>
                                {isOfflineMode ? "Login Offline" : "Sign In"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </>

                {/* Offline status message */}
                {!isOnline && (
                    <View style={{ alignItems: "center", marginTop: 20 }}>
                        <Text style={[globalStyles.label, { color: "#fff", textAlign: "center" }]}>
                            {isOfflineMode
                                ? "."
                                : "Internet connection required for login."
                            }
                        </Text>
                    </View>
                )}

                {/* Offline Mode Indicator */}
                {isOfflineMode && (
                    <View style={styles.offlineIndicator}>
                        <Icon name="wifi-off" size={20} color="#F59E0B" />
                        <Text style={styles.offlineIndicatorText}>
                            Offline Mode
                        </Text>
                    </View>
                )}

                {/* Offline Collection Link - Only show when offline and has credentials */}

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    passwordContainer: {
        position: "relative",
        marginBottom: 16,
    },
    passwordInput: {
        paddingRight: 50, // Make room for the eye icon
    },
    eyeIcon: {
        position: "absolute",
        right: 16,
        top: 12,
        padding: 4,
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    offlineIndicatorText: {
        color: '#F59E0B',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    offlineMessage: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    offlineMessageText: {
        color: "#FFF",
        fontSize: 18,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 20,
        marginBottom: 8,
    },
    offlineMessageSubtext: {
        color: "rgba(255, 255, 255, 0.7)",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },
    offlineLoginButton: {
        marginTop: 16,
        backgroundColor: "#F59E0B",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: "center",
    },
    offlineLoginButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    offlineLink: {
        marginTop: 20,
        padding: 16,
        backgroundColor: "rgba(245, 158, 11, 0.2)",
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#F59E0B",
    },
    offlineLinkContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    offlineLinkTextActive: {
        color: "#FFF",
        fontSize: 15,
        fontWeight: "600",
    },
    offlineBadge: {
        marginTop: 8,
        alignSelf: "center",
        backgroundColor: "#F59E0B",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    offlineBadgeText: {
        color: "#FFF",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
});

