import AsyncStorage from "@react-native-async-storage/async-storage";
import makeRequest from "./makeRequest";
import { Alert } from "react-native";

type FetchCommonDataOptions = {
    name: string;
    search?: string;
    cachable?: boolean;
    params?: Record<string, any>;
    /** When true, `name` is used as the API path directly (e.g. `members`). */
    direct?: boolean;
    /** Prefix for request/response logs (e.g. `MemberKilos`). */
    logContext?: string;
};

const fetchCommonData = async ({
    name,
    search,
    cachable = true,
    params = {},
    direct = false,
    logContext,
}: FetchCommonDataOptions) => {
    const logPrefix = logContext ? `[${logContext}]` : "[fetchCommonData]";

    try {
        // For development testing
        // await AsyncStorage.removeItem("commonData");

        let commonData;
        if (cachable) {
            commonData = await AsyncStorage.getItem("commonData");
        }

        let parsed = commonData ? JSON.parse(commonData) : {};
        let result = [];

        const hasFilterParams = Object.keys(params).some(
            (key) =>
                params[key] !== null &&
                params[key] !== undefined &&
                params[key] !== ""
        );
        const useCache = cachable && !hasFilterParams;

        if (
            !useCache ||
            !Array.isArray(parsed[name]) ||
            parsed[name].length === 0
        ) {
            const queryParamsObj: Record<string, string> = {};

            if (!direct) {
                queryParamsObj.model = name;
            }

            if (search) {
                queryParamsObj.search = search;
            }

            Object.keys(params).forEach((key) => {
                const value = params[key];
                if (value !== null && value !== undefined && value !== "") {
                    queryParamsObj[key] = String(value);
                }
            });

            const queryString = new URLSearchParams(queryParamsObj).toString();
            const url = direct
                ? queryString
                    ? `${name}?${queryString}`
                    : name
                : `global-data?${queryString}`;

            console.log(`${logPrefix} GET ${url}`);

            const [status, response] = await makeRequest({
                url,
                method: "GET",
            });

            const recordCount = Array.isArray(response?.data)
                ? response.data.length
                : response?.data
                  ? 1
                  : 0;

            console.log(
                `${logPrefix} GET ${url} -> status ${status}, records: ${recordCount}`
            );

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
            console.log(
                `${logPrefix} cache hit for "${name}" (${result?.length ?? 0} records)`
            );
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
