// src/AuthContext.tsx
import React, {
    createContext,
    useState,
    useEffect,
    useRef,
    ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import jwtDecode from "jwt-decode";
import { NavigationContainerRef } from "@react-navigation/native";
import { hasOfflineCredentials } from "./services/offlineDatabase";
import {
    loadUserProfileFromAsyncStorage,
    saveUserProfileToAsyncStorage,
} from "./utils/userProfileStorage";

interface AuthContextType {
    userToken: string | null;
    login: (token: string, options?: { offlineSession?: boolean }) => Promise<void>;
    logout: (options?: { navigate?: boolean }) => Promise<void>;
    loading: boolean;
    handleConnectivityTransition: (online: boolean) => Promise<void>;
    setNavigationRef: (ref: React.RefObject<NavigationContainerRef<any>>) => void;
}

interface DecodedToken {
    exp: number; // JWT expiration timestamp (in seconds)
    [key: string]: any;
}

export const AuthContext = createContext<AuthContextType>({
    userToken: null,
    login: async () => { },
    logout: async () => { },
    loading: true,
    handleConnectivityTransition: async () => { },
    setNavigationRef: () => { },
});

const OFFLINE_SESSION_KEY = "@edairyApp:offline_session";

async function isDeviceOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
}

function isTokenExpired(token: string): boolean {
    try {
        const decoded = jwtDecode<DecodedToken>(token);
        return decoded.exp * 1000 <= Date.now();
    } catch {
        return true;
    }
}

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [userToken, setUserToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);
    const navigationRef = useRef<NavigationContainerRef<any> | null>(null);
    const offlineSessionRef = useRef(false);
    const userTokenRef = useRef<string | null>(null);
    const silentRefreshInFlightRef = useRef(false);

    userTokenRef.current = userToken;

    const setNavigationRef = (ref: React.RefObject<NavigationContainerRef<any>>) => {
        navigationRef.current = ref.current;
    };

    const clearExpiryTimer = () => {
        if (expiryTimerRef.current) {
            clearTimeout(expiryTimerRef.current);
            expiryTimerRef.current = null;
        }
    };

    const markOfflineSession = async () => {
        offlineSessionRef.current = true;
        await AsyncStorage.setItem(OFFLINE_SESSION_KEY, "1");
    };

    const logout = async (options?: { navigate?: boolean }) => {
        console.log("AuthContext logout called");
        clearExpiryTimer();

        await AsyncStorage.multiRemove([
            "token",
            "user",
            OFFLINE_SESSION_KEY,
        ]);

        await AsyncStorage.removeItem("@edairyApp:user_phone_number");

        setUserToken(null);
        offlineSessionRef.current = false;

        const shouldNavigate = options?.navigate !== false;
        if (shouldNavigate && navigationRef.current) {
            navigationRef.current.reset({
                index: 0,
                routes: [{ name: "Auth" }],
            });
        }
    };

    const refreshOnlineSessionFromStoredCredentials = async (): Promise<boolean> => {
        if (silentRefreshInFlightRef.current) {
            return false;
        }

        silentRefreshInFlightRef.current = true;
        try {
            const { silentOnlineRefreshFromSQLite } = await import("./services/authSession");
            const refreshedToken = await silentOnlineRefreshFromSQLite(login);

            if (!refreshedToken) {
                return false;
            }

            offlineSessionRef.current = false;
            await AsyncStorage.removeItem(OFFLINE_SESSION_KEY);
            return true;
        } finally {
            silentRefreshInFlightRef.current = false;
        }
    };

    const handleExpiredTokenWhileActive = async () => {
        const online = await isDeviceOnline();

        if (!online) {
            if (await hasOfflineCredentials()) {
                console.log(
                    "[AUTH] JWT expired offline — keeping session for background refresh"
                );
                await markOfflineSession();
            }
            return;
        }

        const refreshed = await refreshOnlineSessionFromStoredCredentials();
        if (refreshed) {
            return;
        }

        if (await hasOfflineCredentials()) {
            console.warn(
                "[AUTH] JWT expired online but refresh failed — keeping offline session without redirect"
            );
            await markOfflineSession();
            return;
        }

        console.log("[AUTH] JWT expired with no stored credentials — logging out");
        await logout();
    };

    const handleConnectivityTransition = async (online: boolean) => {
        if (!userTokenRef.current) {
            return;
        }

        if (!online) {
            console.log("[AUTH] Connection lost — continuing current session");
            return;
        }

        const token = userTokenRef.current;
        const shouldRefresh =
            offlineSessionRef.current || isTokenExpired(token);

        if (!shouldRefresh) {
            return;
        }

        const refreshed = await refreshOnlineSessionFromStoredCredentials();
        if (refreshed) {
            console.log("[AUTH] Silent online login completed — session refreshed");
            return;
        }

        console.warn(
            "[AUTH] Silent online login failed — keeping current session without redirect"
        );
        if (await hasOfflineCredentials()) {
            await markOfflineSession();
        }
    };

    const scheduleTokenExpiry = (token: string) => {
        if (offlineSessionRef.current) {
            console.log("[AUTH] Offline session — skipping JWT expiry logout");
            return;
        }

        try {
            const decoded = jwtDecode<DecodedToken>(token);
            const exp = decoded.exp * 1000;
            const now = Date.now();

            if (exp <= now) {
                void handleExpiredTokenWhileActive();
                return;
            }

            const timeout = exp - now;
            console.log(
                `🔔 Token expires in ${(timeout / 1000 / 60).toFixed(1)} minutes`
            );
            expiryTimerRef.current = setTimeout(() => {
                void handleExpiredTokenWhileActive();
            }, timeout);
        } catch (err) {
            console.warn("⚠️ Invalid token or decode error", err);
            if (!offlineSessionRef.current) {
                void handleExpiredTokenWhileActive();
            }
        }
    };

    const login = async (
        token: string,
        options?: { offlineSession?: boolean }
    ) => {
        const offlineSession = options?.offlineSession === true;
        offlineSessionRef.current = offlineSession;

        await AsyncStorage.setItem("token", token);
        if (offlineSession) {
            await AsyncStorage.setItem(OFFLINE_SESSION_KEY, "1");
        } else {
            await AsyncStorage.removeItem(OFFLINE_SESSION_KEY);
        }

        setUserToken(token);

        const storedUser = await loadUserProfileFromAsyncStorage();
        await saveUserProfileToAsyncStorage(
            storedUser ? { ...storedUser, ...{ token } } : { token },
            token
        );

        if (offlineSession) {
            clearExpiryTimer();
            console.log("[AUTH] Offline login session started");
            return;
        }

        scheduleTokenExpiry(token);
    };

    useEffect(() => {
        const loadToken = async () => {
            try {
                const [token, offlineSessionFlag] = await Promise.all([
                    AsyncStorage.getItem("token"),
                    AsyncStorage.getItem(OFFLINE_SESSION_KEY),
                ]);

                if (token) {
                    offlineSessionRef.current = offlineSessionFlag === "1";
                    setUserToken(token);

                    const storedUser = await loadUserProfileFromAsyncStorage();
                    if (
                        storedUser &&
                        !storedUser.token &&
                        !storedUser.access_token
                    ) {
                        await saveUserProfileToAsyncStorage(storedUser, token);
                        console.log("[AUTH] Restored token on user profile for API requests");
                    }

                    if (offlineSessionRef.current || isTokenExpired(token)) {
                        console.log("[AUTH] Restored session needing online refresh");
                        const online = await isDeviceOnline();
                        if (online) {
                            const refreshed =
                                await refreshOnlineSessionFromStoredCredentials();
                            if (!refreshed && (await hasOfflineCredentials())) {
                                await markOfflineSession();
                            }
                        } else if (isTokenExpired(token) && (await hasOfflineCredentials())) {
                            await markOfflineSession();
                        }
                    } else {
                        scheduleTokenExpiry(token);
                    }
                }
            } catch (err) {
                console.error("Error loading token:", err);
            } finally {
                setLoading(false);
            }
        };
        loadToken();

        return () => clearExpiryTimer();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                userToken,
                login,
                logout,
                loading,
                handleConnectivityTransition,
                setNavigationRef,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
