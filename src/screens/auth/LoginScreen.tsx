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
import {
    normalizeEmail,
    isValidEmail,
    buildEmailLoginPayload,
    getPrimaryPhoneForStorage,
    extractAuthToken,
    extractLoginErrorMessage,
} from "../../utils/loginCredentials";

const isDeviceOnline = async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
};

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
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

    const performRemoteLogin = async (loginEmail: string): Promise<boolean> => {
        const data = buildEmailLoginPayload(loginEmail, password);

        let status = 0;
        let response: any = null;

        try {
            [status, response] = await makeRequest({
                url: "login",
                method: "POST",
                data: data as any,
                skipAuth: true,
            });
        } catch (error: any) {
            Alert.alert("Login Error", error?.message || "Something went wrong");
            return false;
        }

        const token = extractAuthToken(response);
        const loginSucceeded = [200, 201].includes(status) && !!token;

        if (!loginSucceeded) {
            Alert.alert("Login Failed", extractLoginErrorMessage(response, status));
            return false;
        }

        const normalizedEmail = normalizeEmail(loginEmail);
        const userPayload = {
            ...response,
            token,
            access_token: token,
        };

        await login(token);
        await AsyncStorage.setItem("user", JSON.stringify(userPayload));

        console.log('Saving offline credentials after successful API login...');
        setTimeout(async () => {
            try {
                await initDatabase();

                const offlineCredentials = {
                    email: normalizedEmail,
                    password: password,
                    token: token,
                    user_data: userPayload,
                    stored_at: new Date().toISOString()
                };

                await saveOfflineCredentials(offlineCredentials);
                console.log('✅ Offline credentials saved successfully');

                const { debugDatabaseState } = await import("../../services/offlineDatabase");
                await debugDatabaseState();
            } catch (dbError) {
                console.error('❌ Failed to save offline credentials:', dbError);
                Alert.alert(
                    'Offline Access Warning',
                    'Login successful, but offline access could not be set up. You may need to login again when offline.',
                    [{ text: 'Continue' }]
                );
            }
        }, 100);

        await AsyncStorage.setItem(
            "@edairyApp:user_phone_number",
            getPrimaryPhoneForStorage(userPayload)
        );

        await initDatabase();
        const shiftsExist = await hasShifts();
        const measuringCansExist = await hasMeasuringCans();
        const isFirstLogin = !shiftsExist || !measuringCansExist;

        const isSyncPending = isSyncPendingAfterLogin();
        if (isSyncPending) {
            clearSyncPendingAfterLogin();
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
            }, 1000);
        }

        if (isFirstLogin) {
            console.log('[LOGIN] First login detected, redirecting to Settings');
            navigation.reset({
                index: 0,
                routes: [
                    { name: "Home" },
                    { name: "Home", params: { screen: "Settings" } }
                ],
            });
        } else {
            navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
            });
        }

        return true;
    };

    const handleOfflineLogin = async () => {
        if (!isValidEmail(email)) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }

        if (!password) {
            Alert.alert("Error", "Please enter your password.");
            return;
        }

        setLoading(true);
        try {
            const validation = await validateOfflineCredentials(email, password);

            if (!validation.valid) {
                const online = await isDeviceOnline();
                if (online) {
                    console.log('[LOGIN] Offline validation failed but device is online - trying remote login');
                    setIsOfflineMode(false);
                    await performRemoteLogin(email);
                    return;
                }

                Alert.alert(
                    "Offline Login Failed",
                    "Invalid email or password, or your offline credentials have expired. Please connect to internet for authentication.",
                    [{ text: 'OK' }]
                );
                return;
            }

            await login(validation.token!);
            await AsyncStorage.setItem("user", JSON.stringify(validation.userData));
            await AsyncStorage.setItem(
                "@edairyApp:user_phone_number",
                getPrimaryPhoneForStorage(validation.userData)
            );

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

            // Navigate to offline milk collection after offline login
            navigation.reset({
                index: 0,
                routes: [
                    {
                        name: "Home",
                        params: {
                            screen: "Members",
                            params: { screen: "OfflineMilkCollection" },
                        },
                    },
                ],
            });

        } catch (error) {
            console.error('Offline login error:', error);
            Alert.alert("Error", "Offline login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!isValidEmail(email)) {
            Alert.alert("Error", "Please enter a valid email address.");
            return;
        }

        if (!password) {
            Alert.alert("Error", "Please enter your password.");
            return;
        }

        console.log('Login attempt - isOnline:', isOnline, 'isOfflineMode:', isOfflineMode);

        const deviceOnline = await isDeviceOnline();

        if (!deviceOnline) {
            console.log('Offline login attempt');
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
        setLoading(true);
        try {
            await performRemoteLogin(email);
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
                    <Text style={[globalStyles.label, { color: "#fff" }]}>Email</Text>
                    <TextInput
                        placeholder="name@example.com"
                        placeholderTextColor="#d1d5db"
                        style={globalStyles.input}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
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

