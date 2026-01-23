import { Alert } from "react-native";
import { getItem } from "./local-storage";
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Network alert state management
let hasShownNetworkAlert = false;

// Default fallback URL
const DEFAULT_BASE_URL = "https://dev.edairy.africa";

// Get dynamic server URL
const getServerUrl = async (): Promise<string> => {
    try {
        const serverConfig = await AsyncStorage.getItem('@edairyApp:server_config');
        if (serverConfig) {
            const config = JSON.parse(serverConfig);
            if (config.domain && config.domain.trim()) {
                // Ensure the domain has a protocol
                let domain = config.domain.trim();
                if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
                    domain = `http://${domain}`;
                }
                // Remove trailing slash if present
                domain = domain.replace(/\/$/, '');
                return `${domain}/api`;
            }
        }
    } catch (error) {
        console.warn('Failed to load server config, using default:', error);
    }
    return `${DEFAULT_BASE_URL}/api/`;
};

const makeRequest = async ({
    url,
    method,
    data = null,
    use_jwt = false,
    responseType = "json",
    isFormData = false,
}) => {
    // Check internet connectivity before making request
    const netInfo = await NetInfo.fetch();
    const isCurrentlyConnected = netInfo.isConnected && netInfo.isInternetReachable;

    if (!isCurrentlyConnected) {
        // Only show alert once when connection is lost
        if (!hasShownNetworkAlert) {
            hasShownNetworkAlert = true;
            Alert.alert(
                "No Internet Connection",
                "Please check your internet connection and try again.",
                [
                    { text: "OK", style: "default" },
                    {
                        text: "Retry",
                        onPress: () => {
                            // Retry the request after user confirms
                            setTimeout(() => {
                                makeRequest({ url, method, data, use_jwt, responseType, isFormData });
                            }, 10000);
                        },
                    },
                ]
            );
        }
        return [503, { message: "No internet connection" }];
    } else {
        // Reset alert flag when connection is restored
        hasShownNetworkAlert = false;
    }

    // Get dynamic server URL
    const baseUrl = await getServerUrl();
    url = baseUrl + url;
    let headers: any = {
        accept: "application/json",
    };

    if (!isFormData) {
        headers["content-type"] = "application/json";
    }

    const user = await getItem("user");
    const token = user?.access_token;
    // Alert.alert(token);
    // if (use_jwt && token) {
    headers.Authorization = `Bearer ${token}`;
    // }

    try {
        const request: any = {
            method,
            headers,
        };

        if (data) {
            request.body = isFormData ? data : JSON.stringify(data);
        }

        const response = await fetch(url, request);
        let result;
        try {
            result =
                responseType === "text"
                    ? await response.text()
                    : await response.json();
        } catch {
            result = {};
        }

        return [response.status, result];
    } catch (err: any) {

        console.error("Fetch error:", err);

        // Check if it's a network error
        const isNetworkError = err.message?.includes('Network request failed') ||
            err.message?.includes('fetch') ||
            err.code === 'NETWORK_ERROR';

        if (isNetworkError) {
            Alert.alert(
                "Network Error",
                "Unable to connect to the server. Please check your internet connection.",
                [
                    { text: "OK", style: "default" },
                    {
                        text: "Retry",
                        onPress: () => {
                            setTimeout(() => {
                                makeRequest({ url, method, data, use_jwt, responseType, isFormData });
                            }, 1000);
                        },
                    },
                ]
            );
        } else {
            Alert.alert("Error", "An unexpected error occurred. Please try again.");
        }

        return [500, { message: "Network error" }];
    }
};

export default makeRequest;

/**
 * Fetches user profile data from the API
 * @returns Promise with profile data or null if error
 */
export const fetchUserProfile = async () => {
    try {
        const [status, response] = await makeRequest({
            url: 'user-profile',
            method: 'GET',
        });

        if ([200, 201].includes(status)) {
            return response?.data || response || null;
        } else {
            console.error('Failed to fetch profile:', response?.message || 'Unknown error');
            return null;
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
};
