import AsyncStorage from "@react-native-async-storage/async-storage";
import makeRequest from "./makeRequest";
import { Alert } from "react-native";

type FetchCommonDataOptions = {
    name: string;
    search?: string;
    cachable?: boolean;
    params?: Record<string, any>; // 👈 new optional filters
};

const fetchCommonData = async ({
    name,
    search,
    cachable = true,
    params = {},
}: FetchCommonDataOptions) => {
    try {
        // For development testing
        // await AsyncStorage.removeItem("commonData");

        let commonData;
        if (cachable) {
            commonData = await AsyncStorage.getItem("commonData");
        }

        let parsed = commonData ? JSON.parse(commonData) : {};
        let result = [];

        const useCache = cachable;

        if (
            !useCache ||
            !Array.isArray(parsed[name]) ||
            parsed[name].length === 0
        ) {
            // Build query string
            const queryParams = new URLSearchParams({
                model: name,
                ...(search ? { search } : {}),
                ...params,
            }).toString();

            const [status, response] = await makeRequest({
                url: `global-data?${queryParams}`,
                method: "GET",
            });
            if (![200, 201].includes(status)) {
                return [];
            }
            result = response?.data ?? [];
            if (useCache) {
                const newData = { ...parsed, [name]: result };
                await AsyncStorage.setItem("commonData", JSON.stringify(newData));
            }
        } else {
            result = parsed[name];
        }
        return result;
    } catch (error) {
        console.error(`❌ Failed to load common data for ${name}:`, error);
        return {
            error: error,
            data: null,
        };
    }
};

export default fetchCommonData;
