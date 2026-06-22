import { Alert } from "react-native";
import { getItem } from "./local-storage";
import NetInfo from '@react-native-community/netinfo';

let hasShownNetworkAlert = false;
let networkAlertCount = 0;

const DEFAULT_BASE_URL = "https://api.arithi.edairy.africa";

const getServerUrl = async (): Promise<string> => {
    return `${DEFAULT_BASE_URL}/api/`;
};

type MakeRequestOptions = {
    url: string;
    method: string;
    data?: any;
    use_jwt?: boolean;
    responseType?: string;
    isFormData?: boolean;
    skipAuth?: boolean;
};

const makeRequest = async ({
    url,
    method,
    data = null,
    use_jwt = false,
    responseType = "json",
    isFormData = false,
    skipAuth = false,
}: MakeRequestOptions) => {
    const endpoint = url;
    const netInfo = await NetInfo.fetch();
    const isCurrentlyConnected =
        netInfo.isConnected === true && netInfo.isInternetReachable !== false;

    if (!isCurrentlyConnected) {
        if (!hasShownNetworkAlert) {
            hasShownNetworkAlert = true;
            networkAlertCount++;
            Alert.alert(
                "No Internet Connection",
                "Please check your internet connection and try again.",
                [
                    { text: "OK", style: "default" },
                    {
                        text: "Retry",
                        onPress: () => {
                            setTimeout(() => {
                                makeRequest({ url: endpoint, method, data, use_jwt, responseType, isFormData, skipAuth });
                            }, 10000);
                        },
                    },
                ]
            );
        }
        return [503, { message: "No internet connection" }];
    }

    hasShownNetworkAlert = false;
    networkAlertCount = 0;

    const baseUrl = await getServerUrl();
    const fullUrl = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
        accept: "application/json",
    };

    if (!isFormData) {
        headers["content-type"] = "application/json";
    }

    if (!skipAuth) {
        const user = await getItem("user");
        const token = user?.access_token || user?.token;
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }

    try {
        const request: RequestInit = {
            method,
            headers,
        };

        if (data) {
            request.body = isFormData ? data : JSON.stringify(data);
        }

        const response = await fetch(fullUrl, request);
        let result: any;

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

        const isNetworkError = err.message?.includes('Network request failed') ||
            err.message?.includes('fetch') ||
            err.code === 'NETWORK_ERROR';

        if (isNetworkError) {
            if (!hasShownNetworkAlert) {
                hasShownNetworkAlert = true;
                networkAlertCount++;
                Alert.alert(
                    "Network Error",
                    "Unable to connect to the server. Please check your internet connection.",
                    [
                        { text: "OK", style: "default" },
                        {
                            text: "Retry",
                            onPress: () => {
                                setTimeout(() => {
                                    makeRequest({ url: endpoint, method, data, use_jwt, responseType, isFormData, skipAuth });
                                }, 1000);
                            },
                        },
                    ]
                );
            }
        } else {
            Alert.alert("Error", "An unexpected error occurred. Please try again.");
        }

        return [500, { message: "Network error" }];
    }
};

export default makeRequest;

export const fetchUserProfile = async () => {
    try {
        const [status, response] = await makeRequest({
            url: 'user-profile',
            method: 'GET',
        });

        if ([200, 201].includes(status)) {
            return response?.data || response || null;
        }

        console.error('Failed to fetch profile:', response?.message || 'Unknown error');
        return null;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
};
