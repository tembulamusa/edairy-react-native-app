// src/AuthContext.tsx
import React, {
    createContext,
    useState,
    useEffect,
    useRef,
    ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import jwtDecode from "jwt-decode";
import { NavigationContainerRef } from "@react-navigation/native";

interface AuthContextType {
    userToken: string | null;
    login: (token: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
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
    setNavigationRef: () => { },
});

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [userToken, setUserToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);
    const navigationRef = useRef<NavigationContainerRef<any> | null>(null);

    const setNavigationRef = (ref: React.RefObject<NavigationContainerRef<any>>) => {
        navigationRef.current = ref.current;
    };

    const clearExpiryTimer = () => {
        if (expiryTimerRef.current) {
            clearTimeout(expiryTimerRef.current);
            expiryTimerRef.current = null;
        }
    };

    const logout = async () => {
        clearExpiryTimer();
        await AsyncStorage.removeItem("token");
        setUserToken(null);

        // 🔥 Automatically navigate to login
        if (navigationRef.current) {
            navigationRef.current.reset({
                index: 0,
                routes: [{ name: "Auth" }],
            });
        }
    };

    const scheduleTokenExpiry = (token: string) => {
        try {
            const decoded = jwtDecode<DecodedToken>(token);
            const exp = decoded.exp * 1000;
            const now = Date.now();

            if (exp > now) {
                const timeout = exp - now;
                console.log(
                    `🔔 Token expires in ${(timeout / 1000 / 60).toFixed(1)} minutes`
                );
                expiryTimerRef.current = setTimeout(() => {
                    console.log("🔒 Token expired — logging out automatically");
                    logout();
                }, timeout);
            } else {
                logout();
            }
        } catch (err) {
            console.warn("⚠️ Invalid token or decode error", err);
            logout();
        }
    };

    const login = async (token: string) => {
        await AsyncStorage.setItem("token", token);
        setUserToken(token);
        scheduleTokenExpiry(token);
    };

    useEffect(() => {
        const loadToken = async () => {
            try {
                const token = await AsyncStorage.getItem("token");
                if (token) {
                    setUserToken(token);
                    scheduleTokenExpiry(token);
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
            value={{ userToken, login, logout, loading, setNavigationRef }}
        >
            {children}
        </AuthContext.Provider>
    );
};
