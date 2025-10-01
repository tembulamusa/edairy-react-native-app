import AsyncStorage from "@react-native-async-storage/async-storage";
import makeRequest from "./makeRequest"; // adjust import path
import { Alert } from "react-native";

// We add filters accordingly
const fetchCommonData = async (
    { name }: { name: string },
    search?: string
) => {
    try {
        let commonData = await AsyncStorage.getItem("commonData");
        let parsed = commonData ? JSON.parse(commonData) : {};
        let result = [];
        if (
            !Array.isArray(parsed[name]) ||  // not an array
            parsed[name].length === 0        // or empty array
        ) {
            const [status, response] = await makeRequest({
                url: `global-data?model=${name}`,
                method: "GET",
            });
            if (![200, 201].includes(status)) {
                return [];
            }
            result = response?.data || [];
            commonData = { ...parsed, [name]: response?.data ?? [] };
            await AsyncStorage.setItem("commonData", JSON.stringify(commonData));
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
