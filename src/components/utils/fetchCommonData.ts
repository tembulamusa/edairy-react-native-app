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
            const queryParamsObj: Record<string, string> = {
                model: name,
            };

            if (search) {
                queryParamsObj.search = search;
            }

            // Convert params to query string format, handling null/undefined
            Object.keys(params).forEach((key) => {
                const value = params[key];
                if (value !== null && value !== undefined && value !== '') {
                    queryParamsObj[key] = String(value);
                }
            });

            const queryParams = new URLSearchParams(queryParamsObj).toString();
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

/**
 * Clears all cached common data from AsyncStorage
 */
export const clearCommonDataCache = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem("commonData");
        console.log("✅ Common data cache cleared successfully");
    } catch (error) {
        console.error("❌ Failed to clear common data cache:", error);
        throw error;
    }
};

/**
 * Clears specific cached data from AsyncStorage
 */
export const clearSpecificCommonDataCache = async (name: string): Promise<void> => {
    try {
        const commonData = await AsyncStorage.getItem("commonData");
        if (commonData) {
            const parsed = JSON.parse(commonData);
            delete parsed[name];
            await AsyncStorage.setItem("commonData", JSON.stringify(parsed));
            console.log(`✅ ${name} cache cleared successfully`);
        }
    } catch (error) {
        console.error(`❌ Failed to clear ${name} cache:`, error);
        throw error;
    }
};

export default fetchCommonData;
